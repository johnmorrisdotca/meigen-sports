import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { history } from "../src/data/history.ts";
import type { OnThisDayRecord, RecordProgression } from "../src/schema.ts";
import { finalCaptionFromMatch } from "../src/mergeEvents.ts";
import { prepare } from "../src/templates/render.ts";
import { render, renderHistory, renderRun, TEMPLATE_TYPES, TEMPLATES, templatesFor } from "../src/templates/index.ts";
import type { SentenceTemplate, TemplateLocale, TemplateType } from "../src/templates/index.ts";
import type { MeigenRecord } from "../src/types.ts";

const source = { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors, CC0.", url: "https://www.wikidata.org/" };
const team = (name: string, id: number, national = false): OnThisDayRecord["home"] => ({
  name, franchiseId: national ? null : id, teamSeasonId: id * 10, soccerTeamId: null, countryCode: "US", fifaCode: national ? "ARG" : null, flagCode: "US",
});
const base = { tags: [], basis: "source" as const, datePrecision: "day" as const, source };

function person(name: string, qid: string): NonNullable<OnThisDayRecord["person"]> {
  return { personId: null, qid, name, leagueCodes: [], franchiseIds: [], teamSeasonIds: [] };
}

/** One rich record per kind of statement, and the variants that open the other templates. */
function fixtures(): OnThisDayRecord[] {
  const set: RecordProgression = { metric: "goals", scope: "career", phase: null, holderName: "Wayne Gretzky", holderPersonId: null, value: 894, unit: "goals", previousHolderName: "Gordie Howe", previousHolderPersonId: null, previousValue: 801, setDate: null, surpassedDate: null, recognition: "ratified", event: "set" };
  return [
    { ...base, recordId: "birth-living", category: "player-birthday", eventDate: "1961-01-26", sport: "ice-hockey", competition: "nhl", league: "nhl", person: person("Wayne Gretzky", "Q209518"), clubNames: ["Edmonton Oilers"], position: "centre", birthPlace: "Brantford", highlight: "four-time Stanley Cup champion", livingStatus: "living" },
    { ...base, recordId: "birth-dead", category: "player-birthday", eventDate: "1895-02-06", deathDate: "1948-08-16", sport: "baseball", competition: "mlb", league: "mlb", person: person("Babe Ruth", "Q1"), clubNames: ["New York Yankees"], position: "outfielder", birthPlace: "Baltimore", highlight: "seven-time World Series champion", livingStatus: "deceased" },
    { ...base, recordId: "death", category: "player-death", eventDate: "1937-03-08", deathDate: "1937-03-08", sport: "ice-hockey", competition: "nhl", league: "nhl", person: person("Howie Morenz", "Q537941"), clubNames: ["Montreal Canadiens"], position: "centre", highlight: "three-time Stanley Cup winner", ageYears: 34, livingStatus: "deceased" },
    { ...base, recordId: "game", category: "game-on-day", eventDate: "1900-06-01", seasonStartYear: 1900, sport: "baseball", competition: "mlb", league: "mlb", homeScore: 10, awayScore: 3, home: team("Pittsburgh Pirates", 1), away: team("Brooklyn Superbas", 2), venueName: "Exposition Park", venueCity: "Allegheny", seriesGameNumber: 2, wentToOvertime: true, stage: "playoffs" },
    { ...base, recordId: "game-lopsided", category: "game-on-day", eventDate: "1940-12-08", sport: "american-football", competition: "nfl", league: "nfl", homeScore: 73, awayScore: 0, home: team("Chicago Bears", 3), away: team("Washington Redskins", 4) },
    { ...base, recordId: "game-tie", category: "game-on-day", eventDate: "1950-10-01", sport: "american-football", competition: "nfl", league: "nfl", homeScore: 14, awayScore: 14, home: team("Chicago Bears", 3), away: team("Green Bay Packers", 5) },
    { ...base, recordId: "final", category: "championship-final", eventDate: "1975-05-10", sport: "ice-hockey", competition: "nhl", league: "nhl", homeScore: 5, awayScore: 3, stage: "final", home: team("Montreal Canadiens", 10), away: team("Boston Bruins", 11), venueName: "Montreal Forum", venueCity: "Montreal", wentToOvertime: true },
    { ...base, recordId: "final-penalties", category: "soccer-on-day", eventDate: "2022-12-18", sport: "soccer", competition: "wc", league: "wc", homeScore: 3, awayScore: 3, stage: "final", seasonStartYear: 2022, home: team("Argentina", 30, true), away: team("France", 31, true) },
    { ...base, recordId: "final-lopsided", category: "championship-final", eventDate: "1934-10-09", sport: "baseball", competition: "mlb", league: "mlb", homeScore: 11, awayScore: 0, stage: "final", home: team("St. Louis Cardinals", 20), away: team("Detroit Tigers", 21) },
    { ...base, recordId: "record", category: "milestone", eventDate: "1999-03-23", sport: "ice-hockey", competition: "nhl", league: "nhl", record: set },
    { ...base, recordId: "award", category: "award", eventDate: "1986-01-26", sport: "american-football", competition: "nfl", league: "nfl", awardName: "Super Bowl", winnerName: "Chicago Bears" },
    { ...base, recordId: "draft", category: "draft", eventDate: null, datePrecision: "year", draftYear: 1979, sport: "ice-hockey", competition: "nhl", league: "nhl", person: person("Wayne Gretzky", "Q209518"), overallPick: 1, clubName: "Edmonton Oilers" },
    { ...base, recordId: "venue", category: "venue-opening", eventDate: "1884-05-01", sport: "baseball", competition: "mlb", league: "mlb", venueName: "League Park", venueCity: "Cleveland", clubNames: ["Cleveland Naps"], highlight: "the 1920 World Series" },
    { ...base, recordId: "franchise", category: "franchise-event", eventDate: "1871-05-05", sport: "baseball", competition: "mlb", league: "mlb", clubName: "Boston Red Stockings", venueCity: "Boston" },
    { ...base, recordId: "first", category: "first", eventDate: "1947-04-15", sport: "baseball", competition: "mlb", league: "mlb", person: person("Jackie Robinson", "Q1"), highlight: "first game in the major leagues" },
  ];
}

const wc = (text: string, id: string): MeigenRecord => ({
  id, kind: "history", types: ["match-result"], text, language: "en", sports: ["soccer"], tags: ["world-cup"], date: "2022-12-18", monthDay: "12-18", dateRole: "match", speaker: null, entities: [],
  source: { sourceId: "openfootball", key: id, url: "https://example.com", title: "t", licence: "CC0-1.0", rightsStatus: "cc0", attribution: "a", rightsReasoning: "CC0 structured facts; this caption is original wording, not quoted speech.", rawSha256: "a".repeat(64), rightsEvidence: ["https://example.com"] },
});

function historyFixtures(): MeigenRecord[] {
  return [
    wc("Brazil 3–1 Chile (World Cup 1950, Group 1).", "h1"),
    wc("Brazil 2–2 Chile (World Cup 1950, Group 1).", "h2"),
    wc("Italy 3–2 Brazil (World Cup 1982, Second round; after extra time).", "h3"),
    wc("Argentina 3–3 France (World Cup 2022, Final; after extra time; penalties 4–2).", "h4"),
    wc("Argentina 2–1 Germany (World Cup 1986, Final).", "h5"),
    wc("France 3–3 Italy (World Cup 2006, Final; after extra time; penalties 3–5).", "h6"),
    wc("2022 FIFA World Cup began.", "h7"),
    wc("2022 FIFA World Cup ended.", "h8"),
    wc("Super Bowl I took place.", "h9"),
  ].map((row, index) => (index >= 6 ? { ...row, types: ["competition-boundary"] } : row));
}

const everyone = (): readonly (OnThisDayRecord | MeigenRecord)[] => [...fixtures(), ...historyFixtures()];

test("every kind of statement has at least three patterns in each language, per situation", () => {
  const counts = (type: TemplateType, locale: TemplateLocale, keep: (row: SentenceTemplate) => boolean): number => templatesFor(type, locale).filter(keep).length;
  for (const locale of ["en", "ja"] as const) {
    for (const type of TEMPLATE_TYPES) {
      const situations: [string, (row: SentenceTemplate) => boolean][] = type === "game" || type === "world-cup-match"
        ? [["decisive", (row) => row.when !== "tie"], ["tie", (row) => row.when === "tie"]]
        : type === "birthday" ? [["neutral", (row) => row.gate === "neutral"]]
        : type === "death" ? [["deceased", (row) => row.gate === "deceased"]]
        : [["all", () => true]];
      for (const [name, keep] of situations) assert.ok(counts(type, locale, keep) >= 3, `${type} ${locale} ${name}`);
    }
  }
});

test("template ids and patterns are unique inside a type and language", () => {
  const seen = new Set<string>();
  for (const row of TEMPLATES) {
    const key = `${row.type}|${row.locale}|${row.id}`;
    assert.equal(seen.has(key), false, `duplicate id ${key}`);
    seen.add(key);
  }
  const patterns = new Set<string>();
  for (const row of TEMPLATES) {
    const key = `${row.type}|${row.locale}|${row.gate}|${row.when ?? ""}|${row.pattern}`;
    assert.equal(patterns.has(key), false, `duplicate pattern ${key}`);
    patterns.add(key);
  }
});

test("every template can render: none is dead, none leaves a hole", () => {
  const rows = everyone();
  for (const row of TEMPLATES) {
    let text: string | null = null;
    for (const item of rows) {
      const out = "kind" in item ? renderHistory(item, { templateId: row.id, locale: row.locale, asOf: "2026-01-26" })
        : render(item, { templateId: row.id, locale: row.locale, asOf: "2026-01-26" });
      if (out) { text = out.text; break; }
    }
    assert.ok(text, `${row.type}/${row.id}/${row.locale} matches no fixture`);
    assert.equal(/[{}]|undefined|NaN|\bnull\b/.test(text), false, `${row.id}/${row.locale}: ${text}`);
    assert.equal(/ {2}|\.\.|,,| ,|\( /.test(text), false, `${row.id}/${row.locale}: ${text}`);
  }
});

test("render.ts and mergeEvents.ts write no sentence words of their own", () => {
  // Every phrase a reader sees is a row in catalog.ts or phrases.ts. A string literal with sentence words in these files is a hard-coded phrasing.
  const words = /\b(the|was|were|and|of|won|beat|beating|died|born|opened|aged|began|ended|drew|lost|defeated|played|hosted|took place|draft|overall)\b/i;
  for (const file of ["src/templates/render.ts", "src/templates/run.ts", "src/mergeEvents.ts", "src/sentences.ts"]) {
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const match of code.matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
      const literal = match[1] ?? match[2] ?? "";
      if (/^[a-z./-]+(\.ts)?$/.test(literal)) continue;
      const line = code.slice(0, match.index).split("\n").length;
      const context = code.split("\n")[line - 1] ?? "";
      if (/RangeError|throw |new Error/.test(context)) continue;
      assert.equal(words.test(literal), false, `${file}:${line} ${JSON.stringify(literal)}`);
    }
  }
});

test("each word choice is a pure function of the seed: same seed, same words; other seeds can differ", () => {
  const rows = everyone();
  const a = renderRun(rows, { seed: "alpha", asOf: "2026-01-26" });
  const b = renderRun(rows, { seed: "alpha", asOf: "2026-01-26" });
  assert.deepEqual(a, b);
  const others = new Set(["beta", "gamma", "delta", "epsilon"].map((seed) => JSON.stringify(renderRun(rows, { seed, asOf: "2026-01-26" }).map((s) => s.text))));
  assert.ok(others.size > 1, "different seeds never changed a word");
  assert.throws(() => renderRun(rows, { seed: "" }), /seed/);
});

/** Adjacent sentences must not read alike. `uniform` runs repeat one kind of statement so only the rules can keep them apart. */
function assertNoAdjacentRepeats(label: string, run: ReturnType<typeof renderRun>, locale: TemplateLocale): void {
  for (let i = 1; i < run.length; i += 1) {
    const [prev, now] = [run[i - 1]!, run[i]!];
    assert.notEqual(now.text, prev.text, `${label} ${locale} #${i}: same text`);
    const shape = (id: string, type: string): string => TEMPLATES.find((row) => row.id === id && row.type === type && row.locale === locale)!.pattern.replace(/\{\w+\}/g, "_");
    if (templatesFor(now.type, locale).length > 1 && now.type === prev.type) {
      assert.notEqual(now.templateId, prev.templateId, `${label} ${locale} #${i}: ${now.templateId} twice in a row`);
      assert.notEqual(shape(now.templateId, now.type), shape(prev.templateId, prev.type), `${label} ${locale} #${i}: same outline`);
    }
  }
}

test("no two adjacent sentences repeat, in a run of one kind of statement", () => {
  for (const locale of ["en", "ja"] as const) {
    const facts = fixtures();
    const cases: [string, (OnThisDayRecord | MeigenRecord)[]][] = [
      ["birthdays", [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1].map((n, i) => ({ ...facts[n]!, recordId: `b${i}` }))],
      ["games", [3, 3, 3, 3, 3, 3, 3, 3].map((n, i) => ({ ...facts[n]!, recordId: `g${i}` }))],
      ["finals", [6, 7, 6, 7, 6, 7, 6, 7].map((n, i) => ({ ...facts[n]!, recordId: `f${i}` }))],
      ["ties", [5, 5, 5, 5, 5, 5].map((n, i) => ({ ...facts[n]!, recordId: `t${i}` }))],
      ["draws", [1, 1, 1, 1, 1, 1].map((n, i) => ({ ...historyFixtures()[n]!, id: `w${i}` }))],
      ["boundaries", [6, 7, 6, 7, 6, 7].map((n, i) => ({ ...historyFixtures()[n]!, id: `x${i}` }))],
    ];
    for (const [label, items] of cases) {
      for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6"]) {
        const run = renderRun(items, { seed, locale, asOf: "2026-01-26" });
        assert.ok(run.length >= items.length - 6, `${label} ${locale}: only ${run.length} of ${items.length} worded`);
        assertNoAdjacentRepeats(label, run, locale);
        // with three or more patterns a template is not reused within two places
        for (let i = 2; i < run.length; i += 1) {
          if (run[i]!.type === run[i - 1]!.type && run[i]!.type === run[i - 2]!.type && !["draws"].includes(label)) {
            const pool = prepare(items[i]!, locale, "seeded", seed, "2026-01-26")?.pool.length ?? 0;
            if (pool >= 3) assert.notEqual(run[i]!.templateId, run[i - 2]!.templateId, `${label} ${locale} #${i}: reused within two`);
          }
        }
      }
    }
  }
});

