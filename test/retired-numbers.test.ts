import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { captionFromFact, derivedTags, GEAR_BY_SPORT, visualOf } from "../src/index.ts";
import type { OnThisDayRecord } from "../src/index.ts";

const dir = "data/v1/0.1.0/facts/store";
const facts = readdirSync(dir).flatMap((name) => (JSON.parse(readFileSync(`${dir}/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records);
const retired = facts.filter((r) => r.category === "retired-number");

test("retired numbers are facts on the day the source gives, from English Wikipedia, with a club or the league", () => {
  assert.ok(retired.length >= 200, `${retired.length} retired numbers`);
  for (const r of retired) {
    assert.equal(r.datePrecision, "day", r.recordId);
    assert.match(r.eventDate ?? "", /^\d{4}-\d{2}-\d{2}$/, r.recordId);
    assert.ok(!r.eventDate!.endsWith("-01-01"), `${r.recordId}: a year written as a day`);
    assert.ok(Number.isInteger(r.jerseyNumber) && r.jerseyNumber! >= 0, r.recordId);
    assert.ok(r.leagueWide ? !r.clubName : Boolean(r.clubName), `${r.recordId}: a club, or the league and no club`);
    assert.equal(`${r.source.sourceId} ${r.source.licence}`, "wikipedia CC BY-SA 4.0", r.recordId);
    assert.ok(r.tags.includes("ceremony-recognition"), r.recordId);
    const tags = derivedTags(r);
    assert.ok(tags.includes(`number:${r.jerseyNumber}`) && tags.includes("honour:retired-number"), r.recordId);
    assert.ok(r.text?.includes(`No. ${r.jerseyNumber}`) && r.textJa?.includes(`背番号${r.jerseyNumber}`), r.recordId);
    assert.equal(r.text, captionFromFact(r, "en"), r.recordId);
  }
  assert.equal(new Set(retired.map((r) => r.recordId)).size, retired.length);
});

test("famous retirements: Gretzky's 99 by the NHL, Robinson's 42 by MLB and the Dodgers, Lemieux's 66 by the Penguins", () => {
  const find = (qid: string, number: number, league: boolean) => retired.find((r) => r.person?.qid === qid && r.jerseyNumber === number && Boolean(r.leagueWide) === league);
  assert.equal(find("Q209518", 99, true)?.eventDate, "2000-02-06");
  assert.equal(find("Q209518", 99, true)?.text, "On February 6, 2000, the NHL retired No. 99 across the league for Wayne Gretzky.");
  assert.equal(find("Q221048", 42, true)?.eventDate, "1997-04-15");
  assert.equal(find("Q221048", 42, false)?.eventDate, "1972-06-04");
  assert.equal(retired.find((r) => r.person?.qid === "Q209518" && !r.leagueWide && r.eventDate === "1999-10-01")?.clubName, "Edmonton Oilers");
});

test("a person's jersey number is only one the data settles: Gretzky 99, Jordan 23, and never a guess between two", () => {
  const birthday = (qid: string) => facts.find((r) => r.category === "player-birthday" && r.person?.qid === qid);
  assert.equal(birthday("Q209518")?.jerseyNumber, 99);
  assert.equal(birthday("Q209518")?.jerseyRetired, true);
  assert.equal(birthday("Q41421")?.jerseyNumber, 23);
  assert.ok(derivedTags(birthday("Q209518")!).includes("number:99"));
  const numbered = facts.filter((r) => r.jerseyNumber != null && r.category !== "retired-number");
  assert.ok(numbered.length >= 5000, `${numbered.length} people with a number`);
  for (const r of numbered) {
    assert.ok(r.category === "player-birthday" || r.category === "player-death", r.recordId);
    assert.ok(["wikipedia", "wikidata", "wikidata_rosters", "nflverse"].includes(r.jerseySource ?? ""), `${r.recordId}: ${r.jerseySource}`);
    if (r.jerseyRetired) assert.equal(r.jerseySource, "wikipedia", r.recordId);
  }
});

test("visualOf names a banner and a piece of gear from the fields a fact holds, and nothing else", () => {
  const gretzky = retired.find((r) => r.person?.qid === "Q209518" && r.leagueWide)!;
  assert.deepEqual(visualOf(gretzky), { banner: "retired", number: 99, gear: "gear/gear.hockeystick" });
  const club = retired.find((r) => r.sport === "baseball" && !r.leagueWide)!;
  assert.deepEqual(visualOf(club), { banner: "retired", number: club.jerseyNumber, gear: "gear/gear.baseballglove" });
  const final = facts.find((r) => r.category === "championship-final" && r.sport === "ice-hockey")!;
  assert.deepEqual(visualOf(final), { banner: "title", year: Number(final.eventDate!.slice(0, 4)), gear: "gear/gear.hockeystick" });
  assert.deepEqual(visualOf({ ...final, category: "game-on-day", sport: "curling" }), {});
  for (const gear of Object.values(GEAR_BY_SPORT)) assert.match(gear, /^(gear\/gear|ball\/ball)\.[a-z]+$/);
  assert.equal(JSON.stringify(visualOf(gretzky)).includes("color"), false);
});
