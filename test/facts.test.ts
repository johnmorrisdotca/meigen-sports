import assert from "node:assert/strict";
import test from "node:test";
import { calendarDayInZone, factsFor, randomFacts, rankFeed, tagsOf, today, uniqueRecordIds } from "../src/facts.ts";
import { captionFromFact, isRichFact } from "../src/sentences.ts";
import { FACT_CATEGORIES } from "../src/schema.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

const source = { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors, CC0.", url: "https://www.wikidata.org/" };

function game(id: string, extra: Partial<OnThisDayRecord> = {}): OnThisDayRecord {
  return {
    recordId: id, category: "game-on-day", tags: ["match-result"], basis: "source", eventDate: "1975-10-16", datePrecision: "day",
    sport: "ice-hockey", competition: "nhl", league: "nhl", seasonStartYear: 1975,
    homeScore: 5, awayScore: 3,
    home: { name: "Montreal Canadiens", franchiseId: 10, teamSeasonId: 100, soccerTeamId: null, countryCode: "CA", fifaCode: null, flagCode: "CA" },
    away: { name: "Boston Bruins", franchiseId: 11, teamSeasonId: 101, soccerTeamId: null, countryCode: "US", fifaCode: null, flagCode: "US" },
    source, ...extra,
  };
}

test("FACT_CATEGORIES keeps extract families and the planned editorial ones", () => {
  assert.ok(FACT_CATEGORIES.includes("championship-final"));
  assert.ok(FACT_CATEGORIES.includes("trade"));
  assert.ok(FACT_CATEGORIES.includes("streak"));
});

test("captions tell who beat whom from scores and drop thin rows", () => {
  const text = captionFromFact(game("g1"));
  assert.equal(text, "On October 16, 1975, Montreal Canadiens beat Boston Bruins 5–3 (NHL).");
  assert.equal(isRichFact(game("g2", { homeScore: null, awayScore: null })), false);
  const ja = captionFromFact(game("g3"), "ja");
  assert.ok(ja?.includes("Montreal Canadiens"));
  assert.ok(ja?.includes("勝利"));
});

test("factsFor intersects team, date, era and category", () => {
  const rows = [
    game("a"),
    game("b", { eventDate: "1999-10-16", seasonStartYear: 1999, league: "mlb", competition: "mlb", sport: "baseball",
      home: { name: "Yankees", franchiseId: 20, teamSeasonId: 200, soccerTeamId: null, countryCode: "US", fifaCode: null, flagCode: "US" } }),
  ];
  assert.equal(factsFor(rows, { team: { franchiseId: 10 } }).map((r) => r.recordId).join(), "a");
  assert.equal(factsFor(rows, { date: "10-16", from: 1990, to: 2000 }).map((r) => r.recordId).join(), "b");
  assert.equal(factsFor(rows, { category: "championship-final" }).length, 0);
});

test("today uses an explicit instant and time zone, not the clock", () => {
  const rows = [game("a", { eventDate: "2000-10-16" })];
  const found = today(rows, "America/Vancouver", "2026-10-16T12:00:00-07:00");
  assert.equal(found.length, 1);
  assert.equal(calendarDayInZone("UTC", "2026-10-16T01:00:00Z"), "10-16");
});

test("a fact is stored once and matches any of its tags", () => {
  const ot = game("ot", { category: "championship-final", tags: ["championship-win", "match-result", "overtime-result"] });
  assert.deepEqual(tagsOf(ot), ["championship-final", "championship-win", "match-result", "overtime-result"]);
  assert.equal(factsFor([ot], { category: "championship-win" })[0]?.recordId, "ot");
  assert.equal(factsFor([ot], { category: "overtime-result" })[0]?.recordId, "ot");
  assert.equal(factsFor([ot], { category: "player-birthday" }).length, 0);
});

test("randomFacts counts a multi-tag fact once and caps two per tag", () => {
  const rows = [
    game("a", { tags: ["championship-win", "overtime-result"] }),
    game("b", { recordId: "b", league: "nba", competition: "nba", tags: ["championship-win"] }),
    game("c", { recordId: "c", league: "mlb", competition: "mlb", tags: ["championship-win"] }),
  ];
  const picked = randomFacts(rows, 10, {}, "seed-tags");
  assert.equal(new Set(picked.map((r) => r.recordId)).size, picked.length);
  assert.ok(picked.length <= 2);
});

test("a multi-tag query never repeats a recordId", () => {
  const ot = game("ot", { category: "championship-final", tags: ["championship-win", "overtime-result"] });
  const pool = [ot, ot];
  const found = factsFor(pool, { category: "championship-win" });
  assert.equal(found.length, 1);
  assert.equal(uniqueRecordIds(found), true);
});

test("birthday captions are anniversaries and never say turns", () => {
  const row: OnThisDayRecord = {
    recordId: "b1", category: "player-birthday", tags: ["player-birthday"], basis: "source",
    eventDate: "1961-01-26", datePrecision: "day", sport: "ice-hockey", competition: "nhl", league: "nhl",
    person: { personId: 1866, qid: "Q209518", name: "Wayne Gretzky", leagueCodes: ["nhl"], franchiseIds: [12], teamSeasonIds: [] },
    clubNames: ["Edmonton Oilers"], position: "C",
    livingStatus: "unknown", source,
  };
  const text = captionFromFact(row);
  assert.equal(text, "Wayne Gretzky, the Edmonton Oilers center, was born on January 26, 1961.");
  assert.equal(/turns|would have turned|celebrates/i.test(text ?? ""), false);
  const dead: OnThisDayRecord = {
    ...row, recordId: "b2", livingStatus: "deceased", deathDate: "1948-08-16",
    person: { personId: 1, qid: "Q1", name: "Babe Ruth", leagueCodes: ["mlb"], franchiseIds: [20], teamSeasonIds: [] },
    clubNames: ["New York Yankees"], position: "OF", sport: "baseball",
    eventDate: "1895-02-06",
  };
  const deadText = captionFromFact(dead);
  assert.equal(deadText, "Babe Ruth, the New York Yankees outfielder, was born on February 6, 1895 (died 1948).");
  assert.equal(/turns|would have turned/i.test(deadText ?? ""), false);
});

test("rankFeed keeps unique ids and mixes people", () => {
  const rows = [
    game("a", { category: "championship-final", tags: ["championship-win", "match-result"] }),
    game("b", { recordId: "b", league: "nba", competition: "nba", tags: ["match-result"] }),
    game("a-dup", { recordId: "a", category: "championship-final", tags: ["overtime-result"] }),
  ];
  const feed = rankFeed(rows, 10);
  assert.equal(uniqueRecordIds(feed), true);
  assert.ok(feed.length >= 1);
});

test("rankFeed prefers a priority athlete among equal deaths", () => {
  const unknown: OnThisDayRecord = {
    recordId: "u", category: "player-death", tags: ["age-at-event"], basis: "source",
    eventDate: "1937-03-08", datePrecision: "day", sport: "ice-hockey", competition: "nhl", league: "nhl",
    person: { personId: 9, qid: "Q9", name: "Unknown Skater", leagueCodes: ["nhl"], franchiseIds: [10], teamSeasonIds: [] },
    clubNames: ["Montreal Canadiens"], position: "F",
    source,
  };
  const famous: OnThisDayRecord = {
    ...unknown, recordId: "f", person: { personId: 2, qid: "Q537941", name: "Howie Morenz", leagueCodes: ["nhl"], franchiseIds: [10], teamSeasonIds: [] },
    priorityAthlete: true,
  };
  const feed = rankFeed([unknown, famous], 1);
  assert.equal(feed[0]?.recordId, "f");
});

test("rankFeed drops name-and-year stubs and Kim 1602", () => {
  const kim: OnThisDayRecord = {
    recordId: "kim", category: "player-death", tags: ["age-at-event"], basis: "source",
    eventDate: "1602-12-13", datePrecision: "day", sport: null, competition: null, league: null,
    person: { personId: 1, qid: "Q704476", name: "Myong-won Kim", leagueCodes: [], franchiseIds: [], teamSeasonIds: [] },
    source,
  };
  const gould: OnThisDayRecord = {
    recordId: "gould", category: "player-birthday", tags: ["player-birthday"], basis: "source",
    eventDate: "1873-10-16", datePrecision: "day", sport: "ice-hockey", competition: "nhl", league: "nhl",
    person: { personId: 3, qid: "Q3", name: "David Gould", leagueCodes: ["nhl"], franchiseIds: [], teamSeasonIds: [] },
    livingStatus: "deceased", deathDate: "1939-01-01", source,
  };
  assert.equal(isRichFact(kim), false);
  assert.equal(isRichFact(gould), false);
  const feed = rankFeed([kim, gould, game("g-rich")], 3);
  assert.deepEqual(feed.map((r) => r.recordId), ["g-rich"]);
});

test("featured record reason ranks with sport records", () => {
  const rec = game("rec", { featuredReasons: ["record"], tags: ["match-result"] });
  const plain = game("plain", { recordId: "plain", league: "nba", competition: "nba", tags: ["match-result"] });
  assert.equal(rankFeed([plain, rec], 1)[0]?.recordId, "rec");
});

test("randomFacts is deterministic for a seed and caps two per category", () => {
  const rows = [game("a"), game("b", { recordId: "b", league: "nba", competition: "nba" }), game("c", { recordId: "c", league: "mlb", competition: "mlb" })];
  const first = randomFacts(rows, 10, {}, "seed-one");
  const second = randomFacts(rows, 10, {}, "seed-one");
  assert.deepEqual(first.map((r) => r.recordId), second.map((r) => r.recordId));
  assert.ok(first.length <= 2);
});