test("a run over the real facts never repeats a neighbour", () => {
  const records: OnThisDayRecord[] = [];
  const dir = "data/v1/0.1.0/facts/days";
  for (const name of readdirSync(dir).slice(0, 120)) {
    const shard = JSON.parse(readFileSync(`${dir}/${name}`, "utf8")) as { records: OnThisDayRecord[] };
    records.push(...shard.records.slice(0, 12));
  }
  assert.ok(records.length > 600);
  for (const locale of ["en", "ja"] as const) {
    const run = renderRun(records, { seed: "real", locale });
    assert.ok(run.length > 500);
    for (let i = 1; i < run.length; i += 1) {
      assert.notEqual(run[i]!.text, run[i - 1]!.text, `#${i}`);
      const prepared = prepare(records.find((r) => r.recordId === run[i]!.recordId)!, locale, "seeded", "real", undefined);
      const ids = new Set(prepared?.pool.map((row) => row.id));
      // when the record had another template and the neighbour's template is one of its choices, the neighbour's is not reused
      if (ids.size >= 2 && ids.has(run[i - 1]!.templateId) && run[i]!.type === run[i - 1]!.type) assert.notEqual(run[i]!.templateId, run[i - 1]!.templateId, `#${i} ${locale}`);
    }
  }
});

