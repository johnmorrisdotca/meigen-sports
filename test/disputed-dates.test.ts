import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Facts } from "../scripts/golden.ts";
import { derivedTags, TAG_NAMESPACES } from "../src/tags.ts";
import { tagsOf } from "../src/facts.ts";
import type { OnThisDayRecord } from "../src/schema.ts";
import { dateNote, dayContext, render, renderRun, TEMPLATES } from "../src/templates/index.ts";
import { isDate } from "../src/dates.ts";

// The people Wikidata itself disagrees about (equal-rank values, no preferred one), made by `pipeline/audit_dates.py --write-disputed` from the dump of 2026-10-12.
// Every fact that states one of those dates keeps the date it had and carries the others. `pnpm test:dates` compares the file with the dump itself.
interface Disputed { readonly qid: string; readonly name: string; readonly birth?: readonly string[]; readonly death?: readonly string[] }
const seed = JSON.parse(readFileSync("data-sources/disputed-dates.json", "utf8")) as { counts: { people: number; births: number; deaths: number }; people: Disputed[] };
const byQid = new Map(seed.people.map((p) => [p.qid, p]));
const facts = new Facts("data/v1/0.1.0/facts");
const marked = facts.all.filter((r) => r.dateDisputed);
const others = (days: readonly string[] | undefined, value: string | null | undefined): string[] => (days && value ? days.filter((d) => d !== value) : []);

test("the list holds 524 people with 538 contested dates, each with two or more real, distinct days in order", () => {
  assert.deepEqual(seed.counts, { people: 524, births: 369, deaths: 169 });
  assert.equal(seed.people.length, 524);
  assert.equal(byQid.size, 524);
  for (const p of seed.people) for (const days of [p.birth, p.death]) {
    if (!days) continue;
    assert.ok(days.length >= 2, `${p.qid} ${p.name}`);
    assert.deepEqual([...days].sort(), [...days], p.qid);
    assert.equal(new Set(days).size, days.length, p.qid);
    for (const day of days) assert.ok(isDate(day), `${p.qid}: ${day} is not a calendar day`);
  }
  // Wikidata holds 1957-02-29 for Jan Ceulemans, who has one date: it is no alternative.
  assert.equal(byQid.has("Q312618"), false);
});

test("every fact that states a contested date is marked, with every other day the source gives, and no other fact is", () => {
  const problems: string[] = [];
  let own = 0;
  for (const r of facts.all) {
    const dispute = byQid.get(r.person?.qid ?? "");
    const birthday = r.category === "player-birthday", death = r.category === "player-death";
    const wantOwn = dispute ? others(birthday ? dispute.birth : death ? dispute.death : undefined, r.eventDate) : [];
    const wantBirth = dispute && !birthday ? others(dispute.birth, r.birthDate) : [];
    const wantDeath = dispute && !death ? others(dispute.death, r.deathDate) : [];
    const want = wantOwn.length > 0 || wantBirth.length > 0 || wantDeath.length > 0;
    if (Boolean(r.dateDisputed) !== want) problems.push(`${r.recordId}: dateDisputed ${r.dateDisputed}, expected ${want}`);
    if (!want) {
      for (const key of ["dateAlternatives", "birthDateAlternatives", "deathDateAlternatives", "ageAlternatives", "dateNote", "dateNoteJa"] as const) if (r[key] !== undefined) problems.push(`${r.recordId}: ${key} on a fact that is not disputed`);
      continue;
    }
    if (wantOwn.length) own += 1;
    assert.deepEqual(r.dateAlternatives ?? [], wantOwn, r.recordId);
    assert.deepEqual(r.birthDateAlternatives ?? [], wantBirth, r.recordId);
    assert.deepEqual(r.deathDateAlternatives ?? [], wantDeath, r.recordId);
    // The date the fact always had is one of the source's own, and is never also an alternative.
    for (const alt of [...wantOwn, ...wantBirth, ...wantDeath]) assert.ok(isDate(alt) && alt !== r.eventDate && alt !== r.birthDate && alt !== r.deathDate, `${r.recordId}: ${alt}`);
  }
  assert.deepEqual(problems, []);
  assert.equal(marked.length, 716);
  assert.equal(own, 426, "facts whose own day is disputed");
  assert.equal(marked.filter((r) => r.category === "player-birthday").length, 348);
  assert.equal(marked.filter((r) => r.category === "player-death").length, 368);
  assert.equal(marked.filter((r) => r.birthDateAlternatives).length, 216);
  assert.equal(marked.filter((r) => r.deathDateAlternatives).length, 93);
  // A disputed fact stays where it was: nothing is dropped, and no fact is added.
  assert.equal(facts.all.length, 103592);
});

