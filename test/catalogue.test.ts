import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCatalogue, CALENDAR_DAYS, readCatalogueSources, THRESHOLDS } from "../scripts/catalogue.ts";
import { loadFacts } from "../scripts/offline.ts";
import { convertSeed } from "../scripts/data.ts";
import { OFFLINE_BUILD, offline } from "../src/data/offline.ts";
import { VERSION } from "../src/version.ts";
import type { Catalogue } from "../src/catalogue.ts";

const file = `data/v1/${OFFLINE_BUILD.dataVersion}/catalogue.json`;
const catalogue = JSON.parse(readFileSync(file, "utf8")) as Catalogue;
const { records: facts } = loadFacts(OFFLINE_BUILD.dataVersion);
const sum = (counts: Readonly<Record<string, number>>): number => Object.values(counts).reduce((a, b) => a + b, 0);

test("the committed catalogue is exactly what the build counts from the facts", () => {
  const { quotes, history } = convertSeed();
  const built = buildCatalogue({ facts, records: [...quotes, ...history], offline, offlineBuild: OFFLINE_BUILD, packageVersion: VERSION, ...readCatalogueSources() });
  assert.deepEqual(JSON.parse(JSON.stringify(built)), catalogue, "run `pnpm data` and commit data/v1/0.1.0/catalogue.json");
});

test("every count adds up to the facts, counted again here a different way", () => {
  assert.equal(catalogue.totals.facts, facts.length);
  assert.equal(catalogue.totals.facts, OFFLINE_BUILD.factsRecords);
  for (const name of ["byKind", "bySport", "byLeague", "byDecade", "byYear"] as const) assert.equal(sum(catalogue[name]), facts.length, name);
  assert.equal(sum(catalogue.sources.reduce((all, s) => ({ ...all, [s.sourceId]: s.facts }), {})), facts.length);
  assert.equal(catalogue.byKind["player-birthday"], facts.filter((f) => f.category === "player-birthday").length);
  assert.equal(catalogue.bySport["baseball"], facts.filter((f) => f.sport === "baseball").length);
  assert.equal(catalogue.byYear["1962"], facts.filter((f) => f.eventDate?.startsWith("1962-")).length);
  assert.equal(catalogue.languages.en, facts.filter((f) => f.text).length);
  assert.equal(catalogue.languages.both, facts.filter((f) => f.text && f.textJa).length);
});

test("the 366 days: each count, the least, the most, the empty and the thin ones", () => {
  const { days } = catalogue;
  assert.equal(days.perDay.length, 366);
  assert.equal(CALENDAR_DAYS[59], "02-29");
  assert.equal(sum(Object.fromEntries(days.perDay.map((n, i) => [String(i), n]))), facts.length);
  assert.equal(days.perDay[CALENDAR_DAYS.indexOf("12-25")], facts.filter((f) => f.eventDate?.slice(5) === "12-25").length);
  assert.equal(days.min.facts, Math.min(...days.perDay));
  assert.equal(days.max.facts, Math.max(...days.perDay));
  assert.deepEqual(days.thin, CALENDAR_DAYS.filter((_, i) => days.perDay[i]! < THRESHOLDS.day));
  assert.deepEqual(days.empty, CALENDAR_DAYS.filter((_, i) => days.perDay[i] === 0));
});

test("people: each person once, deceased only with a death, never 'living'", () => {
  const ids = new Set(facts.filter((f) => f.category === "player-birthday" || f.category === "player-death").map((f) => f.person?.qid));
  assert.equal(catalogue.people.total, ids.size);
  const dead = new Set(facts.filter((f) => f.category === "player-death" || f.livingStatus === "deceased").map((f) => f.person?.qid));
  assert.equal(catalogue.people.deceased, [...ids].filter((id) => dead.has(id)).length);
  assert.equal(catalogue.people.deceased + catalogue.people.notKnownDeceased, catalogue.people.total);
  assert.equal(sum(Object.fromEntries(Object.entries(catalogue.people.bySport).map(([k, v]) => [k, v.total]))), catalogue.people.total);
  assert.ok(!JSON.stringify(catalogue).includes('"living"'));
});

test("events, sources, quotations and the offline set", () => {
  const items = new Set(facts.filter((f) => f.category === "sport-event" || f.category === "competition-start" || f.category === "competition-end").map((f) => f.wikidata));
  assert.equal(catalogue.events.total, items.size);
  assert.equal(sum(catalogue.events.bySport), items.size);
  for (const s of catalogue.sources) assert.ok(s.licence && s.attribution, s.sourceId);
  assert.equal(catalogue.quotations.total, sum(catalogue.quotations.bySource));
  assert.equal(catalogue.offline.records, offline.length);
  assert.equal(catalogue.offline.days, OFFLINE_BUILD.days);
  assert.equal(catalogue.factsManifestSha256, OFFLINE_BUILD.factsManifestSha256);
  assert.equal(catalogue.package, VERSION);
  assert.equal(catalogue.offline.shareOfFacts, Math.round((offline.length / facts.length) * 10000) / 10000);
});

test("the gaps are the things below the thresholds, and each note has both languages and a known status", () => {
  const { gaps } = catalogue;
  for (const [sport, n] of Object.entries(gaps.thinSports)) assert.ok(n < gaps.thresholds.sport && n === catalogue.bySport[sport], sport);
  for (const [league, n] of Object.entries(gaps.thinLeagues)) assert.ok(n < gaps.thresholds.league && n === catalogue.byLeague[league], league);
  for (const [decade, n] of Object.entries(gaps.thinDecades)) assert.ok(n < gaps.thresholds.decade && n === catalogue.byDecade[decade], decade);
  assert.ok(Object.keys(gaps.thinDecades).includes("1850s"));
  assert.ok(gaps.notes.length >= 4);
  for (const note of gaps.notes) {
    assert.ok(["partial", "waiting", "not-planned"].includes(note.status), note.id);
    assert.ok(note.en.length > 20 && /[぀-ヿ]/.test(note.ja), note.id);
  }
  const rules = new Set(catalogue.rules.map((r) => r.id));
  for (const id of ["fame", "sensitive", "death-unknown"]) assert.ok(rules.has(id), id);
  assert.match(catalogue.rules.find((r) => r.id === "sensitive")!.en, /ethnicity, religion, health/);
});

test("the package carries the catalogue and names it as an entry", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { exports: Record<string, string>; files: string[] };
  assert.equal(pkg.exports["./catalogue.json"], `./${file}`);
  assert.ok(pkg.files.includes(file));
});
