import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { HISTORY_TYPES } from "../src/categories.ts";
import { factsFor, randomFacts, rankFeed, tagsOf, uniqueRecordIds } from "../src/facts.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

const root = "data/v1/0.1.0/facts";
const store = new Map<string, OnThisDayRecord>();
let stored = 0;
for (const name of readdirSync(`${root}/store`)) for (const r of (JSON.parse(readFileSync(`${root}/store/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records) { store.set(r.recordId, r); stored += 1; }

function feedFiles(dir = root, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) { if (!["store", "indexes", "index"].includes(name)) feedFiles(path, out); } else if (name.endsWith(".json") && name !== "manifest.json") out.push(path);
  }
  return out;
}
const ids = (path: string): { schemaVersion: number; ids?: string[]; records?: OnThisDayRecord[] } => JSON.parse(readFileSync(path, "utf8"));

test("one fact, stored once: every id lives in exactly one store file", () => {
  assert.equal(store.size, stored);
});

test("no feed lists a fact twice, and each listing is the stored fact itself", () => {
  const files = feedFiles();
  assert.ok(files.length > 800);
  for (const file of files) {
    const records = ids(file).records ?? [];
    assert.equal(new Set(records.map((r) => r.recordId)).size, records.length, `${file} lists a fact twice`);
    for (const r of records) assert.deepEqual(r, store.get(r.recordId), `${file}: ${r.recordId} differs from the stored fact`);
  }
});

test("one fact, many tags: a fact is in the index of each of its tags and in no other", () => {
  const perTag = new Map<string, Set<string>>();
  for (const name of readdirSync(`${root}/indexes/tags`)) perTag.set(name.replace(/\.json$/, ""), new Set(ids(`${root}/indexes/tags/${name}`).ids));
  let multi = 0;
  for (const r of store.values()) {
    const tags = tagsOf(r);
    if (tags.length > 1) multi += 1;
    for (const tag of tags) assert.ok(perTag.get(tag)?.has(r.recordId), `${r.recordId} is missing from the ${tag} index`);
  }
  assert.ok(multi > 10000, `${multi} facts carry several tags`);
  for (const [tag, set] of perTag) for (const id of set) assert.ok(tagsOf(store.get(id)!).includes(tag), `${id} is in the ${tag} index without that tag`);
});

test("a tag feed holds only facts that carry the tag, once each, even when they carry others", () => {
  for (const name of readdirSync(`${root}/feeds/tags`)) {
    const tag = name.replace(/\.json$/, "");
    const records = ids(`${root}/feeds/tags/${name}`).records ?? [];
    assert.ok(records.length > 0, tag);
    for (const r of records) assert.ok(tagsOf(r).includes(tag), `${r.recordId} is in the ${tag} feed`);
  }
});

test("every tag is one of the forty-six history types or an extract family; none is blank or repeated", () => {
  const allowed = new Set<string>([...HISTORY_TYPES.map((t) => t.id), "age-at-event", "series-start", "series-clinch", "venue-history", "franchise-identity-change", "player-birthday", "award-honour", "draft-selection"]);
  const unknown = new Set<string>();
  for (const r of store.values()) {
    assert.equal(new Set(r.tags).size, r.tags.length, `${r.recordId} repeats a tag`);
    for (const tag of r.tags) if (!allowed.has(tag)) unknown.add(tag);
  }
  assert.deepEqual([...unknown], []);
});

test("the selectors never return a fact twice, even from a list that repeats it", () => {
  const some = [...store.values()].filter((r) => r.eventDate?.endsWith("-10-19")).slice(0, 40);
  const doubled = [...some, ...some, ...some.slice(0, 5)];
  assert.equal(uniqueRecordIds(doubled), false);
  assert.equal(uniqueRecordIds(factsFor(doubled)), true);
  assert.equal(uniqueRecordIds(rankFeed(doubled, 12)), true);
  assert.equal(uniqueRecordIds(randomFacts(doubled, 12, {}, "seed")), true);
  assert.ok(existsSync(`${root}/sample.json`));
});
