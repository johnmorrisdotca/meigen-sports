import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import type { OnThisDayRecord } from "../src/schema.ts";

/**
 * The births and deaths of sports people of every sport that the Wikidata dump (CC0) adds: each is a fact with its Q id, a short phrase from data
 * (the `epithet`), a date at day precision, and nothing that says sex or gender, ethnicity, religion, politics, family or health.
 */
const root = "data/v1/0.1.0/facts";
const shard = (path: string): OnThisDayRecord[] => (JSON.parse(readFileSync(`${root}/${path}`, "utf8")) as { records: OnThisDayRecord[] }).records;
const store = new Map<string, OnThisDayRecord>();
for (const name of readdirSync(`${root}/store`)) for (const r of shard(`store/${name}`)) store.set(r.recordId, r);
const all = [...store.values()];
const dump = all.filter((r) => r.recordId.startsWith("wikidata:player-"));
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8")) as { sources?: { wikidataDump?: Record<string, unknown> }; peopleDay?: number };

const SENSITIVE = /\b(?:female|male|woman|women|girl|boy|lady|gentleman|sportswoman|sportsman|gay|lesbian|bisexual|transgender|queer|lgbt\w*|son|daughter|father|mother|wife|husband|brother|sister|widow|spouse|married|partner|family|jewish|christian|catholic|muslim|islamic|hindu|buddhist|sikh|atheist|religious|priest|bishop|pastor|imam|rabbi|monk|nun|protestant|orthodox|anglican|lutheran|missionary|republican|democrat|conservative|liberal|socialist|communist|nationalist|ethnic|disabled|disability|deaf|blind|paralympic\w*|para|wheelchair|cancer|illness|convicted|criminal|murder\w*|terror\w*|nazi|fascist|doping|banned)\b/i;
const FORBIDDEN_KEY = /gender|sex|ethnic|religion|party|ideology|spouse|child|parent|sibling|family|health|medical|disease|burial|residence/i;