test("a disputed fact carries the tag `date:disputed`, a note in both languages, and its sentence still names the date it always had", () => {
  assert.ok((TAG_NAMESPACES as readonly string[]).includes("date"));
  for (const r of facts.all) assert.equal(r.tags.includes("date:disputed"), r.dateDisputed === true, r.recordId);
  for (const r of marked) {
    assert.ok(derivedTags(r).includes("date:disputed") && tagsOf(r).includes("date:disputed"), r.recordId);
    assert.equal(r.dateNote, dateNote(r, "en"), r.recordId);
    assert.equal(r.dateNoteJa, dateNote(r, "ja"), r.recordId);
    assert.match(r.dateNote ?? "", /^(?:Date|Birth date|Death date) disputed: Wikidata also gives /, r.recordId);
    assert.match(r.dateNoteJa ?? "", /^(?:日付|生年月日|没年月日)に諸説あり：Wikidataにはほかに/, r.recordId);
    // The note is data: the sentence is the one it was, with no "disputed" in it.
    assert.doesNotMatch(r.text ?? "", /disput|Wikidata also/i, r.recordId);
    assert.doesNotMatch(r.textJa ?? "", /諸説|Wikidata/, r.recordId);
    if (r.dateAlternatives) assert.ok((r.text ?? "").includes(String(Number(r.eventDate!.slice(0, 4)))), `${r.recordId}: ${r.text}`);
  }
  // A fact that is not disputed has no note and no marker.
  assert.equal(dateNote(facts.all.find((r) => !r.dateDisputed)!, "en"), null);
});

test("the note is short, says every alternative and decides nothing", () => {
  const weissmuller = facts.all.find((r) => r.recordId === "wikidata:player-death:Q151284:1984-01-20")!;
  assert.equal(weissmuller.dateNote, "Date disputed: Wikidata also gives January 21, 1984.");
  assert.equal(weissmuller.dateNoteJa, "日付に諸説あり：Wikidataにはほかに1984年1月21日の記載がある。");
  const birthday = facts.all.find((r) => r.recordId === "wikidata:player-birthday:Q151284:1904-06-02")!;
  assert.equal(birthday.dateNote, "Death date disputed: Wikidata also gives January 21, 1984.");
  assert.deepEqual(birthday.deathDateAlternatives, ["1984-01-21"]);
  assert.equal(birthday.dateAlternatives, undefined);
  const socrates = facts.all.find((r) => r.recordId === "wikidata:player-death:Q102331:2011-12-04")!;
  assert.equal(socrates.dateNote, "Birth date disputed: Wikidata also gives February 9, 1954.");
  const record = (extra: Partial<OnThisDayRecord>): OnThisDayRecord => ({ ...weissmuller, ...extra });
  assert.equal(dateNote(record({ dateAlternatives: ["1984-01-19", "1984-01-21"] }), "en"), "Date disputed: Wikidata also gives January 19, 1984 and January 21, 1984.");
  assert.equal(dateNote(record({ dateAlternatives: ["1984-01-19", "1984-01-21", "1984-01-22"] }), "en"), "Date disputed: Wikidata also gives January 19, 1984, January 21, 1984 and January 22, 1984.");
  assert.equal(dateNote(record({ dateAlternatives: ["1984-01-19", "1984-01-21"] }), "ja"), "日付に諸説あり：Wikidataにはほかに1984年1月19日、1984年1月21日の記載がある。");
  assert.equal(dateNote(record({ ageAlternatives: [78, 80] }), "en"), "Date disputed: Wikidata also gives January 21, 1984. The age may also be 78 or 80.");
  assert.equal(dateNote(record({ ageAlternatives: [78] }), "ja"), "日付に諸説あり：Wikidataにはほかに1984年1月21日の記載がある。年齢は78歳の可能性もある。");
  assert.equal(dateNote(record({ dateDisputed: false }), "en"), null);
  assert.equal(dateNote(record({ dateDisputed: true, dateAlternatives: undefined, birthDateAlternatives: undefined, deathDateAlternatives: undefined, ageAlternatives: undefined }), "en"), null);
});

test("an age the dates leave open lists the other ages, and the published age is never one of them", () => {
  const withAge = marked.filter((r) => r.ageAlternatives);
  assert.equal(withAge.length, 100);
  for (const r of withAge) {
    assert.equal(r.category, "player-death", r.recordId);
    assert.ok(r.ageYears != null && !r.ageAlternatives!.includes(r.ageYears), r.recordId);
    assert.deepEqual([...r.ageAlternatives!].sort((a, b) => a - b), [...r.ageAlternatives!], r.recordId);
    assert.match(r.dateNote ?? "", /The age may also be \d+/, r.recordId);
  }
  const ages = (r: OnThisDayRecord, dispute: Disputed): Set<number> => {
    const age = (b: string, d: string): number => Number(d.slice(0, 4)) - Number(b.slice(0, 4)) - (d.slice(5) < b.slice(5) ? 1 : 0);
    return new Set((dispute.birth ?? [r.birthDate!]).flatMap((b) => (dispute.death ?? [r.deathDate!]).map((d) => age(b, d))));
  };
  for (const r of marked.filter((x) => x.category === "player-death" && x.ageYears != null && x.birthDate && x.deathDate)) {
    const every = ages(r, byQid.get(r.person!.qid!)!);
    if (every.size > 1 && every.has(r.ageYears!)) assert.deepEqual(r.ageAlternatives, [...every].filter((a) => a !== r.ageYears).sort((a, b) => a - b), r.recordId);
    else assert.equal(r.ageAlternatives, undefined, r.recordId);
  }
});

