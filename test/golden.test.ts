import assert from "node:assert/strict";
import test from "node:test";
import { OFFLINE_BUILD, offline } from "../src/data/offline.ts";
import type { OnThisDayRecord } from "../src/schema.ts";
import { COVERED_SPORTS, Facts, MIN_PER_SPORT, NEVER, describe as describeGolden, failures, loadGolden, loadLocked } from "../scripts/golden.ts";

const golden = loadGolden();
const facts = new Facts(`data/v1/${OFFLINE_BUILD.dataVersion}/facts`);
const offlineIds = new Set(offline.map((r) => r.recordId));
const result = failures(golden, facts, offlineIds, loadLocked(), offline);

test("the golden list is sourced, dated and large enough", () => {
  assert.ok(golden.must.length + golden.gaps.length >= 240, `${golden.must.length + golden.gaps.length} golden facts`);
  const ids = new Set<string>();
  for (const e of [...golden.must, ...golden.gaps]) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, e.id);
    assert.ok(e.source.verifiedBy && e.source.checkedOn && (e.source.wikipedia || e.source.wikidata), `${e.id} cites no source`);
    assert.ok(["pre-1920", "1920-1969", "1970-"].includes(e.era), e.id);
  }
  for (const e of golden.must) assert.ok(e.match, `${e.id} has nothing to match`);
});

test("every kind, every era and every data path is covered, and so are women's facts", () => {
  console.log(describeGolden(golden, result.report));
  for (const kind of ["birth", "death", "final", "match", "venue", "award"]) assert.ok((result.report.byKind[kind] ?? 0) >= 4, `kind ${kind}`);
  for (const era of ["pre-1920", "1920-1969", "1970-"]) assert.ok((result.report.byEra[era] ?? 0) >= 10, `era ${era}`);
  for (const path of ["full", "offline", "day", "team", "player"] as const) assert.ok(result.report.byPath[path] >= 40, `path ${path}`);
  assert.ok(result.report.women >= 6);
  const kinds = new Set(golden.gaps.map((g) => g.kind));
  for (const kind of ["record", "draft", "first", "birth", "death", "final"]) assert.ok(kinds.has(kind), `no known gap of kind ${kind}`);
});

test("each sport the dataset covers has at least the minimum of golden facts", () => {
  for (const sport of COVERED_SPORTS) assert.ok((result.report.bySport[sport] ?? 0) >= MIN_PER_SPORT, `${sport}: ${result.report.bySport[sport] ?? 0}`);
});

test("the published data holds every golden fact, right, in the offline set's own build and the full dataset", () => {
  assert.deepEqual(result.problems, []);
});

test("every never-rule fires on a bad fact, so a clean pass means something", () => {
  const base = { recordId: "x:1", category: "player-birthday", tags: [], basis: "source", eventDate: "1980-05-05", datePrecision: "day", sport: "baseball", competition: "mlb", league: "mlb", source: { sourceId: "wikidata", licence: "CC0 1.0", attribution: "", url: null }, text: "A, the C, was born on this day in 1980." } as OnThisDayRecord;
  const bad: Record<string, OnThisDayRecord[]> = {
    "no-person-before-1850": [{ ...base, eventDate: "1602-05-05", person: { qid: "Q1", name: "A", personId: 1, leagueCodes: [], franchiseIds: [], teamSeasonIds: [] } }],
    "sport-matches-league": [{ ...base, sport: "motor-racing" }],
    "no-motor-racing": [{ ...base, sport: "motor-racing", league: null }],
    "award-fits-position": [{ ...base, position: "CF", personAward: "Cy Young Award" }, { ...base, position: "SS", highlight: "Rolaids Relief Man Award winner" }, { ...base, position: "C", personAward: "Vezina Trophy" }],
    "born-before-debut": [{ ...base, birthDate: "1980-05-05", clubNames: ["Boston Red Sox (1975–1980)"] }],
    "birth-before-death": [{ ...base, birthDate: "1980-05-05", deathDate: "1970-01-01" }],
    "born-year-agrees": [{ ...base, birthDate: "1980-05-05", bornYear: 1981 }],
    "nothing-in-the-future": [{ ...base, eventDate: "2999-01-01" }],
    "birthday-wording": [{ ...base, text: "A turns 65 today." }, { ...base, text: "A would have turned 65." }],
    "title-needs-the-last-game": [{ ...base, category: "championship-final", seasonStartYear: 1972, eventDate: "1972-10-14" }, { ...base, recordId: "x:2", category: "championship-final", seasonStartYear: 1972, eventDate: "1972-10-22" }],
    "one-title-game-per-season": [{ ...base, category: "championship-final", seasonStartYear: 1972 }, { ...base, recordId: "x:2", category: "championship-final", seasonStartYear: 1972 }],
    "final-is-not-a-tie": [{ ...base, league: "wc", stage: "final", homeScore: 3, awayScore: 3, text: "A tied B 3–3." }],
    "no-invented-day": [{ ...base, category: "franchise-event", eventDate: "2012-03-01" }],
    "no-sex-or-para-labels": [{ ...base, sport: "para-swimming" }, { ...base, tags: ["women-football"] }],
    "unique-record-ids": [base, base],
    "clean-sentences": [{ ...base, text: "A beat undefined." }, { ...base, text: "No full stop" }, { ...base, text: "A beat Allegheny Club (none) 21–4." }],
    "dated-sentences": [{ ...base, text: "A was born in 1980." }, { ...base, text: "A was born on this day in 1980." }],
  };
  assert.deepEqual(Object.keys(bad).sort(), NEVER.map((r) => r.id).sort(), "a rule has no bad example");
  for (const rule of NEVER) assert.ok(rule.violations(bad[rule.id]!, "2026-10-19").length > 0, `${rule.id} did not fire`);
  for (const rule of NEVER) assert.deepEqual(rule.violations([{ ...base, text: "A, the C, was born on May 5, 1980." }], "2026-10-19"), [], `${rule.id} fired on a clean fact`);
});

