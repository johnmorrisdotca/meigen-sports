import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { loadFactCategory, loadFactDay, loadLeague, loadPlayerBucket, loadTeamFacts } from "../src/load.ts";

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
