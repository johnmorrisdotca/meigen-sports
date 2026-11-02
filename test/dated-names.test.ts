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

test("a club the games do not name is named by the database's dated names: 142 more NHL retirements, none for the fans, the victims or an owner", () => {
  const retired = (id: number) => byId.get(`spx:retired-number:${id}`);
  assert.equal(retired(4897)?.text, "On February 3, 2009, the New York Rangers retired Adam Graves's No. 9.");
  assert.equal(retired(4951)?.clubName, "Minnesota North Stars");
  const nhl = facts.filter((r) => r.category === "retired-number" && r.league === "nhl");
  assert.equal(nhl.length, 177);
  for (const id of [4914, 4958, 4997, 5017]) assert.equal(retired(id), undefined, `${id} honours no player`);
  for (const r of nhl) assert.ok(r.leagueWide || r.clubName, r.recordId);
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
    assert.ok(r.text?.includes(`(${labels[r.league!]})`) || r.category === "game-feat" || (r.category === "franchise-event" && r.text?.includes(`${labels[r.league!]} identity`)), `${r.recordId}: ${r.text}`);
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

test("a franchise identity of the National Association or the American Association names its own league, not MLB", () => {
  const identity = (club: string, date: string) => facts.find((r) => r.category === "franchise-event" && r.clubName?.startsWith(club) && r.eventDate === date);
  assert.equal(identity("Boston Red Stockings", "1871-05-05")?.text, "Boston Red Stockings began this National Association identity on May 5, 1871 in Boston.");
  assert.equal(identity("Cincinnati Red Stockings", "1882-05-02")?.league, "aa");
  assert.equal(identity("Brooklyn Bridegrooms", "1888-04-08")?.competition, "aa");
  assert.ok(identity("Brooklyn Bridegrooms", "1888-04-08")?.tags.includes("league:aa"));
  assert.equal(identity("Boston Red Caps", "1876-04-22")?.league, "mlb");
  assert.equal(identity("Chicago Cubs", "1903-04-16")?.league, "mlb");
  assert.equal(identity("New York Giants", "1885-05-02")?.league, "mlb");
});

test("a game the database has corrected is not published with the old score, and a second game of a doubleheader the database lacks is", () => {
  assert.equal(byId.get("spx:game:4615655"), undefined);
  assert.equal(byId.get("spx:game:4620295"), undefined);
  assert.equal(byId.get("spx:game:1891707")?.text, "On July 6, 2007, Minnesota Twins beat Chicago White Sox 12–0 (MLB).");
  assert.equal(byId.get("spx:final:1891749")?.text, "On October 27, 2008, Philadelphia Phillies beat Tampa Bay Rays 4–3, playoffs (MLB).");
});

test("a building the database has no dated name for, and that took its name later, is left out of an earlier fact: the Celtics' 1968 final is not at Kia Forum", () => {
  const final = facts.find((r) => r.category === "championship-final" && r.league === "nba" && r.eventDate === "1968-05-02");
  assert.ok(final);
  assert.equal(final.venueName, undefined);
  assert.doesNotMatch(final.text ?? "", /Kia Forum/);
  assert.deepEqual(facts.filter((r) => (r.category === "championship-final" || r.category === "all-star") && r.venueName === "Kia Forum" && (r.eventDate ?? "") < "2021").map((r) => r.recordId), []);
});
