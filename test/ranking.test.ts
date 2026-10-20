import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { offline } from "../src/data/offline.ts";
import { bestOfDay, factsFor, rankRecords, significance, tagsOf } from "../src/facts.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

const root = "data/v1/0.1.0/facts";
const shard = (path: string): OnThisDayRecord[] => (JSON.parse(readFileSync(`${root}/${path}`, "utf8")) as { records: OnThisDayRecord[] }).records;
const store: OnThisDayRecord[] = [];
for (const name of readdirSync(`${root}/store`)) store.push(...shard(`store/${name}`));
const competition = (r: OnThisDayRecord): string => r.competition ?? r.league ?? r.category;

test("every day shard keeps to two facts of a tag and two of a competition, when the day allows", () => {
  let strict = 0;
  for (const name of readdirSync(`${root}/days`)) {
    const records = shard(`days/${name}`);
    const tags = new Map<string, number>(), comps = new Map<string, number>();
    for (const r of records) { for (const t of tagsOf(r)) tags.set(t, (tags.get(t) ?? 0) + 1); comps.set(competition(r), (comps.get(competition(r)) ?? 0) + 1); }
    if ([...tags.values(), ...comps.values()].every((n) => n <= 2)) strict += 1;
  }
  assert.ok(strict >= 340, `${strict} of 366 days keep to two`);
});

test("the offline facts for a day are what ranking that day's shard gives: one ranking in both places", () => {
  let same = 0, days = 0;
  for (const name of readdirSync(`${root}/days`)) {
    const day = name.slice(0, 5);
    days += 1;
    const fromShard = bestOfDay(shard(`days/${name}`)).map((r) => r.recordId).sort().join();
    if (fromShard === factsFor(offline, { date: day }).map((r) => r.recordId).sort().join()) same += 1;
  }
  assert.equal(days, 366);
  assert.ok(same >= 360, `${same} days agree`);
});

test("a day's ranking is the same however its facts are ordered, and a list of n heads a longer one", () => {
  const day = store.filter((r) => r.eventDate?.endsWith("-10-19"));
  const a = rankRecords(day, 12), b = rankRecords([...day].reverse(), 12);
  assert.deepEqual(a.map((r) => r.recordId), b.map((r) => r.recordId));
  assert.deepEqual(rankRecords(day, 5).map((r) => r.recordId), a.slice(0, 5).map((r) => r.recordId));
  assert.deepEqual(bestOfDay(day).map((r) => r.recordId), a.slice(0, 5).filter((r, i) => i < 4 || significance(r) >= 85).map((r) => r.recordId));
});

test("famous outranks routine: a world cup final, a title game and a priority athlete beat a plain result", () => {
  const plain = store.find((r) => r.category === "game-on-day" && !r.featuredReasons?.includes("playoff-shutout"))!;
  const wcFinal = store.find((r) => r.league === "wc" && r.stage === "final")!;
  const title = store.find((r) => r.category === "championship-final")!;
  const star = store.find((r) => r.category === "player-birthday" && r.priorityAthlete && r.personAward)!;
  for (const r of [wcFinal, title, star]) assert.ok(significance(r) > significance(plain), r.recordId);
  assert.ok(significance(wcFinal) > significance(store.find((r) => r.league === "wc" && r.stage === "semi")!));
});

test("a list about one thing does not cap it, and the caps relax only to reach the minimum", () => {
  const nba = store.filter((r) => r.league === "nba" && r.category === "championship-final");
  assert.ok(nba.length > 20);
  const clubs = [...new Set(nba.flatMap((r) => [r.home?.franchiseId, r.away?.franchiseId]).map((id) => `f:${id}`))];
  assert.equal(rankRecords(nba, 12, { exempt: ["championship-final", "championship-win", "match-result", "shutout", "competition:nba", ...clubs] }).length, 12);
  assert.ok(rankRecords(nba, 12).length >= 3 && rankRecords(nba, 12).length < 12);
  assert.equal(rankRecords(nba.slice(0, 2), 12).length, 2);
});
