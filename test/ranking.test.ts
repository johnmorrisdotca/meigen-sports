import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { offline } from "../src/data/offline.ts";
import { bestOfDay, factsFor, rankDay, rankRecords, significance, tagsOf } from "../src/facts.ts";
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

const fact = (id: string, sport: string, over: Partial<OnThisDayRecord> = {}): OnThisDayRecord => ({
  recordId: id, category: `kind-${id}` as never, tags: [], basis: "source", eventDate: "2000-10-20", datePrecision: "day", sport, competition: `c-${id}`, league: null,
  source: { sourceId: "wikidata", licence: "CC0 1.0", attribution: "", url: null }, ...over,
}) as OnThisDayRecord;

test("a day's list takes at most three facts of one sport, and relaxes only to reach the minimum", () => {
  const baseball = ["a", "b", "c", "d", "e", "f"].map((id, i) => fact(id, "baseball", { homeScore: 9 - i, awayScore: 0 }));
  const others = [fact("t", "tennis", { homeScore: 1, awayScore: 0 }), fact("s", "soccer", { homeScore: 1, awayScore: 0 })];
  const list = rankDay([...baseball, ...others], 12);
  assert.equal(list.filter((r) => r.sport === "baseball").length, 3, "three baseball facts, no more");
  assert.deepEqual(list.map((r) => r.sport).sort(), ["baseball", "baseball", "baseball", "soccer", "tennis"]);
  // A quiet day of one sport still reaches the minimum of three: the cap relaxes, in the same steps as the others.
  assert.equal(rankDay(baseball.slice(0, 5), 12).length, 3, "a day of one sport keeps the cap: three is the minimum, so nothing relaxes");
  assert.equal(rankDay(baseball.slice(0, 2), 12).length, 2);
  const oneSportTwoKinds = [...baseball.slice(0, 2), fact("g", "baseball", { category: "kind-a" as never }), fact("h", "baseball", { category: "kind-a" as never })];
  assert.equal(rankDay(oneSportTwoKinds, 12).length, 3, "the cap is reached at three while the minimum is met");
  assert.equal(rankRecords(baseball, 12).length, 6, "without the option nothing is capped by sport");
  // The minimum wins over the cap: two tennis facts and five baseball facts, minimum five, so the sport cap relaxes by one step at a time.
  const quiet = [...baseball.slice(0, 5), others[0]!];
  assert.equal(rankRecords(quiet, 12, { maxPerSport: 3, minimum: 5 }).length, 5);
  assert.equal(rankRecords(quiet, 12, { maxPerSport: 3, minimum: 5 }).filter((r) => r.sport === "baseball").length, 4, "relaxed to four, not to all five");
});

test("the sport cap is on every day shard and every offline day, whenever the day has the facts to allow it", () => {
  let capped = 0, over = 0;
  for (const name of readdirSync(`${root}/days`)) {
    const bySport = new Map<string, number>();
    const records = shard(`days/${name}`);
    for (const r of records) bySport.set(r.sport ?? "", (bySport.get(r.sport ?? "") ?? 0) + 1);
    capped += 1;
    const sports = new Set(store.filter((r) => r.eventDate?.slice(5) === name.slice(0, 5)).map((r) => r.sport));
    if (Math.max(...bySport.values()) > 3 && sports.size >= 3 && records.length >= 6) over += 1;
  }
  assert.equal(capped, 366);
  assert.ok(over <= 6, `${over} days list more than three facts of one sport although the day has other sports`);
  assert.ok(offline.length >= 3 * 366 - 10);
});

test("a Hall of Fame year, a long list of own awards and a name on the priority list are fame; a thin priority fill counts for less", () => {
  const person = (over: Partial<OnThisDayRecord>): OnThisDayRecord => fact("p", "ice-hockey", { category: "player-birthday", ...over });
  const plain = significance(person({}));
  assert.equal(significance(person({ hallOfFameYear: 1999 })) - plain, 25);
  assert.equal(significance(person({ awardCount: 12 })) - plain, 15);
  assert.equal(significance(person({ awardCount: 5 })) - plain, 8);
  assert.equal(significance(person({ awardCount: 1 })) - plain, 0);
  assert.equal(significance(person({ priorityAthlete: true })) - plain, 45);
  assert.equal(significance(person({ priorityAthlete: true, sitelinks: 6 })) - plain, 20);
  assert.equal(significance(person({ priorityAthlete: true, sitelinks: 60 })) - plain, 45 + 15);
});