test("history rows are worded from the patterns; unknown lines and quotations are left alone", () => {
  assert.equal(renderHistory(historyFixtures()[0]!)?.text, "Brazil beat Chile 3–1 in the 1950 World Cup, Group 1.");
  assert.equal(renderHistory(historyFixtures()[1]!)?.text, "Brazil and Chile drew 2–2 at the 1950 World Cup, Group 1.");
  assert.equal(renderHistory(historyFixtures()[3]!)?.text, "Argentina won the 2022 World Cup, beating France 4–2 on penalties after a 3–3 draw.");
  assert.equal(renderHistory(historyFixtures()[5]!)?.text, "Italy won the 2006 World Cup, beating France 5–3 on penalties after a 3–3 draw.");
  assert.equal(renderHistory(historyFixtures()[6]!)?.text, "The 2022 FIFA World Cup began.");
  assert.equal(renderHistory(historyFixtures()[8]!)?.text, "Super Bowl I took place.");
  assert.equal(renderHistory({ ...historyFixtures()[0]!, text: "Some other line." }), null);
  assert.equal(renderHistory({ ...historyFixtures()[0]!, kind: "quote" }), null);
  assert.equal(finalCaptionFromMatch("Argentina 2–1 Germany (World Cup 1986, Final)."), "Argentina won the 1986 World Cup, beating Germany 2–1.");
  assert.equal(finalCaptionFromMatch("Argentina 1–1 Germany (World Cup 1986, Final)."), null);
  assert.equal(finalCaptionFromMatch("Argentina 2–1 Germany (World Cup 1986, Group 1)."), null);
});

