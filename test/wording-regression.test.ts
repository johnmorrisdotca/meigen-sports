import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import type { OnThisDayRecord } from "../src/schema.ts";
import { render } from "../src/templates/index.ts";
import { publicClubName } from "../src/templates/clubs.ts";

/** Wording John met on the demo: 'Wayne Gretzky, the Winnipeg Jets, was born', 'Charlie Gardiner, Winner of the Vezina Trophy, died at the age of 29'. */
const facts: OnThisDayRecord[] = [];
for (const name of readdirSync("data/v1/0.1.0/facts/store")) facts.push(...(JSON.parse(readFileSync(`data/v1/0.1.0/facts/store/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records);
const golden = JSON.parse(readFileSync("test/golden/famous-clubs.json", "utf8")) as { clubs: Record<string, [string, string]> };

test("38 famous people are worded with the club each is best known for, by Wikidata id", () => {
  const born = new Map(facts.filter((r) => r.category === "player-birthday" && r.person?.qid).map((r) => [r.person!.qid!, r]));
  for (const [qid, [name, club]] of Object.entries(golden.clubs)) {
    const r = born.get(qid);
    assert.ok(r, `${name} (${qid}) has no birthday fact`);
    assert.equal(r.person!.name, name, qid);
    assert.ok(r.text?.includes(`the ${club} `), `${name}: ${r.text}`);
    assert.ok(!/Winnipeg/.test(r.text ?? "") || club.includes("Winnipeg"), `${name}: ${r.text}`);
  }
});

test("no sentence names a club as if it were a trade, or a trophy as a capitalised 'Winner of the'", () => {
  for (const r of facts) {
    const text = r.text ?? "";
    assert.doesNotMatch(text, /, Winner of the |, winner of the | Winner of the /, r.recordId);
    for (const club of r.clubNames ?? []) {
      const bare = club.replace(/\s*\(\d{4}(?:[–-]\d{4})?\)$/, "");
      assert.ok(!text.includes(`, the ${bare},`) && !text.includes(`, the ${bare} and `), `${r.recordId}: the club is not what he is: ${text}`);
    }
  }
});

test("a club and no position is 'of the club'", () => {
  const r = facts.find((f) => f.person?.name === "Gregg Popovich" && f.category === "player-birthday");
  assert.ok(r?.text?.startsWith("Gregg Popovich, of the San Antonio Spurs, was born on"), r?.text);
  const titled = facts.find((f) => f.category === "player-birthday" && (f.clubNames?.length ?? 0) > 0 && !f.position && (f.championships ?? 0) > 0 && f.championshipName === "Grey Cup");
  assert.match(titled?.text ?? "", /^[^,]+, of the [^,]+, (?:two-time |three-time |four-time )?Grey Cup winner, was born on /, titled?.text);
});

test("the best-known club is where he spent most seasons, a stint inside a longer span not counted twice", () => {
  assert.equal(publicClubName(["Edmonton Oilers (1979–1990)", "New York Rangers (1991–2003)", "Vancouver Canucks (1997–1999)"]), "Edmonton Oilers");
  assert.equal(publicClubName(["Edmonton Oilers (1978–1987)", "Los Angeles Kings (1988–1995)", "New York Rangers (1996–1998)", "St. Louis Blues (1995–1996)"]), "Edmonton Oilers");
  assert.equal(publicClubName(["Houston Astros (2004–2017)", "Kansas City Royals (1995–2004)", "New York Mets (2005–2011)", "New York Yankees (2014–2016)", "San Francisco Giants (2011)", "St. Louis Cardinals (2012–2013)", "Texas Rangers (2016)"]), "Kansas City Royals");
  assert.equal(publicClubName(["Alberta Oilers (1972–1978)", "Edmonton Oilers (1978–1979)"]), "Edmonton Oilers", "a province is never a club's city");
  assert.equal(publicClubName(["Boston Celtics (1979–1991)"]), "Boston Celtics");
  assert.equal(publicClubName([], "Fallback (1999)"), "Fallback");
});

test("an award is said as 'Trophy winner', never 'Winner of the Trophy'", () => {
  const base = { recordId: "t:1", category: "player-death", tags: [], basis: "source", eventDate: "1934-06-13", datePrecision: "day", sport: "ice-hockey", league: "nhl", competition: "nhl", source: { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata", url: null } } satisfies Partial<OnThisDayRecord>;
  const gardiner: OnThisDayRecord = { ...base, person: { personId: 12, qid: "Q860294", name: "Charlie Gardiner", leagueCodes: ["nhl"], franchiseIds: [1409], teamSeasonIds: [] }, position: "G", clubNames: ["Chicago Blackhawks (1927–1933)"], personAward: "Vezina Trophy", awardCount: 2, highlight: "Vezina Trophy winner", bornYear: 1904, ageYears: 29, birthDate: "1904-12-31", livingStatus: "deceased" } as OnThisDayRecord;
  assert.equal(render(gardiner)?.text, "Charlie Gardiner, the Chicago Blackhawks goaltender and Vezina Trophy winner, died on June 13, 1934, aged 29.");
  const noClub: OnThisDayRecord = { ...gardiner, clubNames: [], position: undefined };
  assert.equal(render(noClub)?.text, "Charlie Gardiner, Vezina Trophy winner, died on June 13, 1934, aged 29.");
  const ovechkin: OnThisDayRecord = { ...base, category: "player-birthday", eventDate: "1985-09-17", person: { personId: 545, qid: "Q311374", name: "Alexander Ovechkin", leagueCodes: ["nhl"], franchiseIds: [1430], teamSeasonIds: [] }, highlight: "Ted Lindsay Award winner", livingStatus: "unknown" } as OnThisDayRecord;
  assert.equal(render(ovechkin)?.text, "Alexander Ovechkin, Ted Lindsay Award winner, was born on September 17, 1985.");
});
