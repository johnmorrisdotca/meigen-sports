import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import type { OnThisDayRecord } from "../src/index.ts";

const dir = "data/v1/0.1.0/facts/store";
const facts = readdirSync(dir).flatMap((name) => (JSON.parse(readFileSync(`${dir}/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records);
const byId = new Map(facts.map((r) => [r.recordId, r]));

test("a retired number names the club as it was called that day, not the franchise's first name", () => {
  const retired = (id: number) => byId.get(`spx:retired-number:${id}`);
  assert.equal(retired(4881)?.clubName, "Colorado Avalanche");
  assert.equal(retired(4881)?.text, "On November 2, 2013, the Colorado Avalanche retired Adam Foote's No. 52.");
  const nhl = facts.filter((r) => r.category === "retired-number" && r.league === "nhl");
  assert.deepEqual(nhl.filter((r) => /Quebec Nordiques|New England Whalers/.test(r.clubName ?? "") && (r.eventDate ?? "") >= "1996-01-01").map((r) => r.text), []);
  assert.ok(nhl.some((r) => r.clubName === "Carolina Hurricanes" && r.person?.name === "Ron Francis"));
});

test("a final or an All-Star Game names the building as it was called that year", () => {
  const text = (league: string, category: string, year: string) => facts.filter((r) => r.league === league && r.category === category && r.eventDate?.startsWith(year)).map((r) => r.text ?? "");
  assert.match(text("nba", "championship-final", "1995")[0], /Game 4 at The Summit, Houston/);
  assert.match(text("cfl", "championship-final", "1989")[0], /at SkyDome, Toronto/);
  assert.match(text("nfl", "championship-final", "1995")[0], /at Joe Robbie Stadium, Miami Gardens/);
  assert.match(text("mlb", "championship-final", "1917")[0], /Game 6 at Brush Stadium, New York City/);
  const today = ["Lakewood Church Central Campus", "Rogers Centre", "Hard Rock Stadium", "Kaseya Center", "Rocket Arena"];
  for (const r of facts.filter((x) => (x.category === "championship-final" || x.category === "all-star") && x.venueName && x.eventDate && x.eventDate < "1995-01-01")) {
    assert.ok(!today.includes(r.venueName!), `${r.recordId}: ${r.venueName} in ${r.eventDate!.slice(0, 4)}`);
  }
});

test("games of the National Association, American Association, Union Association, Players' League and Federal League are labelled by their own league, not MLB", () => {
  const family = ["na", "aa", "ua", "pl", "fl"];
  const labels: Record<string, string> = { na: "National Association", aa: "American Association", ua: "Union Association", pl: "Players' League", fl: "Federal League" };
  const games = facts.filter((r) => family.includes(r.league ?? ""));
  for (const code of family) assert.ok(games.some((r) => r.league === code), `a ${code} fact`);
  for (const r of games) {
    assert.equal(r.sport, "baseball", r.recordId);
    assert.equal(r.competition, r.league, r.recordId);
    assert.ok(r.tags.includes(`league:${r.league}`) && !r.tags.includes("league:mlb"), r.recordId);
    assert.ok(r.text?.includes(`(${labels[r.league!]})`) || r.category === "game-feat", `${r.recordId}: ${r.text}`);
    assert.doesNotMatch(r.text ?? "", /\(MLB\)/, r.recordId);
  }
  const first = byId.get("spx:game:1714236");
  assert.equal(first?.league, "na");
  assert.equal(first?.text, "On June 1, 1874, Philadelphia White Stockings beat Brooklyn Atlantics 10–0 (National Association).");
  const lafitte = facts.find((r) => r.category === "game-feat" && r.text?.includes("Ed Lafitte"));
  assert.equal(lafitte?.league, "fl");
  const mlbEarly = facts.filter((r) => r.league === "mlb" && r.sport === "baseball" && (r.eventDate ?? "9999") < "1876" && (r.category === "game-on-day" || r.category === "game-feat"));
  assert.deepEqual(mlbEarly.map((r) => r.text), []);
});
