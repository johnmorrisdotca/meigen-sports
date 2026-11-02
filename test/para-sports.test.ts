import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import type { OnThisDayRecord } from "../src/schema.ts";
import { CLASS_CODE, HEALTH, PARA, isParaSport, paraWords } from "../scripts/para.ts";
import { WORDS as PAGE_WORDS } from "../scripts/page.ts";

/**
 * Para sports (John, 2026-11-02): wheelchair sports, goalball, boccia, the Paralympic Games and the rest of `data-sources/para-sports.json`, as births, deaths and
 * events from the Wikidata dump (CC0). The sport may be named; nothing else about the body is stored: no class code, no impairment, no health word.
 */
const root = "data/v1/0.1.0/facts";
const store = new Map<string, OnThisDayRecord>();
for (const name of readdirSync(`${root}/store`)) for (const r of (JSON.parse(readFileSync(`${root}/store/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records) store.set(r.recordId, r);
const all = [...store.values()];
const para = all.filter((r) => isParaSport(r.sport));
const people = para.filter((r) => r.category === "player-birthday" || r.category === "player-death");
const events = para.filter((r) => ["competition-start", "competition-end", "sport-event"].includes(r.category));
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8")) as { sources?: Record<string, Record<string, unknown>> };
const count = (category: string): number => para.filter((r) => r.category === category).length;
const IMPAIRMENT_IN_A_SPORT = /(?:^|[-:])(?:impair\w*|disab\w*|handicap\w*|blind|deaf|amput\w*)(?:-|$)/;
const wordsOf = (r: OnThisDayRecord): string => JSON.stringify([r.text, r.textJa, r.highlight, r.epithet, r.eventLabel, r.eventPlace, r.winnerName, r.birthPlace, r.sport, r.tags]);

test("para sports are in the data in every new category, in many sports, each from Wikidata and CC0", () => {
  assert.ok(count("player-birthday") >= 500, `${count("player-birthday")} births`);
  assert.ok(count("player-death") >= 100, `${count("player-death")} deaths`);
  assert.ok(count("competition-start") >= 100, `${count("competition-start")} starts`);
  assert.ok(count("competition-end") >= 100, `${count("competition-end")} ends`);
  assert.ok(count("sport-event") >= 30, `${count("sport-event")} single days`);
  const sports = new Set(para.map((r) => r.sport));
  assert.ok(sports.size >= 25, `${sports.size} para sports`);
  for (const sport of ["goalball", "boccia", "wheelchair-basketball", "wheelchair-rugby", "wheelchair-tennis", "wheelchair-curling", "sitting-volleyball", "para-ice-hockey", "para-athletics", "para-swimming", "paralympics"]) {
    assert.ok(sports.has(sport), `no ${sport} fact`);
  }
  for (const sport of sports) assert.ok(isParaSport(sport), `${sport}`);
  for (const r of para) {
    assert.deepEqual(r.source, { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors, CC0.", url: `https://www.wikidata.org/wiki/${r.recordId.split(":")[2]}` }, r.recordId);
    assert.equal(r.datePrecision, "day");
    assert.equal(r.basis, "source");
    assert.ok(r.tags.includes(`sport:${r.sport}`), r.recordId);
  }
});

test("a date is a real day: not January 1 or December 31 for an event, from 1850, not after the dump", () => {
  for (const r of para) {
    assert.ok(r.eventDate && r.eventDate >= "1850-01-01" && r.eventDate <= "2026-10-12", r.recordId);
    assert.equal(new Date(`${r.eventDate}T00:00:00Z`).toISOString().slice(0, 10), r.eventDate, r.recordId);
    assert.ok(!r.eventDate.endsWith("-01-01"), `${r.recordId} is on January 1`);
    if (r.category !== "player-birthday" && r.category !== "player-death") assert.ok(!r.eventDate.endsWith("-12-31"), r.recordId);
  }
  const edition = new Map<string, { start?: string; end?: string }>();
  for (const r of events) {
    const entry = edition.get(r.recordId.split(":")[2]!) ?? {};
    if (r.category === "competition-start") entry.start = r.eventDate ?? undefined;
    if (r.category === "competition-end") entry.end = r.eventDate ?? undefined;
    edition.set(r.recordId.split(":")[2]!, entry);
  }
  for (const [qid, { start, end }] of edition) if (start && end) assert.ok(start < end, `${qid}: ${start} to ${end}`);
});

test("a person is one phrase of a table, a name, a sport and a nationality: the sport's own phrase, never his description", () => {
  assert.ok(people.length >= 600, `${people.length} para people`);
  const who = new Map(PARA.sports.map((s) => [s.slug, s.who]));
  for (const r of people) {
    const phrase = who.get(r.sport ?? "");
    assert.ok(phrase, `${r.recordId}: no phrase for ${r.sport}`);
    assert.match(r.epithet ?? "", new RegExp(`^(?:[A-Z][\\p{L}'’.-]*(?: [A-Z][\\p{L}'’.-]*)* )?${phrase}$`, "u"), r.recordId);
    assert.ok(r.text?.includes(r.person!.name) && r.text.includes(r.epithet!), `${r.recordId}: ${r.text}`);
    assert.ok(r.livingStatus === "unknown" || r.livingStatus === "deceased", r.recordId);
    if (r.category === "player-death") assert.equal(r.livingStatus, "deceased");
    assert.doesNotMatch(r.text ?? "", /\bturns? \d|would have turned|\bis alive\b|\bliving\b/i, r.recordId);
    assert.ok((r.sitelinks ?? 0) >= 1 || r.livingStatus === "deceased" || r.priorityAthlete, `${r.recordId}: nobody without an article`);
  }
});

test("the fame rule: the listed, the medallists, the deceased with an article, four Games or ten editions, and nobody else", () => {
  const living = people.filter((r) => r.category === "player-birthday" && r.livingStatus !== "deceased");
  assert.ok(living.length >= 300, `${living.length} living people`);
  for (const r of living) assert.ok((r.sitelinks ?? 0) >= 1, `${r.recordId}: a living person has an article`);
  const byQid = new Map(people.map((r) => [r.person?.qid, r]));
  const vergeer = byQid.get("Q259606");
  assert.ok(vergeer, "Esther Vergeer (on John's priority list) is published");
  assert.equal(vergeer.eventDate, "1981-07-18");
  assert.equal(vergeer.sport, "wheelchair-tennis");
  assert.match(vergeer.text ?? "", /^Esther Vergeer, .*wheelchair tennis player, was born on July 18, 1981\.$/);
  const deaths = people.filter((r) => r.category === "player-death");
  assert.ok(deaths.length >= 100, `${deaths.length} deaths`);
  for (const r of deaths) assert.ok(r.ageYears == null || (r.ageYears >= 0 && r.ageYears <= 115), `${r.recordId} aged ${r.ageYears}`);
});

test("events: a Games edition, a sport at a Games, a championship and a team result named by its country", () => {
  assert.ok(events.length >= 280, `${events.length} events`);
  const games = events.filter((r) => r.sport === "paralympics" && /^\d{4} (?:Summer|Winter) Paralympics$/.test(r.eventLabel ?? ""));
  assert.ok(games.filter((r) => r.category === "competition-start").length >= 20, "the Games editions begin");
  assert.ok(games.filter((r) => r.category === "competition-end").length >= 20, "the Games editions end");
  const sportAtGames = events.filter((r) => / at the \d{4} (?:Summer|Winter) Paralympics/i.test(r.eventLabel ?? ""));
  assert.ok(sportAtGames.length >= 100, `${sportAtGames.length} sports at a Games`);
  for (const r of events) {
    assert.ok(r.eventLabel && r.eventLabel.length >= 6, r.recordId);
    assert.ok(r.text?.toLowerCase().includes(r.eventLabel.toLowerCase()), `${r.recordId}: ${r.text}`);
    assert.doesNotMatch(r.text ?? "", /\(none\)|\bnull\b|undefined|NaN| {2}/, r.recordId);
  }
  const goalball = events.find((r) => /men's goalball, China v Japan/.test(r.eventLabel ?? ""));
  assert.ok(goalball, "a goalball match of the 2024 Games");
  assert.equal(goalball.winnerName, "China");
  assert.match(goalball.text ?? "", /won by China\.$/);
  const results = events.filter((r) => r.winnerName);
  assert.ok(results.length >= 4, `${results.length} results`);
  for (const r of results) assert.doesNotMatch(r.eventLabel ?? "", /\b(?:IBSA|Invictus)\b/, r.recordId);
});

test("no class code and no word for the body anywhere: not in a sentence, a name, a tag, a phrase, a place or a winner", () => {
  const problems: string[] = [];
  for (const r of para) {
    if (CLASS_CODE.test(wordsOf(r))) problems.push(`${r.recordId}: a class code in ${wordsOf(r).slice(0, 160)}`);
    if (HEALTH.test(wordsOf(r))) problems.push(`${r.recordId}: a health word in ${wordsOf(r).slice(0, 160)}`);
    if (/\b[TFS]\d{2}\b|\bBC[1-4]\b|\bSB?\d{1,2}\b/.test(r.eventLabel ?? "")) problems.push(`${r.recordId}: class in the name`);
    for (const key of Object.keys(r)) assert.doesNotMatch(key, /class|impair|disab|health|medical|diagnos/i, `${r.recordId}: field ${key}`);
  }
  assert.deepEqual(problems, []);
  for (const r of all) {
    for (const tag of r.tags.filter((t) => t.startsWith("sport:"))) assert.doesNotMatch(tag, IMPAIRMENT_IN_A_SPORT, `${r.recordId}: ${tag}`);
    assert.doesNotMatch(r.sport ?? "", IMPAIRMENT_IN_A_SPORT, r.recordId);
    if (/^(?:para|wheelchair|goalball|boccia|sitting|standing)/.test(r.sport ?? "")) assert.ok(isParaSport(r.sport), `${r.recordId}: ${r.sport} is not a listed para sport`);
  }
});

test("the sport list names sports only: no impairment in a slug, a phrase or a label, and a sport named for one is not on it", () => {
  assert.ok(PARA.sports.length >= 36);
  for (const s of PARA.sports) {
    assert.doesNotMatch(`${s.slug} ${s.who} ${s.label}`, HEALTH, s.slug);
    assert.doesNotMatch(`${s.slug} ${s.who}`, CLASS_CODE, s.slug);
  }
  for (const missing of ["blind-football", "deaf", "amputee", "special-olympics", "paragliding"]) assert.ok(![...PARA.sports.map((s) => s.slug), PARA.gamesSlug].some((slug) => slug.includes(missing)), missing);
});

test("the demo names every para sport in English and in Japanese, with no class and no word for the body", () => {
  for (const language of ["en", "ja"] as const) {
    const words = paraWords(language);
    for (const sport of new Set(para.map((r) => r.sport ?? ""))) {
      assert.ok(words[sport], `${sport} has no ${language} name`);
      assert.equal((PAGE_WORDS[language] as Record<string, string>)[sport], words[sport], `${sport}: the demo's ${language} word`);
      assert.doesNotMatch(words[sport]!, HEALTH, sport);
    }
  }
  for (const s of PARA.sports) {
    assert.match(s.en, /^[A-Z][a-z -]+$/, s.slug);
    assert.match(s.ja, /^[\u3040-\u30ff\u4e00-\u9fff]+$/u, s.slug);
  }
});

test("the facts' metadata names the dump for the para sports, with how many facts it added, and the README says how many", () => {
  const meta = manifest.sources?.wikidataDumpPara;
  assert.ok(meta, "no sources.wikidataDumpPara in facts/manifest.json");
  assert.equal(meta.dumpName, "wikidata-20261012-all.json.gz");
  assert.equal(meta.dumpDate, "2026-10-12");
  assert.match(String(meta.dumpSha256), /^[0-9a-f]{64}$/);
  assert.equal(meta.factsAdded, para.length);
  const readme = readFileSync("README.md", "utf8");
  assert.ok(readme.includes(`**${para.length.toLocaleString("en-US")} facts of para sports**`), "the README's count of para facts is out of date");
  const docs = readFileSync("docs/para-sports.md", "utf8");
  assert.ok(docs.includes(`${count("player-birthday")} births`) && docs.includes(`${count("player-death")} deaths`), "docs/para-sports.md counts are out of date");
});
