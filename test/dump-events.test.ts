import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import type { OnThisDayRecord } from "../src/schema.ts";
import { render } from "../src/templates/index.ts";

/**
 * The events and competition editions of every sport that the Wikidata dump (CC0) adds: each a fact with its Q id, a name, a date at day precision, and
 * a place and a winner only where Wikidata states them. No person is told to be of a sex.
 */
const root = "data/v1/0.1.0/facts";
const shard = (path: string): OnThisDayRecord[] => (JSON.parse(readFileSync(`${root}/${path}`, "utf8")) as { records: OnThisDayRecord[] }).records;
const store = new Map<string, OnThisDayRecord>();
for (const name of readdirSync(`${root}/store`)) for (const r of shard(`store/${name}`)) store.set(r.recordId, r);
const EVENT = new Set(["competition-start", "competition-end", "sport-event"]);
const events = [...store.values()].filter((r) => EVENT.has(r.category) && r.recordId.startsWith("wikidata:"));
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8")) as { sources?: Record<string, Record<string, unknown>>; eventsDay?: number };
const SEX = /\b(?:men['’]?s|women['’]?s|male|female|boys['’]?|girls['’]?|ladies['’]?|men|women)\b/i;
const TIMELY = /\b(?:today|tonight|this day)\b/i;

test("the dump adds tens of thousands of events, in many sports, each from Wikidata and CC0", () => {
  assert.ok(events.length >= 25_000, `${events.length} event facts`);
  for (const category of EVENT) assert.ok(events.filter((r) => r.category === category).length >= 4_000, category);
  assert.ok(new Set(events.map((r) => r.sport)).size >= 60);
  for (const r of events) {
    assert.match(r.recordId, /^wikidata:(?:competition-start|competition-end|sport-event):Q\d+:\d{4}-\d{2}-\d{2}$/, r.recordId);
    const qid = r.recordId.split(":")[2];
    assert.deepEqual(r.source, { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors, CC0.", url: `https://www.wikidata.org/wiki/${qid}` }, r.recordId);
    assert.equal(r.datePrecision, "day");
    assert.equal(r.basis, "source");
    assert.ok(r.tags.includes("competition-boundary"), `${r.recordId} has no tag`);
  }
});

test("a date is a real day: not January 1 or December 31, from 1850, not after the dump, and an end after its start", () => {
  const byEntity = new Map<string, { start?: string; end?: string }>();
  for (const r of events) {
    assert.ok(r.eventDate && !/-(?:01-01|12-31)$/.test(r.eventDate), `${r.recordId} is on a year's edge`);
    assert.ok(r.eventDate >= "1850-01-01" && r.eventDate <= "2026-10-12", r.recordId);
    assert.equal(new Date(`${r.eventDate}T00:00:00Z`).toISOString().slice(0, 10), r.eventDate, r.recordId);
    const entity = byEntity.get(r.recordId.split(":")[2]!) ?? {};
    if (r.category === "competition-start") entity.start = r.eventDate;
    if (r.category === "competition-end") entity.end = r.eventDate;
    byEntity.set(r.recordId.split(":")[2]!, entity);
  }
  let both = 0;
  for (const [qid, { start, end }] of byEntity) if (start && end) { both += 1; assert.ok(start < end, `${qid}: ${start} to ${end}`); }
  assert.ok(both >= 5_000, `${both} editions with a start and an end`);
});

test("the words are the item's: its name, its place and its winner, each only where Wikidata states them, and no person told to be of a sex", () => {
  let winners = 0;
  for (const r of events) {
    assert.ok(r.eventLabel && r.eventLabel.length >= 6, r.recordId);
    assert.ok(r.text?.toLowerCase().includes(r.eventLabel.toLowerCase()), `${r.recordId}: ${r.text}`);
    assert.doesNotMatch(r.text ?? "", /\(none\)|\bnull\b|undefined|NaN|\.\.(?!\.)| {2}/, r.recordId);
    assert.doesNotMatch(r.eventLabel, TIMELY, r.recordId);
    assert.doesNotMatch(r.text ?? "", TIMELY, r.recordId);
    if (r.winnerName) {
      winners += 1;
      assert.notEqual(r.category, "competition-start", `${r.recordId}: a start has no winner`);
      assert.doesNotMatch(r.winnerName, SEX, `${r.recordId}: a winner named with a sex marker`);
      assert.ok(r.text?.includes(`won by ${r.winnerName}`), r.recordId);
    }
    if (r.eventPlace) assert.ok(r.text?.includes(r.eventPlace), r.recordId);
  }
  assert.ok(winners >= 4_000, `${winners} events name a winner`);
});

test("no event is of para sport, and nothing about a person's sex, ethnicity, religion, politics, family or health is in an event", () => {
  const keys = new Set<string>();
  for (const r of events) for (const k of Object.keys(r)) keys.add(k);
  assert.deepEqual([...keys].filter((k) => !/^(?:recordId|category|tags|basis|eventDate|datePrecision|sport|competition|league|source|sitelinks|eventLabel|eventPlace|winnerName|wikidata|wikipedia|hostCountries|text|textJa)$/.test(k)), [], "only the fields of the schema");
  for (const r of events) {
    assert.doesNotMatch(`${r.eventLabel} ${r.sport}`, /\b(?:para\w*|paralympic\w*|wheelchair|deaf\w*|blind|sitting|goalball|boccia)\b/i, r.recordId);
    assert.doesNotMatch(r.sport ?? "", /(?:^|-)(?:women|men|female|male|girls|boys|para)(?:-|$)/, r.recordId);
  }
});

test("every day has events of many sports in its events shard, at most three of one sport, each as stored", () => {
  assert.equal(manifest.eventsDay, 40);
  assert.equal(readdirSync(`${root}/events`).length, 366);
  let deep = 0;
  for (const name of readdirSync(`${root}/events`)) {
    const records = shard(`events/${name}`);
    const day = name.slice(0, 5);
    assert.ok(records.length <= 40, `${name} has ${records.length}`);
    const sports = new Map<string, number>();
    for (const r of records) {
      assert.ok(EVENT.has(r.category), r.recordId);
      assert.equal(r.eventDate?.slice(5), day, r.recordId);
      assert.deepEqual(r, store.get(r.recordId), `${r.recordId} differs from the stored fact`);
      sports.set(r.sport ?? "", (sports.get(r.sport ?? "") ?? 0) + 1);
    }
    assert.ok([...sports.values()].every((n) => n <= 3) || records.length < 12, `${name}: more than three of one sport`);
    if (day !== "01-01" && day !== "12-31") assert.ok(records.length >= 8 && sports.size >= 4, `${name}: ${records.length} events of ${sports.size} sports`);
    if (records.length >= 20 && sports.size >= 8) deep += 1;
  }
  assert.ok(deep >= 340, `${deep} days list 20 events or more, of 8 sports or more`);
});

test("an event is worded in English and Japanese from its fields: the name with 'the' before a year, the place with 'at' or 'in', the winner last", () => {
  const base = { tags: ["competition-boundary"], basis: "source", datePrecision: "day", competition: null, league: null, source: { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors, CC0.", url: null } } as const;
  const final: OnThisDayRecord = { ...base, recordId: "t:1", category: "sport-event", eventDate: "1966-07-30", sport: "soccer", eventLabel: "1966 FIFA World Cup Final", eventPlace: "Wembley Stadium", winnerName: "England" };
  assert.equal(render(final, { asOf: "2026-10-20" })?.text, "On July 30, 1966, the 1966 FIFA World Cup Final took place at Wembley Stadium, won by England.");
  assert.equal(render(final, { asOf: "2026-07-30" })?.text, "The 1966 FIFA World Cup Final took place at Wembley Stadium, won by England.");
  assert.equal(render(final, { asOf: "2026-10-20", locale: "ja" })?.text, "1966年7月30日、1966 FIFA World Cup Final（Wembley Stadium）が行われた。勝者はEngland。");
  const start: OnThisDayRecord = { ...base, recordId: "t:2", category: "competition-start", eventDate: "2012-05-29", sport: "rhythmic-gymnastics", eventLabel: "2012 Rhythmic Gymnastics European Championships", eventPlace: "Nizhny Novgorod" };
  assert.equal(render(start, { asOf: "2026-10-20" })?.text, "On May 29, 2012, the 2012 Rhythmic Gymnastics European Championships began in Nizhny Novgorod.");
  assert.equal(render({ ...start, category: "competition-end", eventDate: "2012-06-03", winnerName: "Russia" }, { asOf: "2026-10-20" })?.text, "On June 3, 2012, the 2012 Rhythmic Gymnastics European Championships ended in Nizhny Novgorod, won by Russia.");
  const named: OnThisDayRecord = { ...base, recordId: "t:3", category: "sport-event", eventDate: "1993-11-12", sport: "mma", eventLabel: "UFC 1" };
  assert.equal(render(named, { asOf: "2026-10-20" })?.text, "On November 12, 1993, UFC 1 took place.");
  assert.equal(render(named, { asOf: "2026-11-12" })?.text, "In 1993, UFC 1 took place.");
  const lower: OnThisDayRecord = { ...base, recordId: "t:4", category: "sport-event", eventDate: "2026-02-21", sport: "biathlon", eventLabel: "biathlon at the 2026 Winter Olympics – mass start" };
  assert.equal(render(lower, { asOf: "2026-02-21" })?.text, "Biathlon at the 2026 Winter Olympics – mass start took place.");
  assert.equal(render(lower, { asOf: "2026-10-20" })?.text, "On February 21, 2026, biathlon at the 2026 Winter Olympics – mass start took place.");
  assert.equal(render({ ...final, eventPlace: "F.C. Wembley", winnerName: "Nottingham Forest F.C." }, { asOf: "2026-10-20" })?.text, "On July 30, 1966, the 1966 FIFA World Cup Final took place in F.C. Wembley, won by Nottingham Forest F.C.");
  assert.equal(render({ ...final, eventLabel: "" }, { asOf: "2026-10-20" }), null);
});

test("the facts' metadata names the dump for the events too, with how many facts it added, and the README says how many", () => {
  const meta = manifest.sources?.wikidataDumpEvents;
  assert.ok(meta, "no sources.wikidataDumpEvents in facts/manifest.json");
  assert.equal(meta.dumpName, "wikidata-20261012-all.json.gz");
  assert.equal(meta.dumpDate, "2026-10-12");
  assert.match(String(meta.dumpSha256), /^[0-9a-f]{64}$/);
  assert.equal(meta.factsAdded, events.length);
  const readme = readFileSync("README.md", "utf8");
  assert.ok(readme.includes(`**${events.length.toLocaleString("en-US")} events and competition editions**`), "the README's count of events is out of date");
});
