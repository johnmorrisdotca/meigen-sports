import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { captionFromFact } from "../src/index.ts";
import type { OnThisDayRecord } from "../src/index.ts";

const dir = "data/v1/0.1.0/facts/store";
const facts = readdirSync(dir).flatMap((name) => (JSON.parse(readFileSync(`${dir}/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records);
const stars = facts.filter((r) => r.category === "all-star");
const feats = facts.filter((r) => r.category === "game-feat");

test("All-Star Games of five leagues: a played event, a day, English Wikipedia as the source, a result only for a decided game", () => {
  assert.ok(stars.length >= 330, `${stars.length} All-Star Games`);
  assert.deepEqual([...new Set(stars.map((r) => r.league))].sort(), ["cfl", "mlb", "nba", "nfl", "nhl"]);
  for (const r of stars) {
    assert.match(r.eventDate ?? "", /^\d{4}-\d{2}-\d{2}$/, r.recordId);
    assert.equal(`${r.source.sourceId} ${r.source.licence}`, "wikipedia CC BY-SA 4.0", r.recordId);
    assert.equal(r.competition, "all-star", r.recordId);
    assert.doesNotMatch(`${r.venueName ?? ""} ${r.venueCity ?? ""}`, /cancel|[*†‡]/i, r.recordId);
    if (r.winnerName) {
      assert.ok(r.loserName && r.winnerScore != null && r.loserScore != null && r.winnerScore > r.loserScore, r.recordId);
      assert.ok(r.text?.includes(`${r.winnerScore}–${r.loserScore}`), r.recordId);
    } else {
      assert.equal(r.loserName, undefined, r.recordId);
    }
    assert.equal(r.text, captionFromFact(r, "en"), r.recordId);
    assert.ok(r.textJa?.includes("オールスター") || r.textJa?.includes("プロボウル"), r.recordId);
  }
  assert.equal(new Set(stars.map((r) => r.recordId)).size, stars.length);
});

test("famous All-Star Games: the 2024 NHL game, the 1962 MLB game at D.C. Stadium, the 2021 Pro Bowl that was cancelled", () => {
  const nhl = stars.find((r) => r.eventDate === "2024-02-03" && r.league === "nhl")!;
  assert.equal(nhl.text, "On February 3, 2024, the NHL All-Star Game was played at Scotiabank Arena, Toronto, Ontario; Team Matthews beat Team McDavid 7–4; Auston Matthews was named most valuable player.");
  assert.ok(stars.some((r) => r.league === "mlb" && r.eventDate === "1962-07-10"));
  assert.ok(stars.some((r) => r.league === "mlb" && r.eventDate === "1962-07-30"), "the second game of that year");
  assert.equal(stars.some((r) => r.league === "nfl" && r.eventDate === "2021-01-31"), false);
});

test("no-hitters and perfect games are counted from Retrosheet's logs, with a pitcher only when one pitched the whole game", () => {
  assert.ok(feats.length >= 280, `${feats.length} feats`);
  const perfect = feats.filter((r) => r.feat === "perfect-game");
  assert.ok(perfect.length >= 20, `${perfect.length} perfect games`);
  for (const r of feats) {
    assert.equal(`${r.source.sourceId} ${r.source.licence}`, "retrosheet LicenseRef-Retrosheet", r.recordId);
    assert.ok(r.clubName && r.opponentName && r.clubName !== r.opponentName, r.recordId);
    assert.ok(r.pitchersUsed != null && r.pitchersUsed >= 1, r.recordId);
    if (r.pitcherName) assert.equal(r.pitchersUsed, 1, `${r.recordId}: a named pitcher pitched the whole game`);
    if (r.feat === "perfect-game") assert.equal(r.opponentScore, 0, r.recordId);
    assert.equal(r.text, captionFromFact(r, "en"), r.recordId);
  }
  const larsen = perfect.find((r) => r.eventDate === "1956-10-08")!;
  assert.equal(larsen.text, "On October 8, 1956, Don Larsen of the New York Yankees pitched a perfect game against the Brooklyn Dodgers, winning 2–0 in the World Series.");
  const cain = perfect.find((r) => r.eventDate === "2012-06-13")!;
  assert.equal(cain.pitcherName, "Matt Cain");
  assert.equal(feats.find((r) => r.eventDate === "2003-06-11")?.text, "On June 11, 2003, the Houston Astros combined to no-hit the New York Yankees, winning 8–0.");
});
