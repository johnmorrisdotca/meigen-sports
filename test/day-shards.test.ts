import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { isFactRecord } from "../src/load.ts";
import { isRichFact, rankFeed, uniqueRecordIds } from "../src/index.ts";

const DAYS = join("data/v1/0.1.0/facts/days");

test("every calendar day shard exists; stubs and Kim 1602 never appear", () => {
  const files = readdirSync(DAYS).filter((name) => /^\d{2}-\d{2}\.json$/.test(name)).sort();
  assert.equal(files.length, 366);
  const banned = /Myong-won Kim|Q704476|1602-/;
  const stub = /(?:^|[.!?]\s)[A-Z][^,]+ (?:was born|died) on this day in \d{4}(?: \(died \d{4}\))?\.$| opened in \d{4}\.$|began this club identity/;
  for (const name of files) {
    const shard = JSON.parse(readFileSync(join(DAYS, name), "utf8")) as { records: { text?: string; person?: { qid?: string; name?: string }; eventDate?: string }[] };
    const blob = JSON.stringify(shard);
    assert.equal(banned.test(blob), false, name);
    for (const row of shard.records) {
      if (row.text) assert.equal(stub.test(row.text), false, `${name} ${row.text}`);
    }
  }
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
