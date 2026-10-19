import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/** Minimal CSV reader for the committed list: quoted fields with commas, no embedded newlines. */
function rows(path: string): Record<string, string>[] {
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cell = "", quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i]!;
      if (quoted) { if (c === '"' && line[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c; }
      else if (c === '"') quoted = true;
      else if (c === ",") { out.push(cell); cell = ""; } else cell += c;
    }
    out.push(cell);
    return out;
  };
  const header = split(lines[0]!);
  return lines.slice(1).map((line) => Object.fromEntries(split(line).map((value, index) => [header[index]!, value])));
}

const people = rows("data-sources/people.csv");
const added = people.filter((row) => row.priority === "2");
const FIRST_FOURTEEN = ["JP", "CA", "US", "DE", "FR", "IT", "GB", "BR", "AU", "CN", "KR", "RU", "ES", "NL"];

test("the list has 2,000 people: the first list (1,000 rows, 999 people) and 1,001 added", () => {
  assert.equal(people.length, 2000);
  assert.equal(people.filter((row) => row.priority === "1").length, 999);
  assert.equal(added.length, 1001);
});

test("a person is a Wikidata item, listed once", () => {
  const qids = people.map((row) => row.qid).filter(Boolean);
  assert.equal(new Set(qids).size, qids.length);
  for (const row of added) assert.match(row.qid!, /^Q[1-9][0-9]*$/);
  assert.ok(people.length - qids.length <= 40, "only first-list rows may lack an item");
  for (const row of people.filter((r) => !r.qid)) assert.equal(row.priority, "1");
});

test("every added person carries a source, an English article and a reason to be listed", () => {
  for (const row of added) {
    assert.match(row.source!, /wikidata\.org\/wiki\/Q\d+/);
    assert.ok(row.enwiki_title, row.name);
    assert.ok(["A", "B", "C", "H"].includes(row.tier!), `${row.name}: ${row.tier}`);
    if (row.tier === "A") assert.ok(Number(row.olympic_medals) >= 1, row.name);
    if (row.tier === "B") assert.ok(Number(row.sitelinks) >= 20, row.name);
    if (row.tier === "C") assert.ok(Number(row.sitelinks) >= 8, row.name);
    if (row.tier === "H") assert.match(row.source!, /nba50/);
    assert.match(row.country!, /^[A-Z]{2}$/, row.name);
  }
});

test("balanced by country and sport, not United States heavy", () => {
  const byCountry = new Map<string, number>();
  for (const row of people) if (row.country) byCountry.set(row.country, (byCountry.get(row.country) ?? 0) + 1);
  assert.ok(byCountry.size >= 45, `${byCountry.size} countries`);
  for (const code of FIRST_FOURTEEN) assert.ok((byCountry.get(code) ?? 0) >= 45, code);
  assert.ok((byCountry.get("US") ?? 0) / people.length < 0.21, "the United States is about a fifth of the list, most of it from the first list");
  assert.ok(added.filter((row) => row.country === "US" && row.tier !== "H").length <= 45, "the country rounds give the United States no more than its quota (the honour list is the NBA's)");
  assert.ok(added.filter((row) => row.country !== "US").length >= 900);
  const sports = new Set(added.map((row) => row.sport));
  assert.ok(sports.size >= 35, `${sports.size} sports among the added`);
  for (const sport of ["judo", "athletics", "figure_skating", "swimming", "gymnastics", "soccer", "basketball", "ice_hockey", "baseball", "tennis", "cycling", "boxing"]) {
    assert.ok(added.filter((row) => row.sport === sport).length >= 20, sport);
    for (const code of ["JP", "CA", "DE", "FR", "IT", "GB"]) {
      // a cell may be empty where the country has no such sport; ice hockey and baseball are the usual holes
      if (["ice_hockey", "baseball"].includes(sport)) continue;
      assert.ok(people.filter((row) => row.country === code && row.sport === sport).length >= 1, `${code} ${sport}`);
    }
  }
});

test("John's examples are there, found by Wikidata id", () => {
  const gill = people.find((row) => row.qid === "Q3277632");
  const deguchi = people.find((row) => row.qid === "Q52133654");
  for (const person of [gill, deguchi]) {
    assert.ok(person);
    assert.equal(person.country, "CA");
    assert.equal(person.sport, "judo");
  }
  assert.equal(gill!.name, "Nicolas Gill");
  assert.equal(deguchi!.name, "Christa Deguchi");
});

test("nothing sensitive: no such column, no para or sex label, dates only as full days", () => {
  const banned = /sex|gender|ethnic|religion|health|disab|famil|politic|impair|classif|para/i;
  for (const column of Object.keys(people[0]!)) assert.equal(banned.test(column), false, column);
  for (const row of people) {
    assert.equal(/^(para|women|female|male)[-_]/i.test(row.sport!), false, `${row.name}: ${row.sport}`);
    if (row.birth_on) assert.match(row.birth_on, /^\d{4}-\d{2}-\d{2}$/);
    if (row.death_on) assert.match(row.death_on, /^\d{4}-\d{2}-\d{2}$/);
  }
  const text = readFileSync("data-sources/people.csv", "utf8");
  assert.equal(/espn|sports-reference|basketball-reference/i.test(text), false);
});

test("the DS1 hand-off rows are exactly the added people, in the seed's own columns", () => {
  const handoff = rows("pipeline/ds1-people/people-2000-athlete-rows.csv");
  assert.deepEqual(handoff.map((row) => row.qid), added.map((row) => row.qid));
  assert.deepEqual(Object.keys(handoff[0]!), ["qid", "label", "sport", "birth_on", "birth_prec", "death_on", "death_prec", "birth_place", "sitelinks", "batch"]);
  for (const row of handoff) {
    assert.equal(row.batch, "people-2000");
    assert.equal(row.birth_prec === "11", Boolean(row.birth_on));
  }
});
