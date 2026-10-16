import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { isFactRecord } from "../src/load.ts";
import { isRichFact, rankFeed, uniqueRecordIds } from "../src/index.ts";

const DAYS = join("data/v1/0.1.0/facts/days");

test("every calendar day has at least three feed-ready facts", () => {
  const files = readdirSync(DAYS).filter((name) => /^\d{2}-\d{2}\.json$/.test(name)).sort();
  assert.equal(files.length, 366);
  const thin: string[] = [];
  for (const name of files) {
    const shard = JSON.parse(readFileSync(join(DAYS, name), "utf8")) as { records: unknown[] };
    const ready = shard.records.filter(isFactRecord);
    if (ready.length < 3) thin.push(`${name}:${ready.length}`);
  }
  assert.deepEqual(thin, []);
});

test("no fact id appears twice in a day feed", () => {
  const files = readdirSync(DAYS).filter((name) => /^\d{2}-\d{2}\.json$/.test(name));
  for (const name of files) {
    const shard = JSON.parse(readFileSync(join(DAYS, name), "utf8")) as { records: { recordId: string }[] };
    assert.equal(uniqueRecordIds(shard.records as never), true, name);
  }
});

test("16 Oct is feed-ready and ranks three rich facts", () => {
  const shard = JSON.parse(readFileSync(join(DAYS, "10-16.json"), "utf8")) as { records: unknown[] };
  const ready = shard.records.filter(isFactRecord);
  assert.ok(ready.length >= 3, `10-16 feed-ready ${ready.length}`);
  assert.equal(ready.every((row) => Array.isArray(row.tags) && row.tags.length > 0), true);
  assert.equal(ready.every((row) => row.basis === "source" || row.basis === "derived"), true);
  const rich = ready.filter(isRichFact);
  assert.ok(rich.length >= 3, `10-16 rich ${rich.length}`);
  assert.equal(rankFeed(rich, 3).length, 3);
});
