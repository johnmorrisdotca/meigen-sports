import assert from "node:assert/strict";
import test from "node:test";
import { captionFromFact } from "../src/sentences.ts";
import { render, TEMPLATES } from "../src/templates/index.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

const source = { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors, CC0.", url: "https://www.wikidata.org/" };

function gretzky(extra: Partial<OnThisDayRecord> = {}): OnThisDayRecord {
  return {
    recordId: "b1", category: "player-birthday", tags: ["player-birthday"], basis: "source",
    eventDate: "1961-01-26", datePrecision: "day", sport: "ice-hockey", competition: "nhl", league: "nhl",
    person: { personId: 1866, qid: "Q209518", name: "Wayne Gretzky", leagueCodes: ["nhl"], franchiseIds: [], teamSeasonIds: [] },
    livingStatus: "unknown", source, ...extra,
  };
}

test("no template says would have turned", () => {
  for (const row of TEMPLATES) {
    assert.equal(/would have turned/i.test(row.pattern), false, row.id);
  }
});

test("turns appears only on living-gated templates", () => {
  for (const row of TEMPLATES) {
    if (/turns|歳になる/.test(row.pattern)) assert.equal(row.gate, "living", row.id);
  }
});

test("unknown birthday uses the neutral default and never turns", () => {
  const text = captionFromFact(gretzky());
  assert.equal(text, "Wayne Gretzky was born on this day in 1961.");
  assert.equal(/turns|would have turned|celebrates/i.test(text ?? ""), false);
  const ago = render(gretzky(), { wording: "fixed", asOf: "2026-01-26" });
  assert.equal(ago?.text, "Wayne Gretzky was born on this day in 1961.");
  const turns = render(gretzky(), { wording: "seeded", seed: "x", templateId: "birthday-turns", asOf: "2026-01-26" });
  assert.equal(turns, null);
});

test("deceased birthday default names the sourced death year", () => {
  const dead = gretzky({
    livingStatus: "deceased", deathDate: "1948-08-16", eventDate: "1895-02-06",
    person: { personId: 1, qid: "Q1", name: "Babe Ruth", leagueCodes: ["mlb"], franchiseIds: [], teamSeasonIds: [] },
  });
  assert.equal(captionFromFact(dead), "Babe Ruth was born on this day in 1895 (died 1948).");
  assert.equal(/turns|would have turned/i.test(captionFromFact(dead) ?? ""), false);
  const ja = captionFromFact(dead, "ja");
  assert.equal(ja, "Babe Ruthは1895年のこの日に生まれた（1948年死去）。");
});

test("living-only turns template needs sourced living status and asOf on the birthday", () => {
  const living = gretzky({ livingStatus: "living" });
  const hit = render(living, { wording: "fixed", templateId: "birthday-turns", asOf: "2026-01-26" });
  assert.equal(hit?.text, "Wayne Gretzky turns 65 today.");
  assert.equal(render(living, { templateId: "birthday-turns", asOf: "2026-10-16" }), null);
  assert.equal(render(gretzky({ livingStatus: "deceased", deathDate: "2020-01-01" }), { templateId: "birthday-turns", asOf: "2026-01-26" }), null);
});

test("a template that needs a missing field is skipped", () => {
  assert.equal(render(gretzky(), { templateId: "birthday-place" }), null);
  const withPlace = render(gretzky({ birthPlace: "Brantford" }), { templateId: "birthday-place" });
  assert.equal(withPlace?.text, "On this day in 1961, Wayne Gretzky was born in Brantford.");
  assert.equal(render(gretzky(), { templateId: "birthday-years-ago-highlight", asOf: "2026-01-26" }), null);
  const withHonour = render(gretzky({ highlight: "four-time Stanley Cup champion" }), {
    templateId: "birthday-years-ago-highlight", asOf: "2026-01-26",
  });
  assert.equal(withHonour?.text, "65 years ago today: Wayne Gretzky, four-time Stanley Cup champion, was born.");
  assert.equal(render(gretzky({ datePrecision: "year", eventDate: null, bornYear: 1961 }), { wording: "fixed" }), null);
});

test("years-ago is true whether living or not", () => {
  const ago = render(gretzky(), { templateId: "birthday-years-ago", asOf: "2026-01-26" });
  assert.equal(ago?.text, "Wayne Gretzky was born 65 years ago today.");
  const deadAgo = render(gretzky({ livingStatus: "deceased", deathDate: "2020-01-01" }), {
    templateId: "birthday-years-ago", asOf: "2026-01-26",
  });
  assert.equal(deadAgo?.text, "Wayne Gretzky was born 65 years ago today.");
});

test("fixed is stable and seeded variety is deterministic", () => {
  const a = render(gretzky({ birthPlace: "Brantford", highlight: "four-time Stanley Cup champion" }), { wording: "fixed" });
  const b = render(gretzky({ birthPlace: "Brantford", highlight: "four-time Stanley Cup champion" }), { wording: "fixed" });
  assert.equal(a?.templateId, "birthday-on-this-day");
  assert.deepEqual(a, b);
  const seed1 = render(gretzky({ birthPlace: "Brantford" }), { wording: "seeded", seed: "repeat-me", asOf: "2026-01-26" });
  const seed2 = render(gretzky({ birthPlace: "Brantford" }), { wording: "seeded", seed: "repeat-me", asOf: "2026-01-26" });
  assert.deepEqual(seed1, seed2);
  const varied = render(gretzky({ birthPlace: "Brantford" }), { wording: "varied", seed: "repeat-me", asOf: "2026-01-26" });
  assert.deepEqual(varied, seed1);
});

test("varied wording without a seed is refused", () => {
  assert.throws(() => render(gretzky(), { wording: "varied" }), /seed/);
});

test("Japanese birthday default uses the same fields", () => {
  assert.equal(captionFromFact(gretzky(), "ja"), "Wayne Gretzkyは1961年のこの日に生まれた。");
});
