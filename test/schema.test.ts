import assert from "node:assert/strict";
import { test } from "node:test";
import { EXTRACT_CATEGORIES, type OnThisDayRecord, type PersonRef, type TeamRef } from "../src/index.ts";

test("website records name every extract category", () => {
  assert.deepEqual([...EXTRACT_CATEGORIES], [
    "game-on-day", "championship-final", "soccer-on-day", "player-birthday", "player-death",
    "draft", "award", "franchise-event", "venue-opening", "quotation",
  ]);
});

test("a game carries team objects and a stable game id, not just caption text", () => {
  const home: TeamRef = {
    name: "Example Home", franchiseId: 1, teamSeasonId: 10, soccerTeamId: null,
    countryCode: "CA", fifaCode: null, flagCode: "CA",
  };
  const away: TeamRef = {
    name: "Example Away", franchiseId: 2, teamSeasonId: 11, soccerTeamId: null,
    countryCode: "US", fifaCode: null, flagCode: "US",
  };
  const record: OnThisDayRecord = {
    recordId: "spx:game:1", category: "game-on-day", tags: ["match-result"], basis: "source", eventDate: "2023-06-03", datePrecision: "day",
    sport: "ice_hockey", competition: "nhl", league: "nhl", gameId: 1, venueId: 8, seasonStartYear: 2022,
    home, away,
    source: { sourceId: "wikipedia", licence: "CC BY-SA 4.0", attribution: "Wikipedia contributors", url: null },
  };
  assert.equal(record.home?.franchiseId, 1);
  assert.equal(record.away?.teamSeasonId, 11);
  assert.equal(record.gameId, 1);
});

test("a birthday carries person, Wikidata, leagues and team ids", () => {
  const person: PersonRef = {
    personId: 0, qid: "Q0", name: "Example Player",
    leagueCodes: ["nhl"], franchiseIds: [10], teamSeasonIds: [880],
  };
  const record: OnThisDayRecord = {
    recordId: "spx:player-birthday:wikidata:Q0:1963-08-09", category: "player-birthday", tags: ["player-birthday"], basis: "source",
    eventDate: "1963-08-09", datePrecision: "day", sport: null, competition: null, league: "nhl",
    person,
    source: { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors", url: "https://www.wikidata.org/wiki/Q0" },
  };
  assert.equal(record.person?.qid, "Q0");
  assert.deepEqual(record.person?.franchiseIds, [10]);
});
