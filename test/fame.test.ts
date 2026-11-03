import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import type { Catalogue } from "../src/catalogue.ts";
import { significance } from "../src/facts.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

function rows(path: string): Record<string, string>[] {
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cell = "", quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i]!;
      if (quoted) { if (c === '"' && line[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c; }
      else if (c === '"') quoted = true;
      else if (c === ",") { out.push(cell); cell = ""; } else cell += c;
    }
    out.push(cell);
    return out;
  };
  const header = split(lines[0]!);
  return lines.slice(1).map((line) => Object.fromEntries(split(line).map((value, index) => [header[index]!, value])));
}

const rule = JSON.parse(readFileSync("data-sources/fame-rule.json", "utf8")) as Record<string, number | string | number[] | number[][]>;
const people = rows("data-sources/priority-people.csv");
const num = (text: string | undefined): number | null => (text !== undefined && /^-?\d+$/.test(text) ? Number(text) : null);

/** The score, written here a second time from the rule file and the columns. */
function score(row: Record<string, string>): number | null {
  const editions = num(row.editions);
  if (editions === null || row.fame_note?.includes("another person of the same name")) return null;
  return editions * (rule.editionPoints as number)
    + (rule.olympicMedalPoints as number) * Math.min(num(row.olympic_medals) ?? 0, rule.olympicMedalCap as number)
    + (rule.worldTitlePoints as number) * Math.min(num(row.world_titles) ?? 0, rule.worldTitleCap as number)
    + (rule.hallOfFamePoints as number) * Math.min(num(row.hall_of_fame) ?? 0, rule.hallOfFameCap as number);
}

test("2,000 people, each once, ranked 1 to 2000 once each", () => {
  assert.equal(people.length, 2000);
  const qids = people.map((r) => r.qid).filter(Boolean);
  assert.equal(new Set(qids).size, qids.length);
  const names = people.filter((r) => !r.qid).map((r) => `${r.name}|${r.sport}`);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(people.map((r) => Number(r.fame_rank)).sort((a, b) => a - b), Array.from({ length: 2000 }, (_, i) => i + 1));
});

test("the score is reproducible from the columns and the rule file", () => {
  for (const r of people) assert.equal(num(r.fame_score), score(r), r.name);
  const ali = people.find((r) => r.qid === "Q36107")!;
  assert.equal(Number(ali.fame_score), Number(ali.editions) + 2 * Math.min(Number(ali.olympic_medals), 5) + 4 * Math.min(Number(ali.world_titles), 3) + 8 * Math.min(Number(ali.hall_of_fame), 2));
});

test("the order is the score, then the old rank as a tie-break only; people without a score keep their old rank", () => {
  const scored = people.filter((r) => r.fame_score).sort((a, b) => Number(a.fame_rank) - Number(b.fame_rank));
  for (let i = 1; i < scored.length; i += 1) {
    const a = scored[i - 1]!, b = scored[i]!;
    if (Number(a.fame_score) === Number(b.fame_score)) {
      const oa = num(a.old_rank) ?? 1e6, ob = num(b.old_rank) ?? 1e6;
      assert.ok(oa <= ob || a.fame_note.includes("spread rule") || b.fame_note.includes("spread rule"), `${a.name} before ${b.name}`);
    }
  }
  // not a floor: someone from the old 999 sits far below his old place, and someone new sits above old ones
  assert.ok(people.some((r) => num(r.old_rank) && Number(r.fame_rank) > Number(r.old_rank) + 500), "an old pick moved far down");
  assert.ok(people.some((r) => !r.old_rank && Number(r.fame_rank) < 300), "a new person is in the first 300");
  const unscored = people.filter((r) => !r.fame_score);
  assert.ok(unscored.length >= 30);
  for (const r of unscored) { assert.equal(r.fame_rank, r.old_rank, r.name); assert.ok(r.fame_note, r.name); }
});

