import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { captionFromFact } from "../src/sentences.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

const root = "data/v1/0.1.0/facts";
const store: OnThisDayRecord[] = [];
for (const name of readdirSync(`${root}/store`)) store.push(...(JSON.parse(readFileSync(`${root}/store/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records);
const people = store.filter((r) => r.category === "player-birthday" || r.category === "player-death");

test("an award on a fact is one the person won himself: a count of his own awards stands behind it", () => {
  const withAward = people.filter((r) => r.personAward);
  assert.ok(withAward.length > 1000);
  assert.deepEqual(withAward.filter((r) => !(r.awardCount && r.awardCount >= 1)).map((r) => r.recordId), []);
  // No two award winners share one award by way of one team-season: a Cy Young Award is a pitcher's.
  const pitchers = new Set(["P", "SP", "RP", "CL", "LHP", "RHP"]);
  assert.deepEqual(people.filter((r) => /Cy Young/.test(r.personAward ?? "") && r.position && !pitchers.has(r.position)).map((r) => `${r.person?.name} ${r.position}`), []);
});

test("a Hall of Fame year is said as the hall of the person's own sport, with his titles when he has them", () => {
  const halls = people.filter((r) => r.hallOfFameYear && r.sport === "ice-hockey");
  assert.ok(halls.length >= 20, `${halls.length} Hockey Hall of Famers`);
  for (const r of halls) assert.match(r.highlight ?? "", /Hockey Hall of Famer/, r.recordId);
  const sample = halls.find((r) => r.category === "player-birthday")!;
  assert.match(sample.text ?? "", /Hockey Hall of Famer/);
  const base = { recordId: "x:1", category: "player-birthday", tags: [], basis: "source", eventDate: "1931-10-20", datePrecision: "day", sport: "baseball", competition: null, league: "mlb", livingStatus: "unknown",
    source: { sourceId: "wikidata", licence: "CC0 1.0", attribution: "", url: null }, person: { personId: 1, qid: "Q1", name: "A Player", leagueCodes: ["mlb"], franchiseIds: [1], teamSeasonIds: [] }, position: "CF", clubNames: ["New York Yankees (1951–1968)"] } as OnThisDayRecord;
  assert.equal(captionFromFact({ ...base, highlight: "Baseball Hall of Famer with seven World Series titles" }, "en"), "A Player, the New York Yankees center fielder and Baseball Hall of Famer with seven World Series titles, was born on October 20, 1931.");
});

test("a player with statistics but no roster row has his club, and a Hall of Fame year is said in the hall of his own sport", () => {
  // A baseball or hockey player the Wikidata dump adds (recordId "wikidata:") has no DS1 club season; the check is for the league players DS1 holds.
  const birthdays = people.filter((r) => r.category === "player-birthday" && (r.sport === "baseball" || r.sport === "ice-hockey") && !r.priorityAthlete && !r.recordId.startsWith("wikidata:"));
  const noClub = birthdays.filter((r) => !r.clubNames?.length);
  assert.ok(noClub.length / birthdays.length < 0.03, `${noClub.length} of ${birthdays.length} baseball and hockey birthdays have no club`);
  const gonzalez = people.find((r) => r.person?.qid === "Q3107002" && r.category === "player-birthday")!;
  assert.match(gonzalez.text ?? "", /Texas Rangers designated hitter/);
  const baseball = people.filter((r) => r.hallOfFameYear && r.sport === "baseball");
  assert.ok(baseball.length >= 20, `${baseball.length} baseball Hall of Famers`);
  for (const r of baseball) assert.match(r.highlight ?? "", /Baseball Hall of Famer/, r.recordId);
  const jeter = people.find((r) => r.person?.qid === "Q353511" && r.category === "player-birthday")!;
  assert.ok((jeter.awardCount ?? 0) >= 10, `Jeter has ${jeter.awardCount} awards`);
});

test("the facts of other sports are about their own sport, and no para sport is published", () => {
  const sports = new Set(people.map((r) => r.sport));
  for (const sport of ["tennis", "boxing", "athletics", "golf", "cricket", "formula-one", "professional-wrestling"]) assert.ok(sports.has(sport), `no ${sport} people`);
  for (const sport of sports) assert.doesNotMatch(sport ?? "", /^(para|deaflympic|wheelchair|goalball|boccia|sitting)/, `${sport} is a para sport`);
});

test("a priority athlete's birthday says what he was, with no gender, para or year words", () => {
  const fromList = people.filter((r) => r.recordId.startsWith("meigen:"));
  assert.ok(fromList.length >= 600, `${fromList.length} priority people`);
  for (const r of fromList) {
    assert.ok(r.priorityAthlete && r.text && r.highlight, r.recordId);
    assert.doesNotMatch(r.highlight!, /female|\bmale\b|woman|women|girl|para|wheelchair|deaf|blind|\d/i, r.recordId);
  }
});
