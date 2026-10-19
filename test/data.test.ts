import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { quotes } from "../src/data/quotes.ts";
import { history } from "../src/data/history.ts";
import { buildFiles, convertSeed, digest, entityFile, generate, validateRecords } from "../scripts/data.ts";
import type { FeedManifest, FeedShard, MeigenRecord } from "../src/types.ts";
const records = [...quotes, ...history];

test("reviewed real source counts and honest calendar coverage", () => {
  assert.equal(quotes.length, 30);
  assert.equal(quotes.filter((r) => r.source.sourceId === "gitenberg").length, 22);
  assert.equal(quotes.filter((r) => r.source.sourceId === "wikiquote").length, 8);
  assert.equal(quotes.filter((r) => r.types.includes("famous-quotes")).length, 8);
  assert.equal(history.length, 1052);
  assert.equal(history.filter((r) => r.source.sourceId === "wikidata").length, 88);
  assert.equal(history.filter((r) => r.source.sourceId === "openfootball").length, 964);
  assert.equal(new Set(history.map((r) => r.monthDay)).size, 142);
  assert.equal(new Set(history.map((r) => r.date?.slice(5, 7))).size, 12);
  assert.equal(quotes.every((r) => r.date === null && r.monthDay === null), true);
  assert.equal(history.some((r) => r.source.key.startsWith("Q1187909@")), false);
  assert.equal(history.some((r) => r.source.key.startsWith("Q24264147@")), false);
});

