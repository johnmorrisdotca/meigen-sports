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

function morenz(extra: Partial<OnThisDayRecord> = {}): OnThisDayRecord {
  return {
    recordId: "d1", category: "player-death", tags: ["age-at-event"], basis: "source",
    eventDate: "1937-03-08", datePrecision: "day", sport: "ice-hockey", competition: "nhl", league: "nhl",
    person: { personId: 2, qid: "Q537941", name: "Howie Morenz", leagueCodes: ["nhl"], franchiseIds: [10], teamSeasonIds: [] },
    livingStatus: "deceased", deathDate: "1937-03-08", ageYears: 34,
    clubNames: ["Montreal Canadiens"], position: "centre",
    highlight: "three-time Stanley Cup winner",
    source, ...extra,
  };
}

test("a death with club, position and honour names them; missing fields are skipped", () => {
  assert.equal(
    captionFromFact(morenz()),
    "Howie Morenz, the Montreal Canadiens centre and three-time Stanley Cup winner, died on this day in 1937, aged 34.",
  );
  assert.equal(
    captionFromFact(morenz(), "ja"),
    "Howie Morenz（Montreal Canadiens centre、three-time Stanley Cup winner）が1937年のこの日に34歳で死去した。",
  );
  const thin = morenz({ clubNames: [], position: null, highlight: null, ageYears: null });
  assert.equal(captionFromFact(thin), "Howie Morenz died on this day in 1937.");
});

test("a championship final names the winner and the result", () => {
  const final: OnThisDayRecord = {
    recordId: "f1", category: "championship-final", tags: ["championship-win", "match-result"],
    basis: "source", eventDate: "1975-05-10", datePrecision: "day", sport: "ice-hockey",
    competition: "nhl", league: "nhl", homeScore: 5, awayScore: 3, stage: "final",
    home: { name: "Montreal Canadiens", franchiseId: 10, teamSeasonId: 100, soccerTeamId: null, countryCode: "CA", fifaCode: null, flagCode: "CA" },
    away: { name: "Boston Bruins", franchiseId: 11, teamSeasonId: 101, soccerTeamId: null, countryCode: "US", fifaCode: null, flagCode: "US" },
    source,
  };
  assert.equal(captionFromFact(final), "Montreal Canadiens won the 1975 NHL final, beating Boston Bruins 5–3.");
});
