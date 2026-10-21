import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { calendarDayInZone, factsFor } from "../src/index.ts";
import { offline } from "../src/data/offline.ts";
import { Facts } from "../scripts/golden.ts";

// 500 people with the day Wikidata gives for their birth and death (the dump of 2026-10-12, CC0), made by `pipeline/audit_dates.py --write-sample`.
// Every one of them must be on the published facts on exactly that day. `pnpm test:dates` runs the whole audit against the dump itself.
interface Sample { readonly qid: string; readonly name: string; readonly birth: string | null; readonly death: string | null }
const sample = (JSON.parse(readFileSync("test/golden/dump-dates-sample.json", "utf8")) as { people: Sample[] }).people;
const facts = new Facts("data/v1/0.1.0/facts");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

test("the sample is 500 people with a date from the dump, Lev Yashin and Ronaldo among them", () => {
  assert.equal(sample.length, 500);
  assert.equal(new Set(sample.map((p) => p.qid)).size, 500);
  for (const p of sample) for (const day of [p.birth, p.death]) assert.ok(day === null || /^\d{4}-\d{2}-\d{2}$/.test(day), `${p.qid} ${day}`);
  assert.equal(sample.find((p) => p.qid === "Q167828")?.birth, "1929-10-22");
  assert.equal(sample.find((p) => p.qid === "Q529207")?.birth, "1976-09-18");
});

test("every birth and death of the sample is on the day the dump gives, in the date, the event day and the sentence", () => {
  const byPerson = new Map<string, typeof facts.all>();
  for (const r of facts.all) {
    const qid = r.person?.qid;
    if (qid) (byPerson.get(qid) ?? byPerson.set(qid, []).get(qid)!).push(r);
  }
  const problems: string[] = [];
  let births = 0, deaths = 0;
  for (const p of sample) {
    const own = byPerson.get(p.qid) ?? [];
    for (const r of own) {
      if (r.birthDate && p.birth && r.birthDate !== p.birth) problems.push(`${r.recordId}: birthDate ${r.birthDate}, Wikidata ${p.birth}`);
      if (r.deathDate && p.death && r.deathDate !== p.death) problems.push(`${r.recordId}: deathDate ${r.deathDate}, Wikidata ${p.death}`);
      const day = r.category === "player-birthday" ? p.birth : r.category === "player-death" ? p.death : null;
      if (day && r.eventDate !== day) problems.push(`${r.recordId}: eventDate ${r.eventDate}, Wikidata ${day}`);
      if (day && r.eventDate === day) {
        if (r.category === "player-birthday") births += 1; else deaths += 1;
        if (r.recordId.split(":").at(-1) !== day) problems.push(`${r.recordId}: the id names another day than ${day}`);
        // "... was born on October 22, 1929 ..." says the same day the date does.
        const said = /(?:born|died) on ([A-Z][a-z]+) (\d{1,2}), (\d{4})/.exec(r.text ?? "");
        if (said && `${said[3]}-${String(MONTHS.indexOf(said[1]) + 1).padStart(2, "0")}-${said[2].padStart(2, "0")}` !== day) problems.push(`${r.recordId}: the sentence says ${said[0]}`);
      }
    }
    if (p.birth && !own.some((r) => r.category === "player-birthday") && !own.some((r) => r.birthDate)) problems.push(`${p.qid} ${p.name}: no birth fact`);
  }
  assert.deepEqual(problems, []);
  assert.ok(births >= 300 && deaths >= 100, `${births} birthday facts and ${deaths} death facts checked`);
});

test("Lev Yashin is on October 22, not October 21, and Ronaldo on September 18", () => {
  const yashin = facts.all.filter((r) => r.person?.qid === "Q167828" && r.category === "player-birthday");
  assert.deepEqual(yashin.map((r) => r.eventDate), ["1929-10-22"]);
  assert.match(yashin[0].text ?? "", /October 22, 1929/);
  assert.ok(facts.day("2026-10-22").some((r) => r.recordId === yashin[0].recordId));
  assert.ok(!facts.day("2026-10-21").some((r) => r.person?.qid === "Q167828" && r.category === "player-birthday"));
  assert.ok(!facts.all.some((r) => r.person?.qid === "Q529207" && r.eventDate === "1976-09-22"));
});

test("a day is the same text everywhere: a viewer's own day picks the facts of that day, whatever the zone", () => {
  // 03:30 UTC on October 22 is still the evening of October 21 in Toronto and already the 22nd in Tokyo.
  assert.equal(calendarDayInZone("America/Toronto", "2026-10-22T03:30:00Z"), "10-21");
  assert.equal(calendarDayInZone("Asia/Tokyo", "2026-10-22T03:30:00Z"), "10-22");
  assert.equal(calendarDayInZone("UTC", "2026-10-22T00:00:00Z"), "10-22");
  const on = (day: string) => factsFor(offline, { date: day }).map((r) => r.recordId);
  for (const id of on("10-22")) assert.ok((offline.find((r) => r.recordId === id)?.eventDate ?? "").endsWith("-10-22"), id);
  for (const id of on("10-21")) assert.ok(!id.endsWith(":1929-10-22"), id);
});

function sources(directory: string, out: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) { if (name !== "node_modules") sources(path, out); }
    else if (name.endsWith(".ts") && !path.endsWith("src/data/offline.ts")) out.push(path);
  }
  return out;
}

test("no code reads a bare date through the local time zone", () => {
  const problems: string[] = [];
  for (const file of [...sources("src"), ...sources("scripts"), ...sources("demo")]) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      // new Date("2026-10-22") and Date.parse("2026-10-22") are UTC, but new Date(2026, 9, 22) and a date with no zone in a template are local.
      const bare = /(?:new Date|Date\.parse)\(\s*(?:"\d{4}-\d{2}-\d{2}"|'\d{4}-\d{2}-\d{2}'|`\$\{[^`]*\}`)\s*\)/.test(line);
      const local = /new Date\(\s*\d{4}\s*,/.test(line);
      const zoneless = /(?:new Date|Date\.parse)\(\s*`[^`]*\d{2}[^`]*`\s*\)/.test(line) && !/T00:00:00Z|Z`/.test(line);
      if (bare || local || zoneless) problems.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
      // The viewer's own "today" is the one local reading, and it is in the demo only.
      if (/\.get(?:FullYear|Month|Date|Day|Hours)\(\)/.test(line) && file !== join("demo", "demo.ts")) problems.push(`${file}:${i + 1}: local-time getter`);
    });
  }
  assert.deepEqual(problems, []);
});