test("an award fits its position: a pitcher's Cy Young, a goaltender's Vezina; an unknown position or another award is not charged", () => {
  const rule = NEVER.find((r) => r.id === "award-fits-position")!;
  const fact = { recordId: "x:1", category: "player-birthday", tags: [], basis: "source", eventDate: "1980-05-05", datePrecision: "day", sport: "baseball", competition: null, league: "mlb", source: { sourceId: "wikidata", licence: "CC0 1.0", attribution: "", url: null } } as OnThisDayRecord;
  assert.deepEqual(rule.violations([{ ...fact, position: "P", personAward: "Cy Young Award" }, { ...fact, recordId: "x:2", position: "RHP", personAward: "Cy Young Award" }, { ...fact, recordId: "x:3", position: "G", personAward: "Vezina Trophy" }], ""), []);
  assert.deepEqual(rule.violations([{ ...fact, personAward: "Cy Young Award" }, { ...fact, recordId: "x:4", position: "CF", personAward: "Major League Baseball Most Valuable Player Award" }, { ...fact, recordId: "x:5", position: "C", personAward: "James Norris Memorial Trophy" }], ""), []);
  assert.equal(rule.violations([{ ...fact, position: "CF", personAward: "Cy Young Award" }], "").length, 1);
});

test("a missing, wrong or lost golden fact is reported", () => {
  const trimmed = { ...golden, must: [...golden.must, { ...golden.must[0]!, id: "fake", date: "2000-01-01" }] };
  const out = failures(trimmed, facts, offlineIds, { [golden.must[0]!.id]: [] }, offline);
  assert.ok(out.problems.some((p) => p.startsWith("MISSING") && p.includes("fake")));
  const wrongWinner = { ...golden, must: golden.must.map((e) => e.match?.winner ? { ...e, match: { ...e.match, winner: "Nobody At All" } } : e) };
  assert.ok(failures(wrongWinner, facts, offlineIds, {}, offline).problems.some((p) => p.startsWith("WRONG")));
  const asked = { ...golden, gaps: [{ ...golden.must.find((e) => e.kind === "birth")! , id: "now-present" }] };
  assert.ok(failures(asked, facts, offlineIds, {}, offline).problems.some((p) => p.includes("now present")));
  const thin = { ...golden, must: golden.must.filter((e) => e.sport !== "soccer") };
  assert.ok(failures(thin, facts, offlineIds, {}, offline).problems.some((p) => p.includes("golden facts for soccer")));
  const notOffline = result.report.rankingGaps[0]!.split(" ")[0]!;
  assert.ok(failures(golden, facts, offlineIds, { [notOffline]: ["offline"] }, offline).problems.some((p) => p.startsWith("LOST") && p.includes(notOffline)));
});
