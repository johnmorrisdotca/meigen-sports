import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { captionFromFact } from "../src/sentences.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

test("every stored sentence is the library's own: one source of wording", () => {
  const dir = "data/v1/0.1.0/facts/store";
  let checked = 0;
  for (const name of readdirSync(dir)) {
    for (const r of (JSON.parse(readFileSync(`${dir}/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records) {
      assert.equal(r.text, captionFromFact(r, "en"), r.recordId);
      assert.equal(r.textJa ?? null, captionFromFact(r, "ja"), r.recordId);
      checked += 1;
    }
  }
  assert.ok(checked > 29000);
});

test("the converter holds no sentence templates of its own", () => {
  const source = readFileSync("pipeline/convert_extract.py", "utf8");
  for (const phrase of [" beat ", "won the ", "was born on this day", "died on this day", "began this", "drew "]) {
    assert.ok(!source.includes(phrase), `convert_extract.py still words facts: "${phrase}"`);
  }
});
