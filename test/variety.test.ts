import assert from "node:assert/strict";
import { test } from "node:test";
import { pickVaried, categoryOf, competitionOf } from "../demo/variety.ts";
import { quotes } from "../src/data/quotes.ts";
import { history } from "../src/data/history.ts";
import type { MeigenRecord } from "../src/types.ts";

function row(id: string, types: string[], tags: string[] = [], kind: MeigenRecord["kind"] = "history"): MeigenRecord {
  return {
    id, kind, types, text: id, language: "en", sports: ["soccer"], tags,
    date: "2000-01-01", monthDay: "01-01", dateRole: "match", speaker: null,
    entities: tags.includes("world-cup")
      ? [{ id: "openfootball:worldcup:2000", kind: "competition", role: "part-of" }]
      : [{ id: `event:${id}`, kind: "event", role: "subject" }],
    source: {
      sourceId: "wikidata", key: id, url: "https://example.com", title: "Example", licence: "CC0-1.0",
      rightsStatus: "cc0", attribution: "Example", rawSha256: "a".repeat(64), rightsEvidence: ["https://example.com"],
    },
  };
}

test("variety never takes more than two from the same category or competition", () => {
  const records = [
    row("a", ["match-result"], ["world-cup"]),
    row("b", ["match-result"], ["world-cup"]),
    row("c", ["match-result"], ["world-cup"]),
    row("d", ["competition-end"]),
    row("e", ["competition-end"]),
    row("f", ["competition-end"]),
  ];
  const picked = pickVaried(records, 10);
  assert.equal(picked.length, 4);
  assert.equal(picked.filter((r) => categoryOf(r) === "match-result").length, 2);
  assert.equal(picked.filter((r) => competitionOf(r) === "world-cup").length, 2);
});

test("the starter seed can still fill ten mixed demo records", () => {
  const picked = pickVaried([...quotes, ...history], 10);
  assert.equal(picked.length, 10);
  const cats = picked.map(categoryOf);
  const comps = picked.map(competitionOf);
  for (const key of new Set(cats)) assert.ok(cats.filter((c) => c === key).length <= 2, key);
  for (const key of new Set(comps)) assert.ok(comps.filter((c) => c === key).length <= 2, key);
});
