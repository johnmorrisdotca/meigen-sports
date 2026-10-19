import assert from "node:assert/strict";
import test from "node:test";
import type { OnThisDayRecord } from "../src/schema.ts";
import { render } from "../src/templates/index.ts";

const base: OnThisDayRecord = {
  recordId: "birth", category: "player-birthday", tags: ["player-birthday"], basis: "source", eventDate: "1961-01-26", datePrecision: "day", birthDate: "1961-01-26",
  sport: "ice-hockey", competition: "nhl", league: "nhl", source: { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors, CC0.", url: null },
  person: { personId: 1, qid: "Q209518", name: "Wayne Gretzky", leagueCodes: ["nhl"], franchiseIds: [], teamSeasonIds: [] }, clubNames: ["Edmonton Oilers"], position: "centre",
};
const people = {
  unknown: { ...base },
  deceased: { ...base, livingStatus: "deceased" as const, deathDate: "2020-03-01" },
  "deceased without a sourced death date": { ...base, livingStatus: "deceased" as const },
  living: { ...base, livingStatus: "living" as const },
};
const days = ["2026-01-26", "2026-10-16", "1961-01-26", undefined];
const turns = /\bturns?\b|would have turned|\bturned\b|歳になる|celebrates/i;

test("only a person a source says is living can ever turn a number, and only on the birthday", () => {
  for (const [status, record] of Object.entries(people)) {
    for (const locale of ["en", "ja"] as const) {
      for (const asOf of days) {
        for (const wording of ["fixed", "seeded", "varied"] as const) {
          for (let n = 0; n < 60; n += 1) {
            const out = render(record, { wording, seed: `s${n}`, locale, asOf });
            assert.ok(out, `${status} ${locale} ${asOf} ${wording} says nothing`);
            const onBirthday = asOf !== undefined && asOf.slice(5) === "01-26" && asOf > "1961-01-26";
            if (turns.test(out.text)) assert.ok(status === "living" && onBirthday, `${status} ${locale} ${asOf}: ${out.text}`);
            assert.match(out.text, /born|birthday|生まれ|誕生日|turns|歳になる/, out.text);
          }
        }
      }
    }
  }
});

test("a living person on the birthday can turn a number; the same person on another day cannot", () => {
  let seen = false;
  for (let n = 0; n < 200 && !seen; n += 1) seen = /turns 65 today/.test(render(people.living, { wording: "seeded", seed: `s${n}`, asOf: "2026-01-26" })?.text ?? "");
  assert.ok(seen, "a source-confirmed living person never turns 65");
  for (let n = 0; n < 200; n += 1) assert.ok(!turns.test(render(people.living, { wording: "seeded", seed: `s${n}`, asOf: "2026-10-16" })?.text ?? ""));
});

test("the age is said as years ago today, not as an age, whether the person is living, dead or unknown", () => {
  for (const [status, record] of Object.entries(people)) {
    const ago = render(record, { wording: "seeded", seed: "x", templateId: "birthday-years-ago", asOf: "2026-01-26" });
    assert.equal(ago?.text.includes("was born 65 years ago today"), true, status);
  }
  assert.equal(render(people.unknown, { wording: "fixed" })?.text, "Wayne Gretzky, the Edmonton Oilers centre, was born on this day in 1961.");
  assert.equal(render(people.deceased, { wording: "fixed" })?.text, "Wayne Gretzky, the Edmonton Oilers centre, was born on this day in 1961 (died 2020).");
});

test("the three wording modes: fixed never moves, seeded repeats for a seed, varied needs one", () => {
  const fixed = new Set<string>(), seededA: string[] = [], seededB: string[] = [];
  for (let n = 0; n < 50; n += 1) {
    fixed.add(render(people.unknown, { wording: "fixed", seed: `s${n}`, asOf: "2026-01-26" })!.text);
    seededA.push(render(people.unknown, { wording: "seeded", seed: `s${n}`, asOf: "2026-01-26" })!.text);
    seededB.push(render(people.unknown, { wording: "seeded", seed: `s${n}`, asOf: "2026-01-26" })!.text);
  }
  assert.equal(fixed.size, 1);
  assert.deepEqual(seededA, seededB);
  assert.ok(new Set(seededA).size > 2, "seeded wording never varies");
  assert.throws(() => render(people.unknown, { wording: "varied" }), /seed/);
  assert.equal(render(people.unknown, { wording: "varied", seed: "k" })?.text, render(people.unknown, { wording: "varied", seed: "k" })?.text);
});
