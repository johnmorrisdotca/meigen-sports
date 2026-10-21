import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { offline } from "../src/data/offline.ts";
import type { OnThisDayRecord } from "../src/schema.ts";
import { prepare, sentenceFrom } from "../src/templates/render.ts";
import { render, TEMPLATES } from "../src/templates/index.ts";
import type { TemplateLocale } from "../src/templates/index.ts";

/** John, 2026-10-20: "was born 95 years ago today" made the reader do the sum. Any sentence a fact says on its own day states the year. */
const FACTS = "data/v1/0.1.0/facts";
const source = { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors, CC0.", url: null };

function shard(path: string): OnThisDayRecord[] {
  return (JSON.parse(readFileSync(`${FACTS}/${path}`, "utf8")) as { records: OnThisDayRecord[] }).records;
}
function sample(): OnThisDayRecord[] {
  const byId = new Map<string, OnThisDayRecord>();
  for (const r of offline) byId.set(r.recordId, r);
  for (const dir of ["days", "people", "events"]) for (const name of readdirSync(`${FACTS}/${dir}`)) for (const r of shard(`${dir}/${name}`)) byId.set(r.recordId, r);
  // One fact in twenty of the whole set, so every category and sport is read.
  for (const name of readdirSync(`${FACTS}/store`)) shard(`store/${name}`).forEach((r, at) => { if (at % 20 === 0) byId.set(r.recordId, r); });
  return [...byId.values()].filter((r) => r.datePrecision === "day" && /^\d{4}-\d{2}-\d{2}$/.test(r.eventDate ?? ""));
}

test("on its own day, every sentence a fact can be worded in holds its four-digit year, in English and in Japanese", () => {
  const facts = sample();
  assert.ok(facts.length > 10000, `only ${facts.length} facts read`);
  let sentences = 0;
  for (const fact of facts) {
    const year = fact.eventDate!.slice(0, 4);
    const asOf = `2026-${fact.eventDate!.slice(5)}`;
    for (const locale of ["en", "ja"] as TemplateLocale[]) {
      const prepared = prepare(fact, locale, "seeded", "year", asOf);
      if (!prepared) continue;
      for (const template of prepared.pool) {
        const text = sentenceFrom(prepared, template);
        if (!text) continue;
        sentences += 1;
        assert.ok(text.includes(year), `${fact.recordId} ${template.id}/${locale} on its own day does not say ${year}: ${text}`);
      }
    }
  }
  assert.ok(sentences > 20000, `only ${sentences} sentences checked`);
});

test("every template marked for the day carries the year as a field", () => {
  for (const template of TEMPLATES.filter((row) => row.day)) {
    assert.ok(/\{year\}|\{yearOnly\}|\{leadIn\}|\{dateOn\}/.test(template.pattern), `${template.id}/${template.locale} says "today" with no year: ${template.pattern}`);
    assert.ok(template.needs.includes("year") || /\{leadIn\}|\{dateOn\}/.test(template.pattern), `${template.id}/${template.locale} does not need the year`);
  }
});

test("the ticket's sentences, in English and Japanese", () => {
  const mantle: OnThisDayRecord = {
    recordId: "t:mantle", category: "player-birthday", tags: [], basis: "source", eventDate: "1931-10-20", datePrecision: "day", sport: "baseball", competition: "mlb", league: "mlb",
    person: { personId: 1, qid: "Q1", name: "Mickey Mantle", leagueCodes: ["mlb"], franchiseIds: [1], teamSeasonIds: [] }, clubNames: ["New York Yankees"], position: "CF", livingStatus: "deceased", deathDate: "1995-08-13", championships: 7, championshipName: "World Series", source,
  };
  assert.equal(render(mantle, { templateId: "birthday-years-ago", asOf: "2026-10-20" })?.text, "Mickey Mantle, the New York Yankees center fielder, was born 95 years ago today, in 1931.");
  assert.equal(render(mantle, { templateId: "birthday-years-ago", asOf: "2026-10-20", locale: "ja" })?.text, "Mickey Mantle（New York Yankeesの中堅手）は95年前の今日、1931年に生まれた。");
  assert.equal(render(mantle, { templateId: "birthday-of", asOf: "2026-10-20", locale: "ja" })?.text, "今日はMickey Mantle（New York Yankeesの中堅手）の誕生日（1931年生まれ）。");
});

test("the bundled history rows say their year on their own day too", async () => {
  const { history } = await import("../src/data/history.ts");
  let checked = 0;
  for (const row of history) {
    if (row.kind !== "history" || !row.date) continue;
    const year = row.date.slice(0, 4);
    for (const locale of ["en", "ja"] as TemplateLocale[]) {
      const prepared = prepare(row, locale, "seeded", "year", `2026-${row.date.slice(5)}`);
      if (!prepared) continue;
      for (const template of prepared.pool) {
        const text = sentenceFrom(prepared, template);
        if (!text) continue;
        checked += 1;
        assert.ok(text.includes(year), `${row.id} ${template.id}/${locale} does not say ${year}: ${text}`);
      }
    }
  }
  assert.ok(checked > 500, `only ${checked} sentences checked`);
});