const sameMonthDay = (r: OnThisDayRecord): boolean => (r.dateAlternatives ?? []).every((day) => day.slice(5) === r.eventDate!.slice(5));

test("a disputed fact never says today or on this day unless every alternative falls on that month and day", () => {
  const own = marked.filter((r) => r.dateAlternatives);
  const dayIds = new Set(TEMPLATES.filter((t) => t.day).map((t) => t.id));
  assert.ok(dayIds.size > 10);
  let allMatch = 0, someMiss = 0;
  for (const r of own) {
    const asOf = `2026-${r.eventDate!.slice(5)}`;
    const matches = sameMonthDay(r);
    assert.equal(dayContext(r, asOf), matches ? "onThisDay" : "anywhere", r.recordId);
    if (matches) allMatch += 1; else someMiss += 1;
    for (const locale of ["en", "ja"] as const) {
      // Every template of the fact's own day, one after another: none that says "today" may be chosen unless the alternatives allow it.
      const said = [render(r, { wording: "fixed", locale, asOf }), ...["x", "y", "z", "w"].map((seedText) => render(r, { wording: "seeded", seed: seedText, locale, asOf }))];
      for (const sentence of said) {
        assert.ok(sentence, r.recordId);
        if (!matches) {
          assert.ok(!dayIds.has(sentence.templateId), `${r.recordId}: ${sentence.templateId} says today for a date Wikidata gives on another day: ${sentence.text}`);
          assert.doesNotMatch(sentence.text, locale === "en" ? /\b(?:today|on this day|turns \d+)\b/i : /今日|この日|になる/, r.recordId);
        }
      }
      for (const sentence of renderRun([r], { seed: "run", locale, asOf })) if (!matches) assert.ok(!dayIds.has(sentence.templateId), r.recordId);
    }
  }
  assert.ok(someMiss > 300 && allMatch >= 40, `${someMiss} facts with an alternative on another day, ${allMatch} with all on the same month and day`);
  // The same fact, not disputed, does say it: a fixed rule on the alternatives and nothing else.
  const sample = own.find(sameMonthDay)!;
  const asOf = `2026-${sample.eventDate!.slice(5)}`;
  assert.ok(dayIds.has(render(sample, { wording: "fixed", locale: "en", asOf })!.templateId), "all alternatives on the month and day: today wording is allowed");
  const missing = { ...sample, dateAlternatives: [`${sample.eventDate!.slice(0, 4)}-${sample.eventDate!.slice(5, 7)}-${sample.eventDate!.slice(8, 10) === "28" ? "27" : "28"}`] };
  assert.equal(dayContext(missing, asOf), "anywhere");
  assert.ok(!dayIds.has(render(missing, { wording: "fixed", locale: "en", asOf })!.templateId));
  assert.equal(dayContext({ ...sample, dateAlternatives: undefined }, asOf), "onThisDay");
  assert.equal(dayContext({ ...sample, dateAlternatives: [] }, asOf), "onThisDay");
});

test("a fact whose own day is not disputed says today as it did, whatever else it carries", () => {
  // A death fact whose birth is disputed: its own day is certain.
  const socrates = facts.all.find((r) => r.recordId === "wikidata:player-death:Q102331:2011-12-04")!;
  assert.equal(socrates.dateAlternatives, undefined);
  assert.equal(dayContext(socrates, "2026-12-04"), "onThisDay");
  assert.equal(dayContext(socrates, "2026-12-05"), "anywhere");
});

test("a disputed fact in a day shard is on its own day, with its alternatives and its note", () => {
  let seen = 0;
  for (const r of marked) {
    const shard = facts.day(r.eventDate!);
    const inShard = shard.find((x) => x.recordId === r.recordId);
    if (!inShard) continue;
    seen += 1;
    assert.deepEqual(inShard, r);
  }
  assert.ok(seen >= 5, `${seen} disputed facts are in a day shard`);
  // The id names the day the fact is on, as for any fact.
  for (const r of marked) assert.equal(r.recordId.split(":").at(-1), r.eventDate, r.recordId);
});