test("every bundled history row is either worded by a pattern or is a line the patterns do not claim", () => {
  const rows = history.filter((row) => row.kind === "history");
  const worded = rows.filter((row) => renderHistory(row) !== null);
  const unclaimed = rows.filter((row) => renderHistory(row) === null).map((row) => row.text);
  assert.ok(worded.length >= rows.length - 5, `only ${worded.length} of ${rows.length}; unclaimed: ${unclaimed.slice(0, 5).join(" | ")}`);
  const run = renderRun(rows, { seed: "history" });
  assert.ok(run.length > 900);
  for (let i = 1; i < run.length; i += 1) assert.notEqual(run[i]!.text, run[i - 1]!.text, `#${i}`);
  const ja = renderRun(rows, { seed: "history", locale: "ja" });
  assert.ok(ja.length > 900);
  for (let i = 1; i < ja.length; i += 1) assert.notEqual(ja[i]!.text, ja[i - 1]!.text, `#${i}`);
});

test("a soccer or national side never takes 'the'; a team-sport club does", () => {
  const nfl = fixtures()[4]!;
  assert.match(render(nfl, { templateId: "game-dominated" })?.text ?? "", /^The Chicago Bears dominated the Washington Redskins/);
  const soccer: OnThisDayRecord = { ...nfl, recordId: "s", sport: "soccer", league: "wc", competition: "wc", homeScore: 5, awayScore: 0, home: team("Argentina", 1, true), away: team("Chile", 2, true) };
  assert.match(render(soccer, { templateId: "game-defeated" })?.text ?? "", /^Argentina defeated Chile 5–0/);
});

test("a fixed sentence never moves; a fragment alternate appears only when the wording is seeded", () => {
  const game = fixtures()[3]!;
  assert.match(render(game, { wording: "fixed", templateId: "game-beat" })?.text ?? "", / in overtime/);
  const seen = new Set<string>();
  for (let n = 0; n < 40; n += 1) seen.add(/ (in overtime|in extra innings|after extra innings)/.exec(render(game, { wording: "seeded", seed: `k${n}`, templateId: "game-beat" })?.text ?? "")?.[1] ?? "");
  assert.ok(seen.has("in overtime") && seen.size > 1, [...seen].join(","));
});
