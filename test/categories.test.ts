import assert from "node:assert/strict";
import test from "node:test";
import { HISTORY_TYPES } from "../src/categories.ts";

test("history catalogue separates broad families from player record scopes", () => {
 assert.equal(HISTORY_TYPES.length, 46);
 assert.equal(new Set(HISTORY_TYPES.map(({ id }) => id)).size, 46);
 for (const id of ["career-stat-milestone", "season-stat-milestone", "sport-record", "result-streak", "transfer-trade-signing", "comeback-upset"]) {
  const entry = HISTORY_TYPES.find((value) => value.id === id);
  assert.ok(entry);
  assert.ok(entry.evidence.length > 20);
 }
 assert.equal(HISTORY_TYPES.some(({ id }) => id === "nonwinning-streak"), false);
 assert.equal(HISTORY_TYPES.find(({ id }) => id === "sport-record")?.readiness, "needs-source");
 assert.equal(HISTORY_TYPES.find(({ id }) => id === "cancelled-postponed")?.readiness, "extractable-if-populated");
});
