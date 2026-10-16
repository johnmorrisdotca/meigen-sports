import assert from "node:assert/strict";
import test from "node:test";
import { history } from "../src/data/history.ts";
import { historyOnDate } from "../src/index.ts";
import {
  finalCaptionFromMatch, mergeHistoryEvents, uniqueHistoryIds,
} from "../src/mergeEvents.ts";
import type { MeigenRecord } from "../src/types.ts";

const source: MeigenRecord["source"] = {
  sourceId: "openfootball", key: "k", url: "https://example.com/a", title: "World Cup 2022",
  licence: "CC0-1.0", rightsStatus: "cc0", attribution: "openfootball", rawSha256: "a".repeat(64),
  rightsEvidence: ["https://example.com/rights"],
};

function row(id: string, extra: Partial<MeigenRecord>): MeigenRecord {
  return {
    id, kind: "history", types: ["match-result"], text: extra.text ?? "x", language: "en",
    sports: ["soccer"], tags: extra.tags ?? [], date: extra.date ?? "2022-12-18",
    monthDay: (extra.date ?? "2022-12-18").slice(5), dateRole: extra.dateRole ?? "match-date-as-published",
    speaker: null, entities: extra.entities ?? [], source: extra.source ?? source, ...extra,
  };
}

test("a World Cup final caption names the winner and the penalty result", () => {
  assert.equal(
    finalCaptionFromMatch("Argentina 3–3 France (World Cup 2022, Final; after extra time; penalties 4–2)."),
    "Argentina won the 2022 World Cup, beating France 4–2 on penalties after a 3–3 draw.",
  );
  assert.equal(
    finalCaptionFromMatch("Uruguay 4–2 Argentina (World Cup 1930, Final)."),
    "Uruguay won the 1930 World Cup, beating Argentina 4–2.",
  );
  assert.equal(
    finalCaptionFromMatch("England 4–2 West Germany (World Cup 1966, Final; after extra time)."),
    "England won the 1966 World Cup, beating West Germany 4–2 after extra time.",
  );
  assert.equal(finalCaptionFromMatch("Qatar 0–2 Ecuador (World Cup 2022, Matchday 1)."), null);
});

test("a final and the competition's ended row become one fact", () => {
  const match = row("history:openfootball:final", {
    text: "Argentina 3–3 France (World Cup 2022, Final; after extra time; penalties 4–2).",
    tags: ["world-cup"],
    entities: [
      { id: "sport:soccer", kind: "sport", role: "subject", label: "soccer" },
      { id: "wikidata:Q284163", kind: "competition", role: "part-of", label: "2022 FIFA World Cup" },
    ],
  });
  const ended = row("history:wikidata:Q284163:P582", {
    types: ["competition-end", "competition-boundary"],
    text: "2022 FIFA World Cup ended.",
    tags: [],
    dateRole: "end",
    source: { ...source, sourceId: "wikidata", key: "Q284163:P582", title: "2022 FIFA World Cup" },
    entities: [
      { id: "sport:soccer", kind: "sport", role: "subject", label: "soccer" },
      { id: "wikidata:Q284163", kind: "event", role: "subject", label: "2022 FIFA World Cup" },
    ],
  });
  const { records, report } = mergeHistoryEvents([match, ended]);
  assert.equal(report.merged, 1);
  assert.equal(records.length, 1);
  assert.equal(uniqueHistoryIds(records), true);
  const kept = records[0]!;
  assert.equal(kept.id, match.id);
  assert.equal(kept.text, "Argentina won the 2022 World Cup, beating France 4–2 on penalties after a 3–3 draw.");
  assert.equal(kept.types.includes("match-result"), true);
  assert.equal(kept.types.includes("competition-end"), true);
  assert.equal(kept.types.includes("championship-win"), true);
  assert.equal(kept.tags.includes("final"), true);
  assert.equal(kept.tags.includes("championship"), true);
  assert.equal(kept.tags.includes("competition-closing"), true);
  assert.equal(kept.additionalSources?.length, 1);
  assert.equal(kept.additionalSources?.[0]?.sourceId, "wikidata");
});

test("a generic began row is dropped when a match exists that day", () => {
  const opener = row("history:openfootball:opener", {
    date: "2022-11-20",
    text: "Qatar 0–2 Ecuador (World Cup 2022, Matchday 1).",
    tags: ["world-cup"],
    entities: [{ id: "wikidata:Q284163", kind: "competition", role: "part-of", label: "2022 FIFA World Cup" }],
  });
  const began = row("history:wikidata:Q284163:P580", {
    date: "2022-11-20",
    types: ["competition-start", "competition-boundary"],
    text: "2022 FIFA World Cup began.",
    dateRole: "start",
    entities: [{ id: "wikidata:Q284163", kind: "event", role: "subject", label: "2022 FIFA World Cup" }],
  });
  const { records, report } = mergeHistoryEvents([opener, began]);
  assert.equal(report.merged, 1);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.id, opener.id);
  assert.equal(records[0]!.types.includes("competition-start"), true);
});

test("bundled history never lists the 2022 final and ended on the same date", () => {
  const day = historyOnDate(history, "2022-12-18", { sports: ["soccer"] });
  const texts = day.map((row) => row.text);
  assert.equal(texts.filter((text) => /2022 FIFA World Cup ended/.test(text)).length, 0);
  assert.equal(texts.filter((text) => /Argentina won the 2022 World Cup/.test(text)).length, 1);
  assert.equal(uniqueHistoryIds(history), true);
  assert.equal(new Set(history.map((row) => row.id)).size, history.length);
});
