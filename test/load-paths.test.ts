import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { loadFactCategory, loadFactDay, loadFactPeopleDay, loadFactShard, loadLeague, loadPlayerBucket, loadTeamFacts } from "../src/load.ts";

/** A fetch that serves the committed files and records every address, so a wrong path is a failing test, not a 404 on Pages. */
function diskFeed() {
  const asked: string[] = [];
  const fetch = async (href: string): Promise<Response> => {
    asked.push(href);
    const path = new URL(href).pathname.replace(/^\/meigen\//, "");
    if (!existsSync(path)) return new Response("not found", { status: 404 });
    return new Response(readFileSync(path, "utf8"), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { asked, options: { baseUrl: "https://example.test/meigen/", dataVersion: "0.1.0", fetch } };
}

test("league, team and player shards are requested under facts/feeds/ and exist", async () => {
  const feed = diskFeed();
  const league = await loadLeague("nhl", feed.options);
  const team = await loadTeamFacts(1403, feed.options);
  const player = await loadPlayerBucket(100, feed.options);
  const tag = await loadFactCategory("player-birthday", feed.options);
  const day = await loadFactDay("2026-01-26", feed.options);
  for (const shard of [league, team, player, tag, day]) assert.ok(shard.records.length > 0);
  assert.deepEqual(feed.asked.map((href) => new URL(href).pathname), [
    "/meigen/data/v1/0.1.0/facts/feeds/leagues/nhl.json",
    "/meigen/data/v1/0.1.0/facts/feeds/teams/f-1403.json",
    "/meigen/data/v1/0.1.0/facts/feeds/players/00.json",
    "/meigen/data/v1/0.1.0/facts/feeds/tags/player-birthday.json",
    "/meigen/data/v1/0.1.0/facts/days/01-26.json",
  ]);
});

test("a day's people and a sport's feed are requested under facts/ and hold people of many sports", async () => {
  const feed = diskFeed();
  const people = await loadFactPeopleDay("2026-10-20", feed.options);
  const sport = await loadFactShard("feeds/sports/tennis.json", feed.options);
  assert.ok(people.records.length >= 20 && people.records.length <= 40, `${people.records.length} people on October 20`);
  assert.ok(people.records.every((r) => r.eventDate?.endsWith("-10-20") && (r.category === "player-birthday" || r.category === "player-death")));
  const sports = new Map<string, number>();
  for (const r of people.records) sports.set(r.sport ?? "", (sports.get(r.sport ?? "") ?? 0) + 1);
  assert.ok(sports.size >= 10, `${sports.size} sports on October 20`);
  assert.ok([...sports.values()].every((n) => n <= 3), "at most three of one sport");
  assert.ok(sport.records.length > 0 && sport.records.every((r) => r.sport === "tennis"));
  assert.deepEqual(feed.asked.map((href) => new URL(href).pathname), [
    "/meigen/data/v1/0.1.0/facts/people/10-20.json",
    "/meigen/data/v1/0.1.0/facts/feeds/sports/tennis.json",
  ]);
});