test("no sport or country crowds a block of 100 beyond the rule, and the file is what fame.py gives", () => {
  const ranked = [...people].sort((a, b) => Number(a.fame_rank) - Number(b.fame_rank));
  for (let start = 0; start < (rule.blocksWithSpreadRule as number) * (rule.blockSize as number); start += rule.blockSize as number) {
    const block = ranked.slice(start, start + (rule.blockSize as number));
    const sports = new Map<string, number>(), countries = new Map<string, number>();
    for (const r of block) { sports.set(r.sport!, (sports.get(r.sport!) ?? 0) + 1); const c = r.plays_for || r.country; if (c) countries.set(c, (countries.get(c) ?? 0) + 1); }
    assert.ok(Math.max(...sports.values()) <= (rule.sportShare as number), `sport in ranks ${start + 1}-${start + 100}`);
    assert.ok(Math.max(...countries.values()) <= (rule.countryShare as number), `country in ranks ${start + 1}-${start + 100}`);
  }
  execFileSync("python3", ["-I", "pipeline/people/fame.py", "check"], { stdio: "pipe" });
});

test("the fame rank is the fame signal in significance: nearer the top adds more", () => {
  const person = (extra: Partial<OnThisDayRecord>): OnThisDayRecord => ({ category: "player-birthday", eventDate: "1960-01-02", person: { qid: "Q1", name: "X" }, ...extra }) as OnThisDayRecord;
  const plain = significance(person({}));
  const bonus = (fameRank: number): number => significance(person({ priorityAthlete: true, fameRank })) - plain;
  for (const [upTo, points] of rule.bonusBands as number[][]) assert.equal(bonus(upTo!), points, `rank ${upTo}`);
  assert.equal(bonus(1), 50);
  assert.equal(bonus(101), 45);
  assert.equal(bonus(2000), 18);
  assert.equal(significance(person({ priorityAthlete: true })) - plain, 45, "a fact made before the ranking keeps the flat bonus");
});

test("the catalogue publishes the whole list, the top 100 are those of the file", () => {
  const catalogue = JSON.parse(readFileSync("data/v1/0.1.0/catalogue.json", "utf8")) as Catalogue;
  const { fame } = catalogue;
  assert.equal(fame.total, 2000);
  assert.equal(fame.people.length, 2000);
  assert.deepEqual(fame.people.map((p) => p[0] as number), Array.from({ length: 2000 }, (_, i) => i + 1));
  const byRank = new Map(people.map((r) => [Number(r.fame_rank), r]));
  for (const [rank, qid, name, , , score] of fame.people.slice(0, 100)) {
    const r = byRank.get(Number(rank))!;
    assert.equal(name, r.name);
    assert.equal(qid, r.qid || null);
    assert.equal(score, num(r.fame_score));
  }
  assert.equal(fame.scored, people.filter((r) => r.fame_score).length);
  assert.equal(fame.spread.top100!.sports.reduce((a, [, n]) => a + Number(n), 0) <= 100, true);
  assert.deepEqual(fame.rule, rule);
});

test("priority-athletes.csv and the famous extract are retired: nothing reads them", () => {
  const files = execFileSync("git", ["ls-files", "pipeline", "scripts", "src", "test", "demo", "e2e", "package.json", "data-sources"], { encoding: "utf8" }).split("\n").filter(Boolean)
    .filter((f) => existsSync(f) && /\.(py|ts|mjs|json|csv|jsonl|sh)$/.test(f) && !f.startsWith("data-sources/facts/") && f !== "test/fame.test.ts" && f !== "pipeline/test_rebuild_guard.py" && f !== "data-sources/rebuild-allow.json" && !f.startsWith("src/data/"));
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    assert.equal(/priority-athletes\.csv|extract_wikidata_famous|fetch_wikidata_open/.test(text), false, f);
  }
  assert.throws(() => readFileSync("data-sources/priority-athletes.csv"));
  assert.throws(() => readFileSync("pipeline/fetch_wikidata_open.py"));
  assert.throws(() => readFileSync("pipeline/priority_athletes.py"));
});
