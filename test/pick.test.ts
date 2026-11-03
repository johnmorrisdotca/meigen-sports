import assert from "node:assert/strict";
import test from "node:test";
import { OFFLINE_BUILD, offline } from "../src/data/offline.ts";
import { factsFor, pickFacts, rankFeed, significance } from "../src/facts.ts";
import type { FactFilters, OnThisDayRecord } from "../src/schema.ts";
import { Facts, find, loadGolden } from "../scripts/golden.ts";

const facts = new Facts(`data/v1/${OFFLINE_BUILD.dataVersion}/facts`);
const golden = loadGolden();
const byDay = new Map<string, OnThisDayRecord[]>();
for (const r of facts.all) if (r.datePrecision === "day" && r.eventDate) byDay.set(r.eventDate.slice(5), [...(byDay.get(r.eventDate.slice(5)) ?? []), r]);
const ids = (rows: readonly OnThisDayRecord[]): string[] => rows.map((r) => r.recordId);
const day = (md: string): OnThisDayRecord[] => byDay.get(md)!;
const FILTERS: Record<string, FactFilters> = {
  nhl: { league: "nhl" }, nba: { league: "nba" }, mlb: { league: "mlb" }, nfl: { league: "nfl" }, cfl: { league: "cfl" },
  "ice hockey": { sport: "ice-hockey" }, "Detroit Red Wings": { team: { franchiseId: 1408 } },
};

test("a seed gives the same picks every time, another seed other picks, and random and mixed need a seed", () => {
  const md = "07-07";
  for (const mode of ["random", "mixed"] as const) {
    const a = pickFacts(day(md), { date: md, n: 5, mode, seed: "morning" }), b = pickFacts([...day(md)].reverse(), { date: md, n: 5, mode, seed: "morning" });
    assert.deepEqual(ids(a), ids(b), `${mode}: the same seed`);
    assert.equal(a.length, 5);
    assert.equal(new Set(ids(a)).size, 5);
    const others = new Set(Array.from({ length: 8 }, (_, i) => ids(pickFacts(day(md), { date: md, n: 5, mode, seed: `seed-${i}` })).join()));
    assert.ok(others.size > 1, `${mode}: a new seed gives new picks`);
    assert.throws(() => pickFacts(day(md), { date: md, n: 5, mode }), RangeError);
  }
  assert.deepEqual(ids(pickFacts(day(md), { date: md, n: 5 })), ids(pickFacts(day(md), { date: md, n: 5, mode: "ranked" })), "ranked needs no seed and is the default");
  assert.throws(() => pickFacts(day(md), { n: -1 }), RangeError);
  assert.throws(() => pickFacts(day(md), { n: 3, mode: "mixed", fixed: 4, seed: "s" }), RangeError);
  assert.throws(() => pickFacts(day(md), { mode: "shuffled" as never }), RangeError);
});

test("mixed keeps the most famous fixed: its first picks are the ranked picks whatever the seed, the rest are drawn from the pool", () => {
  for (const md of ["01-13", "03-31", "07-29", "12-15"]) {
    const ranked = pickFacts(day(md), { date: md, n: 3 });
    for (const seed of ["a", "b", "c"]) {
      const mixed = pickFacts(day(md), { date: md, n: 6, mode: "mixed", fixed: 3, seed });
      assert.deepEqual(ids(mixed).slice(0, 3), ids(ranked), `${md} ${seed}`);
      assert.equal(new Set(ids(mixed)).size, mixed.length);
      assert.ok(mixed.length >= 5, `${md}: ${mixed.length} picks`);
    }
    assert.equal(pickFacts(day(md), { date: md, n: 4, mode: "mixed", fixed: 4, seed: "x" }).map((r) => r.recordId).join(), ids(pickFacts(day(md), { date: md, n: 4 })).join(), "all fixed is ranked");
  }
});

test("golden facts win in ranked mode and in the fixed part of mixed: a golden fact of the bundled offline set is in the day's ranked pick", () => {
  let checked = 0;
  for (const entry of golden.must) {
    const record = find(entry, facts.all);
    if (!record || !offline.some((r) => r.recordId === record.recordId)) continue;
    const md = entry.date.slice(5);
    assert.ok(ids(pickFacts(day(md), { date: md, n: 8 })).includes(record.recordId), `${entry.id} is not in the ranked pick of ${md}`);
    checked += 1;
  }
  assert.ok(checked > 200, `${checked} golden facts checked`);
});

test("the pool is filtered first and ranked after: a fact far down the overall ranking is first in its narrow filter", () => {
  let farDown = 0, days = 0;
  for (const [name, filters] of Object.entries(FILTERS)) {
    for (const [md, rows] of byDay) {
      const pool = factsFor(rows, { ...filters, date: md });
      if (!pool.length) continue;
      const pick = pickFacts(rows, { date: md, filters, n: 5 });
      days += 1;
      if (!pick.length) continue;
      const best = Math.max(...pool.filter((r) => rankFeed([r], 1).length).map(significance));
      assert.equal(significance(pick[0]!), best, `${name} ${md}: the first pick is not the most famous of the filter`);
      for (const r of pick) assert.ok(factsFor([r], filters).length === 1, `${name} ${md}: a pick outside the filter`);
      if (!ids(rankFeed(rows, 10, { maxPerSport: 3 })).includes(pick[0]!.recordId)) farDown += 1;
    }
  }
  assert.ok(days > 1500);
  assert.ok(farDown > 300, `${farDown} first picks of a filter were outside the overall top ten`);
});