test("the dump adds tens of thousands of facts, in every sport it covers, each from Wikidata and CC0", () => {
  assert.ok(dump.length >= 40_000, `${dump.length} dump facts`);
  const sports = new Set(dump.map((r) => r.sport));
  assert.ok(sports.size >= 100, `${sports.size} sports`);
  for (const sport of ["soccer", "athletics", "cycling", "rowing", "tennis", "boxing", "gymnastics", "swimming", "cricket", "judo", "fencing", "chess", "handball", "volleyball", "alpine-skiing", "figure-skating", "table-tennis", "badminton"]) assert.ok(dump.some((r) => r.sport === sport), `no ${sport}`);
  for (const r of dump) {
    assert.match(r.recordId, /^wikidata:player-(?:birthday|death):Q\d+:\d{4}-\d{2}-\d{2}$/, r.recordId);
    assert.equal(r.recordId, `wikidata:${r.category}:${r.person?.qid}:${r.eventDate}`);
    assert.deepEqual(r.source, { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors, CC0.", url: `https://www.wikidata.org/wiki/${r.person?.qid}` }, r.recordId);
    assert.equal(r.datePrecision, "day");
    assert.equal(r.basis, "source");
  }
});

test("a date is a real day: not January 1, from 1850, not after the dump, a death after its birth, an age that is possible", () => {
  for (const r of dump) {
    assert.ok(r.eventDate && !r.eventDate.endsWith("-01-01"), `${r.recordId} is on January 1`);
    assert.ok(r.eventDate >= "1850-01-01" && r.eventDate <= "2026-10-12", r.recordId);
    assert.ok(!Number.isNaN(Date.parse(`${r.eventDate}T00:00:00Z`)) && new Date(`${r.eventDate}T00:00:00Z`).toISOString().slice(0, 10) === r.eventDate, r.recordId);
    if (r.birthDate && r.deathDate) assert.ok(r.birthDate < r.deathDate, `${r.recordId} dies before birth`);
    if (r.category === "player-birthday") assert.equal(r.birthDate, r.eventDate);
    else assert.equal(r.deathDate, r.eventDate);
    if (r.ageYears != null) assert.ok(r.ageYears >= 0 && r.ageYears <= 115, `${r.recordId} aged ${r.ageYears}`);
  }
});

test("a missing death never means alive: the status is unknown or deceased, and a person with no death on record is unknown", () => {
  for (const r of dump) {
    assert.ok(r.livingStatus === "unknown" || r.livingStatus === "deceased", `${r.recordId} is ${r.livingStatus}`);
    if (r.category === "player-birthday" && !r.deathDate) assert.ok(r.livingStatus === "unknown" || r.livingStatus === "deceased");
    if (r.category === "player-death") assert.equal(r.livingStatus, "deceased");
    assert.doesNotMatch(r.text ?? "", /\bturns? \d|would have turned|\bis alive\b|\bliving\b/i, r.recordId);
  }
});

test("the words are the data's: an epithet of ordinary words, with no sex, ethnicity, religion, politics, family, health or crime", () => {
  for (const r of dump) {
    assert.ok(r.epithet && r.epithet.length >= 3 && r.epithet.length <= 70, r.recordId);
    assert.doesNotMatch(r.epithet, /[\d()[\];:/@#&]/, `${r.recordId}: ${r.epithet}`);
    assert.doesNotMatch(r.epithet, SENSITIVE, `${r.recordId}: ${r.epithet}`);
    assert.ok(r.text?.includes(r.person!.name) && r.text.includes(r.epithet), `${r.recordId}: the sentence says who he is: ${r.text}`);
    assert.doesNotMatch((r.text ?? "").replace(r.person!.name, ""), SENSITIVE, `${r.recordId}: ${r.text}`);
    assert.doesNotMatch(r.sport ?? "", /(?:^|-)(?:women|womens|men|mens|female|male|girls|boys|para|paralympic|wheelchair|deaf|blind)(?:-|$)/, `${r.recordId}: sport ${r.sport}`);
    assert.doesNotMatch(r.text ?? "", /\(none\)|\bnull\b|undefined|NaN/, r.recordId);
  }
});

test("no record of the dump holds a field that is about sex, gender, ethnicity, religion, politics, family or health", () => {
  const keys = new Set<string>();
  for (const r of dump) {
    for (const k of Object.keys(r)) keys.add(k);
    for (const k of Object.keys(r.person ?? {})) keys.add(`person.${k}`);
  }
  assert.deepEqual([...keys].filter((k) => FORBIDDEN_KEY.test(k)), []);
  assert.deepEqual([...keys].filter((k) => !/^(?:recordId|category|tags|basis|eventDate|datePrecision|sport|competition|league|source|person|person\.(?:personId|qid|name|leagueCodes|franchiseIds|teamSeasonIds)|epithet|sitelinks|nationality|birthDate|deathDate|birthPlace|livingStatus|bornYear|ageYears|text|textJa)$/.test(k)), [], "only the fields of the schema");
  for (const r of dump) assert.ok((r.sitelinks ?? 0) >= 5, `${r.recordId} has ${r.sitelinks} editions`);
});

test("every day has people of many sports; January 1 has only what was already confirmed", () => {
  const sportsOf = new Map<string, Set<string>>(), dumpOf = new Map<string, number>();
  for (const r of all) if (r.eventDate && (r.category === "player-birthday" || r.category === "player-death")) {
    const day = r.eventDate.slice(5);
    (sportsOf.get(day) ?? sportsOf.set(day, new Set()).get(day)!).add(r.sport ?? "");
    if (r.recordId.startsWith("wikidata:player-")) dumpOf.set(day, (dumpOf.get(day) ?? 0) + 1);
  }
  assert.equal(sportsOf.size, 366);
  for (const [day, sports] of sportsOf) assert.ok(sports.size >= (day === "01-01" ? 5 : 25), `${day} has people of ${sports.size} sports`);
  assert.equal(dumpOf.get("01-01") ?? 0, 0, "no January 1 from the dump: Wikidata writes a year-only date that way as often as a real one");
  const counts = [...dumpOf.entries()].filter(([day]) => day !== "01-01").map(([, n]) => n).sort((a, b) => a - b);
  assert.ok(counts.length === 365 && counts[0]! >= 50, `the quietest day has ${counts[0]} dump people`);
  console.log(`dump people per day: min ${counts[0]}, median ${counts[Math.floor(counts.length / 2)]}, max ${counts.at(-1)}; sports per day: min ${Math.min(...[...sportsOf.values()].map((s) => s.size))}`);
});

test("the people shard of a day lists births and deaths of many sports, at most three of one, each as stored", () => {
  assert.equal(manifest.peopleDay, 40);
  let deep = 0;
  for (const name of readdirSync(`${root}/people`)) {
    const records = shard(`people/${name}`);
    const day = name.slice(0, 5);
    assert.ok(records.length <= 40, `${name} has ${records.length}`);
    const sports = new Map<string, number>(), persons = new Set<string>();
    for (const r of records) {
      assert.ok(r.category === "player-birthday" || r.category === "player-death", r.recordId);
      assert.equal(r.eventDate?.slice(5), day, r.recordId);
      assert.deepEqual(r, store.get(r.recordId), `${r.recordId} differs from the stored fact`);
      sports.set(r.sport ?? "", (sports.get(r.sport ?? "") ?? 0) + 1);
      const who = r.person?.qid ?? r.recordId;
      assert.ok(!persons.has(who), `${name} lists ${who} twice`);
      persons.add(who);
    }
    if (day !== "01-01" && records.length >= 30) deep += 1;
    assert.ok([...sports.values()].every((n) => n <= 3) || records.length < 12, `${name}: more than three of one sport`);
  }
  assert.equal(readdirSync(`${root}/people`).length, 366);
  assert.ok(deep >= 360, `${deep} days list 30 people or more`);
});

test("the README says how many births and deaths the dump adds", () => {
  const readme = readFileSync("README.md", "utf8");
  assert.ok(readme.includes(`**${dump.length.toLocaleString("en-US")} births and deaths of sports people** in ${new Set(dump.map((r) => r.sport)).size} sports`), "the README's count of people is out of date");
});

test("the facts' metadata names the dump: its name, date and hashes, and how many facts it added", () => {
  const meta = manifest.sources?.wikidataDump as Record<string, unknown> | undefined;
  assert.ok(meta, "no sources.wikidataDump in facts/manifest.json");
  assert.equal(meta.dumpName, "wikidata-20261012-all.json.gz");
  assert.equal(meta.dumpDate, "2026-10-12");
  assert.match(String(meta.dumpMd5), /^[0-9a-f]{32}$/);
  assert.match(String(meta.dumpSha256), /^[0-9a-f]{64}$/);
  assert.match(String(meta.source), /CC0/);
  assert.deepEqual(Object.keys(meta.filteredFilesSha256 as object).sort(), ["events.jsonl.gz", "items.jsonl.gz", "labels.jsonl.gz", "people.jsonl.gz"]);
  assert.equal(meta.factsAdded, dump.length);
});