test("every source carries original provenance and independent text rights", () => {
  validateRecords(records);
  assert.equal(new Set(quotes.filter((r) => r.source.sourceId === "gitenberg").map((r) => r.source.title)).size, 3);
  assert.equal(quotes.filter((r) => r.speaker === "Pindar").length, 4);
  for (const r of quotes) {
    if (r.source.sourceId === "wikiquote") {
      assert.equal(r.source.licence, "CC-BY-SA-4.0");
      assert.equal(r.source.rightsStatus, "cc-by-sa-4.0");
      assert.match(r.source.url, /^https:\/\/en\.wikiquote\.org\/w\/index\.php\?title=.+&oldid=\d+$/);
      assert.ok(r.source.section);
      assert.ok(r.source.snapshot?.revision);
      assert.match(r.source.attribution, /quoted words remain with the speaker/);
      assert.match(r.source.rightsReasoning, /page compilation/);
      continue;
    }
    assert.equal(r.source.licence, "LicenseRef-Public-Domain-Text");
    assert.match(r.source.url, /\/blob\/[a-f0-9]{40}\/[^#]+#L\d+-L\d+$/);
    assert.ok(r.source.publicationYear && r.source.publicationYear <= 1904);
    assert.match(r.source.rightsReasoning, /Territorial public domain/);
    if (r.speaker === "Pindar") {
      assert.equal(r.source.translator, "Ernest Myers");
      assert.equal(r.entities.some((e) => e.role === "translator" && e.label === "Ernest Myers"), true);
    }
  }
  for (const r of history) assert.equal(r.source.licence, "CC0-1.0");
});

test("source lifecycle and record types are independent of publication rights", () => {
  assert.equal(quotes.every((r) => r.types.includes("quotation") && r.source.snapshot?.status === "snapshot"), true);
  assert.equal(quotes.every((r) => !r.source.snapshot?.coverageStart && !r.source.snapshot?.coverageEnd), true);
  assert.equal(history.filter((r) => r.source.sourceId === "openfootball").every((r) => r.types.includes("match-result") && r.source.snapshot?.status === "snapshot"), true);
  assert.equal(history.filter((r) => r.source.sourceId === "wikidata").every((r) => r.source.snapshot?.status === "active"), true);
  assert.equal(records.every((r) => r.source.snapshot?.capturedAt && r.source.snapshot.revision), true);
  const old = { ...history[0]!, source: { ...history[0]!.source, snapshot: { ...history[0]!.source.snapshot!, status: "discontinued" as const } } };
  assert.doesNotThrow(() => validateRecords([old]));
  assert.equal(history.some((r) => r.types.includes("championship-win")), true);
  assert.equal(history.filter((r) => ["start", "end"].includes(r.dateRole ?? "")).every((r) => r.types.includes("competition-boundary")), true);
});

test("missing rights, invented dates, duplicate IDs and unsafe sources fail closed", () => {
  const copy = (r: MeigenRecord): MeigenRecord => structuredClone(r);
  const original = copy(quotes[0]!);
  const q = { ...original, source: { ...original.source, rightsStatus: "unknown" as never } };
  assert.throws(() => validateRecords([q]), /Unverified rights/);
  const h = { ...history[0]!, date: "2023-02-29", monthDay: "02-29" };
  assert.throws(() => validateRecords([h]), /Invalid day/);
  assert.throws(() => validateRecords([quotes[0]!, quotes[0]!]), /duplicate/);
  assert.throws(() => validateRecords([{ ...quotes[0]!, date: "1886-01-01" }]), /invent/);
  assert.throws(() => validateRecords([{ ...quotes[0]!, source: { ...quotes[0]!.source, rawSha256: "" } }]), /archive hash/);
  assert.throws(() => validateRecords([{ ...quotes[0]!, source: { ...quotes[0]!.source, url: "https://user:password@example.com/" } }]), /Unsafe/);
  assert.throws(() => validateRecords([{ ...quotes[0]!, source: { ...quotes[0]!.source, rightsReasoning: "" } }]), /rights reasoning/);
});

test("generated source and shard bytes are deterministic and current", () => {
  const normalized = convertSeed();
  assert.deepEqual(normalized.quotes, quotes);
  assert.deepEqual(normalized.history, history);
  const forward = buildFiles(records);
  const reversed = buildFiles([...records].reverse());
  assert.deepEqual(forward, reversed);
  assert.deepEqual(generate(true), { records: 1082, files: 1448, merged: 10 });
  const manifest = JSON.parse(forward.get("manifest.json")!) as FeedManifest;
  assert.equal(manifest.missingDays.length, 224);
  assert.equal(manifest.coveredDays, 142);
  assert.equal(manifest.missingDays.includes("02-29"), true);
  assert.equal(manifest.files["days/02-29.json"]?.records, 0);
  assert.equal(forward.has("days/02-29.json"), true);
  for (const [file, meta] of Object.entries(manifest.files)) {
    const bytes = readFileSync(new URL(`../data/v1/0.1.0/${file}`, import.meta.url));
    assert.equal(digest(bytes), meta.sha256, file);
    assert.equal(bytes.length, meta.bytes, file);
    assert.equal((JSON.parse(bytes.toString()) as FeedShard).records.length, meta.records);
  }
});

test("day, sport and reversible entity shards contain exactly their own records", () => {
  const files = buildFiles(records);
  for (const [name, content] of files) {
    if (name === "manifest.json") continue;
    const shard = JSON.parse(content) as FeedShard;
    if (name.startsWith("days/")) {
      const day = name.slice(5, -5);
      assert.deepEqual(shard.records, records.filter((r) => r.monthDay === day).sort((a, b) => a.id < b.id ? -1 : 1));
    } else if (name.startsWith("sports/")) {
      const sport = name.slice(7, -5);
      assert.equal(shard.records.every((r) => r.sports.includes(sport)), true);
    } else if (name.startsWith("entities/")) {
      const id = Buffer.from(name.slice(9, -5), "base64url").toString("utf8");
      assert.equal(name, entityFile(id));
      assert.equal(shard.records.every((r) => r.entities.some((e) => e.id === id)), true);
    }
  }
  assert.match(entityFile("wikidata:Q939560"), /^entities\/[A-Za-z0-9_-]+\.json$/);
  assert.notEqual(entityFile("event:a/b"), entityFile("event:a%2Fb"));
});