test("Damon Allen tops the CFL on his day, Gordie Howe the NHL and his club, though neither leads the overall day", () => {
  const cfl = pickFacts(day("07-29"), { date: "07-29", filters: FILTERS.cfl, n: 5 });
  assert.equal(cfl[0]!.person?.qid, "Q5212802");
  const nhl = pickFacts(day("03-31"), { date: "03-31", filters: FILTERS.nhl, n: 5 });
  assert.equal(nhl[0]!.person?.qid, "Q358519");
  const club = pickFacts(day("03-31"), { date: "03-31", filters: FILTERS["Detroit Red Wings"], n: 5 });
  assert.equal(club[0]!.person?.qid, "Q358519");
  assert.ok(club.length >= 2);
});

test("with a filter on, the golden facts of that filter are among its first eight picks of their day, and nearly all among the first five", () => {
  const checks: Record<string, (r: OnThisDayRecord) => boolean> = {
    nhl: (r) => (r.person?.leagueCodes ?? []).includes("nhl") || r.league === "nhl",
    nba: (r) => (r.person?.leagueCodes ?? []).includes("nba") || r.league === "nba",
    mlb: (r) => (r.person?.leagueCodes ?? []).includes("mlb") || r.league === "mlb",
    nfl: (r) => (r.person?.leagueCodes ?? []).includes("nfl") || r.league === "nfl",
    cfl: (r) => (r.person?.leagueCodes ?? []).includes("cfl") || r.league === "cfl",
  };
  const missed: string[] = [];
  let total = 0, missedFive = 0;
  for (const [name, belongs] of Object.entries(checks)) {
    let seen = 0;
    for (const entry of golden.must) {
      const record = find(entry, facts.all);
      if (!record || !belongs(record)) continue;
      const md = entry.date.slice(5);
      seen += 1;
      total += 1;
      if (!ids(pickFacts(day(md), { date: md, filters: FILTERS[name]!, n: 5 })).includes(record.recordId)) missedFive += 1;
      if (!ids(pickFacts(day(md), { date: md, filters: FILTERS[name]!, n: 8 })).includes(record.recordId)) missed.push(`${name} ${entry.id}`);
    }
    assert.ok(seen >= 5, `${name}: only ${seen} golden facts`);
  }
  assert.deepEqual(missed, [], "every golden fact of a filter is in its first eight");
  assert.ok(missedFive <= total * 0.05, `${missedFive} of ${total} are outside the first five`);
});

test("the Pages picks of a league and a day are the filter-first ranking: what pickFacts gives, most famous first", async () => {
  const { loadFactPicks } = await import("../src/load.ts");
  const store = new Map(facts.all.map((r) => [r.recordId, r]));
  const fetchFeed = async (url: string): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> => {
    const path = new URL(url).pathname.split(`/data/v1/${OFFLINE_BUILD.dataVersion}/`)[1]!;
    const body = path.startsWith("facts/store/")
      ? { schemaVersion: 1, dataVersion: OFFLINE_BUILD.dataVersion, records: [...store.values()].filter((r) => path === `facts/store/${storeBucket(r.recordId)}.json`) }
      : (await import("node:fs")).existsSync(`data/v1/${OFFLINE_BUILD.dataVersion}/${path}`) ? JSON.parse((await import("node:fs")).readFileSync(`data/v1/${OFFLINE_BUILD.dataVersion}/${path}`, "utf8")) : null;
    return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 404, json: async () => null };
  };
  const { storeBucket } = await import("../src/load.ts");
  const options = { baseUrl: "https://example.test/", dataVersion: OFFLINE_BUILD.dataVersion, fetch: fetchFeed };
  for (const [league, md] of [["nhl", "03-31"], ["cfl", "07-29"], ["nba", "07-07"], ["mlb", "04-18"], ["nfl", "01-27"]] as const) {
    const loaded = await loadFactPicks({ league }, md, options);
    assert.deepEqual(ids(loaded).slice(0, 8), ids(pickFacts(day(md), { date: md, filters: { league }, n: 24 })).slice(0, 8), `${league} ${md}`);
    assert.ok(loaded.length >= 3 && loaded.length <= 24, `${league} ${md}: ${loaded.length}`);
  }
  assert.equal((await loadFactPicks({ league: "nhl" }, "03-31", options))[0]!.person?.qid, "Q358519");
  assert.deepEqual(await loadFactPicks({ sport: "no-such-sport" }, "03-31", options), []);
  await assert.rejects(loadFactPicks({ league: "../x" }, "03-31", options), RangeError);
});
