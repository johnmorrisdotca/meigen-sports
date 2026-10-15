import assert from "node:assert/strict";
import { test } from "node:test";
import { historyOnDate, isDate, monthDayOf, quoteForDate, selectRecords, type MeigenRecord } from "../src/index.ts";
import { loadDay, loadEntity, loadShard, isRecord, type LoadOptions } from "../src/load.ts";
const quote: MeigenRecord = {
  id: "quote:source:1", types: ["quotation"], kind: "quote", text: "A verified passage.", language: "en", sports: ["boxing"], tags: [],
  date: null, monthDay: null, dateRole: null, speaker: "Historical author",
  entities: [{ id: "source:person-1", kind: "person", role: "author" }],
  source: { sourceId: "source", key: "edition:1", url: "https://example.com/book", title: "Book", licence: "LicenseRef-Public-Domain-Text", rightsStatus: "public-domain-us-ca-uk", attribution: "Author, original edition", rawSha256: "a".repeat(64), rightsEvidence: ["https://example.com/rights"] },
};
const fact: MeigenRecord = { ...quote, id: "fact:1", types: ["competition-start"], kind: "history", text: "An event began.", date: "2000-02-29", monthDay: "02-29", dateRole: "start", speaker: null };

test("Gregorian dates retain leap-day identity without timezone parsing", () => {
  assert.equal(isDate("2000-02-29"), true); assert.equal(isDate("1900-02-29"), false);
  assert.equal(isDate("2024-04-31"), false); assert.equal(isDate("0000-01-01"), false);
  assert.equal(monthDayOf("02-29"), "02-29"); assert.throws(() => monthDayOf("2023-02-29"), RangeError);
  assert.throws(() => monthDayOf("2024-02-29T23:00:00Z"), RangeError);
});
test("history never invents quote anniversaries or shows a future fact", () => {
  assert.deepEqual(historyOnDate([quote, fact], "2024-02-29"), [fact]);
  assert.deepEqual(historyOnDate([fact], "1996-02-29"), []);
  assert.deepEqual(historyOnDate([fact], "03-01"), []);
  assert.equal(quote.date, null);
});
test("context intersects sport and exact entity identity, not display names", () => {
  const sameName = { ...quote, id: "quote:2", entities: [{ id: "source:person-2", kind: "person" as const, role: "author", label: "Historical author" }] };
  assert.deepEqual(selectRecords([quote, sameName], { sports: ["boxing"], entityIds: ["source:person-1"] }), [quote]);
  assert.deepEqual(selectRecords([quote], { sports: ["tennis"], entityIds: ["source:person-1"] }), []);
  assert.deepEqual(selectRecords([quote], { entityIds: ["Historical author"] }), []);
  assert.deepEqual(selectRecords([quote], { query: "VERIFIED" }), [quote]);
});
test("a quote choice is deterministic, does not mutate its input, and has no hidden fallback", () => {
  const rows = Object.freeze([Object.freeze(quote), Object.freeze({ ...quote, id: "quote:2" })]);
  assert.equal(quoteForDate(rows, "2026-10-14"), quoteForDate(rows, "2026-10-14"));
  assert.equal(rows[0].id, "quote:source:1");
  assert.equal(quoteForDate(rows, "2026-10-14", { sports: ["soccer"] }), null);
  assert.equal(quoteForDate([], "2026-10-14"), null);
});
test("public loader rejects unclear rights and malformed or incomplete records", () => {
  assert.equal(isRecord(quote), true); assert.equal(isRecord(fact), true);
  assert.equal(isRecord({ ...quote, source: { ...quote.source, licence: "unknown" } }), false);
  assert.equal(isRecord({ ...quote, source: { ...quote.source, rightsEvidence: [] } }), false);
  assert.equal(isRecord({ ...fact, date: "2023-02-29" }), false);
  assert.equal(isRecord({ ...quote, source: { ...quote.source, rawSha256: 123 } }), false);
});
test("optional source snapshot metadata is validated without requiring a snapshot", () => {
  assert.equal(isRecord(quote), true);
  const withSnapshot = { ...fact, source: { ...fact.source, snapshot: { status: "discontinued" as const, revision: "rev-4", capturedAt: "2024-01-02T03:04:05Z", coverageStart: "1999-01-01", coverageEnd: "2000-12-31" } } };
  assert.equal(isRecord(withSnapshot), true);
  for (const snapshot of [
    { status: "retired" },
    { status: "snapshot", revision: " " },
    { status: "active", capturedAt: "yesterday" },
    { status: "snapshot", coverageStart: "2001-01-01", coverageEnd: "2000-12-31" },
    { status: "snapshot", coverageStart: "2001-02-29" },
  ]) assert.equal(isRecord({ ...fact, source: { ...fact.source, snapshot } }), false);
});
test("static loader sends exactly one cacheable file request with cancellation", async () => {
  const calls: { url: string; init?: RequestInit }[] = []; const controller = new AbortController();
  const options: LoadOptions = { baseUrl: "https://example.com/meigen-sports/", dataVersion: "0.1.0", signal: controller.signal,
    fetch: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ schemaVersion: 1, dataVersion: "0.1.0", records: [fact] }) }; } };
  assert.deepEqual((await loadDay("2024-02-29", options)).records, [fact]);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, "https://example.com/meigen-sports/data/v1/0.1.0/days/02-29.json");
  assert.equal(calls[0].init?.cache, "force-cache"); assert.equal(calls[0].init?.signal, controller.signal);
  await loadEntity("source:person-1", options);
  assert.match(calls[1].url, /entities\/c291cmNlOnBlcnNvbi0x\.json$/);
  await assert.rejects(loadShard("../private.json", options), RangeError);
  await assert.rejects(loadShard("quotes.json", { ...options, baseUrl: "https://user:secret@example.com/" }), RangeError);
  await assert.rejects(loadShard("quotes.json", { ...options, fetch: async () => ({ ok: true, status: 200, json: async () => ({ schemaVersion: 1, dataVersion: "wrong", records: [] }) }) }), TypeError);
  await assert.rejects(loadShard("quotes.json", { ...options, fetch: async () => ({ ok: false, status: 404, json: async () => null }) }), /404/);
});

test("source and type controls are independent; exclusion wins and frozen history remains selectable", () => {
 const archived = { ...fact, source: { ...fact.source, sourceId: "closed-project", snapshot: { status: "discontinued" as const, coverageEnd: "2000-12-31" } } };
 assert.deepEqual(selectRecords([quote, archived], { types: ["competition-start"], includeSources: ["closed-project"] }), [archived]);
 assert.deepEqual(selectRecords([archived], { includeSources: ["closed-project"], excludeSources: ["closed-project"] }), []);
 assert.deepEqual(selectRecords([quote, archived], { excludeTypes: ["quotation"] }), [archived]);
 assert.deepEqual(selectRecords([quote, archived], { types: ["quotation"], excludeSources: ["closed-project"] }), [quote]);
});
