import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { history } from "../src/data/history.ts";
import { offline } from "../src/data/offline.ts";
import type { OnThisDayRecord } from "../src/schema.ts";
import { captionFromFact } from "../src/sentences.ts";
import { cleanLabel, dayContext, factDate, render, renderHistory, renderRun, TEMPLATE_TYPES, TEMPLATES, templatesFor } from "../src/templates/index.ts";
import type { TemplateLocale } from "../src/templates/index.ts";

/** A fact shown outside its own day carries its full date; "today" and "on this day" are for its own day only; no placeholder is ever printed. */
const FACTS = "data/v1/0.1.0/facts";
const source = { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors, CC0.", url: null };
const SAYS_TODAY = /\btoday\b|\bthis day\b|years? ago today|\bturns? \d|今日|この日|歳になる/i;
const PLACEHOLDER = /\(none\)|（none）|\bnull\b|\bundefined\b|\bNaN\b/i;

function readAll(): OnThisDayRecord[] {
  const out: OnThisDayRecord[] = [];
  for (const name of readdirSync(`${FACTS}/store`)) out.push(...(JSON.parse(readFileSync(`${FACTS}/store/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records);
  return out;
}
const records = readAll();
/** A day that is not the record's own day, whatever its month and day. */
const elsewhere = (r: OnThisDayRecord): string => (r.eventDate?.slice(5) === "07-04" ? "2026-07-05" : "2026-07-04");
const hasDate = (text: string, r: OnThisDayRecord, locale: TemplateLocale): boolean => {
  const date = factDate(r, locale);
  return date !== null && text.includes(date);
};

function fact(extra: Partial<OnThisDayRecord>): OnThisDayRecord {
  return {
    recordId: "t:1", category: "game-on-day", tags: [], basis: "source", eventDate: "1945-07-04", datePrecision: "day", sport: "baseball", competition: "mlb", league: "mlb",
    homeScore: 16, awayScore: 4, source,
    home: { name: "Pittsburgh Pirates", franchiseId: 1, teamSeasonId: 10, soccerTeamId: null, countryCode: "US", fifaCode: null, flagCode: "US" },
    away: { name: "New York Giants", franchiseId: 2, teamSeasonId: 20, soccerTeamId: null, countryCode: "US", fifaCode: null, flagCode: "US" },
    ...extra,
  };
}
const person = (name: string): OnThisDayRecord["person"] => ({ personId: 1, qid: "Q1", name, leagueCodes: ["nba"], franchiseIds: [1], teamSeasonIds: [] });
function sampson(extra: Partial<OnThisDayRecord> = {}): OnThisDayRecord {
  return {
    recordId: "t:2", category: "player-birthday", tags: [], basis: "source", eventDate: "1960-07-07", datePrecision: "day", sport: "basketball", competition: "nba", league: "nba",
    person: person("Ralph Sampson"), clubNames: ["Houston Rockets"], position: "C", livingStatus: "unknown", source, ...extra,
  };
}

test("the ticket's four facts: a date outside the day, 'today' only on it, no (none), the known day kept", () => {
  // 1) A game shown on another day: the full date, localized.
  assert.equal(render(fact({}), { asOf: "2026-10-20" })?.text, "On July 4, 1945, Pittsburgh Pirates beat New York Giants 16–4 (MLB).");
  assert.equal(render(fact({}), { asOf: "2026-10-20", locale: "ja" })?.text, "1945年7月4日、Pittsburgh PiratesがNew York Giantsに16対4で勝利した（MLB）。");
  assert.equal(render(fact({}), { asOf: "2026-10-20", templateId: "game-won-against" })?.text, "On July 4, 1945, Pittsburgh Pirates won 16–4 against New York Giants (MLB).");
  // 2) "Today is the birthday of" only on the birthday; elsewhere the date.
  assert.equal(render(sampson(), { templateId: "birthday-of", asOf: "2026-10-20" }), null);
  assert.equal(render(sampson(), { templateId: "birthday-of", asOf: "2026-07-07" })?.text, "Today is the birthday of Ralph Sampson, the Houston Rockets center.");
  assert.equal(render(sampson(), { wording: "fixed", asOf: "2026-10-20" })?.text, "Ralph Sampson, the Houston Rockets center, was born on July 7, 1960.");
  // 3) No placeholder.
  const allegheny = fact({ home: { ...fact({}).home!, name: "Cincinnati Red Stockings" }, away: { ...fact({}).away!, name: "Allegheny Club (none)" }, homeScore: 21, awayScore: 4, eventDate: "1882-05-03" });
  assert.equal(render(allegheny, { asOf: "2026-10-20" })?.text, "On May 3, 1882, Cincinnati Red Stockings beat Allegheny Club 21–4 (MLB).");
  // 4) A birth whose day is known never drops it to a year.
  for (let n = 0; n < 40; n += 1) {
    const out = render(sampson({ birthPlace: "Harrisonburg" }), { wording: "seeded", seed: `s${n}`, asOf: "2026-10-20" });
    assert.ok(out?.text.includes("July 7, 1960") || out?.text.includes("1960年7月7日"), out?.text);
  }
});

test("the same fact on its own day may say today and this day, and keeps the year only", () => {
  assert.equal(dayContext(sampson(), "2026-07-07"), "onThisDay");
  assert.equal(dayContext(sampson(), "2026-10-20"), "anywhere");
  assert.equal(dayContext(sampson(), undefined), "anywhere");
  assert.equal(render(fact({}), { asOf: "2026-07-04" })?.text, "Pittsburgh Pirates beat New York Giants 16–4 (MLB, 1945).");
  assert.equal(render(sampson(), { wording: "fixed", asOf: "2026-07-07" })?.text, "Ralph Sampson, the Houston Rockets center, was born on this day in 1960.");
  assert.equal(render(sampson(), { templateId: "birthday-years-ago", asOf: "2026-07-07" })?.text, "Ralph Sampson, the Houston Rockets center, was born 66 years ago today.");
  assert.equal(render(sampson(), { templateId: "birthday-years-ago", asOf: "2026-10-20" }), null);
});

test("a date is said at the precision the record holds: day, month, year, approximate", () => {
  const elsewhereOf = { asOf: "2026-10-20", templateId: "venue-opened" } as const;
  const venue = (extra: Partial<OnThisDayRecord>): OnThisDayRecord => ({
    recordId: "t:3", category: "venue-opening", tags: [], basis: "source", eventDate: "1884-05-01", datePrecision: "day", sport: "baseball", competition: "mlb", league: "mlb",
    venueName: "League Park", venueCity: "Cleveland", clubNames: ["Cleveland Naps"], source, ...extra,
  });
  assert.equal(render(venue({}), elsewhereOf)?.text, "League Park in Cleveland opened on May 1, 1884; home of the Cleveland Naps.");
  assert.equal(render(venue({ datePrecision: "month", eventDate: "1884-05" }), elsewhereOf)?.text, "League Park in Cleveland opened in May 1884; home of the Cleveland Naps.");
  assert.equal(render(venue({ datePrecision: "year", eventDate: null, seasonStartYear: 1884 }), elsewhereOf)?.text, "League Park in Cleveland opened in 1884; home of the Cleveland Naps.");
  assert.equal(render(venue({ datePrecision: "approximate", eventDate: null, seasonStartYear: 1884 }), elsewhereOf)?.text, "League Park in Cleveland opened around 1884; home of the Cleveland Naps.");
  assert.equal(render(venue({}), { ...elsewhereOf, locale: "ja" })?.text, "League Parkが1884年5月1日に開場した（Cleveland）。Cleveland Napsの本拠地。");
  assert.equal(render(venue({ datePrecision: "month", eventDate: "1884-05" }), { ...elsewhereOf, locale: "ja" })?.text, "League Parkが1884年5月に開場した（Cleveland）。Cleveland Napsの本拠地。");
  // A January 1 on a franchise or an award is how a source writes "some time that year": it is said as the year, never as a day.
  const franchise: OnThisDayRecord = {
    recordId: "t:4", category: "franchise-event", tags: [], basis: "source", eventDate: "1871-01-01", datePrecision: "day", sport: "baseball", competition: "mlb", league: "mlb",
    clubName: "Boston Red Stockings", venueCity: "Boston", source,
  };
  assert.equal(factDate(franchise), "1871");
  assert.equal(factDate({ ...franchise, category: "game-on-day" }), "January 1, 1871");
  assert.equal(dayContext({ ...franchise, category: "game-on-day" }, "2026-01-01"), "onThisDay");
  assert.equal(dayContext(franchise, "2026-01-01"), "anywhere");
});

test("a draft says its year once; an award carries its date; a record's date leads", () => {
  const draft: OnThisDayRecord = {
    recordId: "t:5", category: "draft", tags: [], basis: "source", eventDate: null, datePrecision: "year", draftYear: 1979, sport: "ice-hockey", competition: "nhl", league: "nhl",
    person: person("Wayne Gretzky"), overallPick: 1, clubName: "Edmonton Oilers", source,
  };
  assert.equal(render(draft, { asOf: "2026-10-20", templateId: "draft-picked" })?.text, "Wayne Gretzky was drafted in the 1979 NHL draft No. 1 overall by the Edmonton Oilers.");
  assert.equal(render({ ...draft, datePrecision: "day", eventDate: "1979-08-09" }, { asOf: "2026-10-20", templateId: "draft-picked" })?.text, "On August 9, 1979, Wayne Gretzky was drafted in the 1979 NHL draft No. 1 overall by the Edmonton Oilers.");
  const award: OnThisDayRecord = { ...fact({}), recordId: "t:6", category: "award", awardName: "Super Bowl", winnerName: "Chicago Bears", eventDate: "1986-01-26", homeScore: null, awayScore: null, home: undefined, away: undefined };
  assert.equal(render(award, { asOf: "2026-10-20" })?.text, "On January 26, 1986, Chicago Bears won the Super Bowl (MLB).");
  assert.equal(render({ ...award, datePrecision: "year", eventDate: null, seasonStartYear: 1986 }, { asOf: "2026-10-20" })?.text, "In 1986, Chicago Bears won the Super Bowl (MLB).");
});

test("every template says today only if it is marked for its own day, and every other template carries the date", () => {
  for (const row of TEMPLATES) {
    const saysToday = SAYS_TODAY.test(row.pattern);
    assert.equal(Boolean(row.day), saysToday, `${row.type}/${row.id}/${row.locale}: ${row.pattern}`);
    if (!row.day) {
      // Anywhere the sentence names its date through one of the four date fields, or through the title year of a competition it opens.
      assert.match(row.pattern, /\{(dateLead|leadIn|dateOn|date)\}/, `${row.type}/${row.id}/${row.locale} says no date`);
    }
  }
});

test("each kind of statement has patterns for outside its day, in each language", () => {
  for (const locale of ["en", "ja"] as const) {
    for (const type of TEMPLATE_TYPES) {
      const anywhere = templatesFor(type, locale).filter((row) => !row.day);
      assert.ok(anywhere.length >= 2, `${type} ${locale}: ${anywhere.length} patterns outside the day`);
      assert.ok(anywhere.some((row) => row.role === "default"), `${type} ${locale}: no default outside the day`);
    }
  }
});

test("the whole bundled set: outside its day every sentence has its full date, none says today, none prints a placeholder", () => {
  assert.ok(records.length > 30000);
  for (const locale of ["en", "ja"] as const) {
    for (const r of records) {
      const stored = locale === "en" ? r.text : r.textJa;
      const fixed = captionFromFact(r, locale);
      assert.equal(stored ?? null, fixed, r.recordId);
      if (fixed === null) continue;
      assert.ok(hasDate(fixed, r, locale), `${r.recordId} ${locale}: ${fixed}`);
      assert.equal(SAYS_TODAY.test(fixed), false, `${r.recordId}: ${fixed}`);
      assert.equal(PLACEHOLDER.test(fixed), false, `${r.recordId}: ${fixed}`);
      for (const seed of ["a", "b", "c"]) {
        const out = render(r, { wording: "seeded", seed, locale, asOf: elsewhere(r) });
        if (!out) continue;
        assert.ok(hasDate(out.text, r, locale), `${r.recordId} ${out.templateId} ${locale}: ${out.text}`);
        assert.equal(SAYS_TODAY.test(out.text), false, `${r.recordId} ${out.templateId}: ${out.text}`);
        assert.equal(PLACEHOLDER.test(out.text), false, `${r.recordId} ${out.templateId}: ${out.text}`);
      }
    }
  }
});

test("a run over the whole bundled set, mixed as the demo mixes them, dates every sentence", () => {
  const byId = new Map(records.map((r) => [r.recordId, r]));
  for (const locale of ["en", "ja"] as const) {
    for (let start = 0; start < records.length; start += 97 * 10) {
      // Ten at a time, taken from far apart, as the demo's ten mixed facts are.
      const mixed = Array.from({ length: 10 }, (_, n) => records[(start + n * 3001) % records.length]!);
      for (const row of renderRun(mixed, { seed: `mixed:${start}`, locale, asOf: "2026-10-20" })) {
        const r = byId.get(row.recordId)!;
        if (dayContext(r, "2026-10-20") === "anywhere") {
          assert.ok(hasDate(row.text, r, locale), `${row.recordId} ${row.templateId}: ${row.text}`);
          assert.equal(SAYS_TODAY.test(row.text), false, `${row.recordId} ${row.templateId}: ${row.text}`);
        }
        assert.equal(PLACEHOLDER.test(row.text), false, row.text);
      }
    }
  }
});

test("on a fact's own day the run may say today; on every other day it never does", () => {
  const day = records.filter((r) => r.eventDate?.endsWith("-10-20"));
  assert.ok(day.length > 50);
  let said = 0;
  for (const r of day) {
    for (let n = 0; n < 30; n += 1) if (SAYS_TODAY.test(render(r, { wording: "seeded", seed: `s${n}`, asOf: "2026-10-20" })?.text ?? "")) said += 1;
    for (let n = 0; n < 10; n += 1) assert.equal(SAYS_TODAY.test(render(r, { wording: "seeded", seed: `s${n}`, asOf: "2026-10-21" })?.text ?? ""), false, r.recordId);
  }
  assert.ok(said > 20, "no fact ever said 'today' on its own day");
});

test("the offline set, the day shards and every feed and index carry dated sentences", () => {
  const seen = new Set<string>();
  const check = (r: OnThisDayRecord): void => {
    if (!r.text || seen.has(r.recordId)) return;
    seen.add(r.recordId);
    assert.ok(hasDate(r.text, r, "en"), `${r.recordId}: ${r.text}`);
    if (r.textJa) assert.ok(hasDate(r.textJa, r, "ja"), `${r.recordId}: ${r.textJa}`);
    assert.equal(SAYS_TODAY.test(`${r.text} ${r.textJa ?? ""}`), false, r.recordId);
    assert.equal(PLACEHOLDER.test(`${r.text} ${r.textJa ?? ""}`) || PLACEHOLDER.test(r.home?.name ?? "") || PLACEHOLDER.test(r.away?.name ?? ""), false, r.recordId);
  };
  for (const r of offline) check(r);
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = `${dir}/${name}`;
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".json")) {
        const body = JSON.parse(readFileSync(path, "utf8")) as { records?: OnThisDayRecord[] };
        for (const r of body.records ?? []) if (r && typeof r === "object" && "recordId" in r) check(r);
      }
    }
  };
  walk(`${FACTS}/days`);
  walk(`${FACTS}/feeds`);
  assert.ok(seen.size > 5000, `${seen.size} sentences checked`);
});

test("history rows: dated outside their day, plain on it, no placeholder", () => {
  const rows = history.filter((row) => row.kind === "history" && row.date);
  let worded = 0;
  for (const row of rows) {
    for (const locale of ["en", "ja"] as const) {
      const out = renderHistory(row, { locale, asOf: row.date!.slice(5) === "07-04" ? "2026-07-05" : "2026-07-04" });
      if (!out) continue;
      worded += 1;
      assert.ok(out.text.includes(factDate(row, locale)!), `${row.id}: ${out.text}`);
      assert.equal(SAYS_TODAY.test(out.text), false, out.text);
      assert.equal(PLACEHOLDER.test(out.text), false, out.text);
      // On its own day the same row is said without the date.
      const same = renderHistory(row, { locale, asOf: `2026-${row.date!.slice(5)}`, templateId: out.templateId });
      assert.ok(same && !same.text.includes(factDate(row, locale)!), `${row.id}: ${same?.text}`);
    }
  }
  assert.ok(worded > 1900, `${worded} history sentences`);
});

test("a placeholder for a missing value is never printed, in a name or in a field", () => {
  assert.equal(cleanLabel("Allegheny Club (none)"), "Allegheny Club");
  assert.equal(cleanLabel("Allegheny Club (None)"), "Allegheny Club");
  assert.equal(cleanLabel("Allegheny Club （none）"), "Allegheny Club");
  assert.equal(cleanLabel("(none)"), "");
  assert.equal(cleanLabel("null"), "");
  assert.equal(cleanLabel(undefined), "");
  assert.equal(cleanLabel(null), "");
  assert.equal(cleanLabel("None Such Rovers"), "None Such Rovers");
  // A team that is only a placeholder is no team: no sentence is said rather than one with a hole.
  const nameless = fact({ away: { ...fact({}).away!, name: "(none)" } });
  assert.equal(render(nameless, { asOf: "2026-10-20" }), null);
  const clubs = sampson({ clubNames: ["Houston Rockets (none)", "null"], highlight: "undefined" });
  for (const locale of ["en", "ja"] as const) {
    for (let n = 0; n < 40; n += 1) {
      const out = render(clubs, { wording: "seeded", seed: `s${n}`, locale, asOf: "2026-10-20" });
      assert.ok(out, `seed ${n}`);
      assert.equal(PLACEHOLDER.test(out.text), false, out.text);
    }
  }
});
