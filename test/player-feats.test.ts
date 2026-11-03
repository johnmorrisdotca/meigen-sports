import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { captionFromFact } from "../src/index.ts";
import type { OnThisDayRecord } from "../src/index.ts";

const dir = "data/v1/0.1.0/facts/store";
const facts = readdirSync(dir).flatMap((name) => (JSON.parse(readFileSync(`${dir}/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records);
const feats = facts.filter((r) => r.category === "player-feat");
const of = (kind: string) => feats.filter((r) => r.featKind === kind);

test("130 player feats from three complete English Wikipedia lists, each worded in both languages and credited", () => {
  assert.equal(of("goals-in-game").length, 64);
  assert.equal(of("career-goals").length, 50);
  assert.equal(of("points-in-game").length, 16);
  for (const r of feats) {
    assert.match(r.eventDate ?? "", /^\d{4}-\d{2}-\d{2}$/, r.recordId);
    assert.equal(`${r.source.sourceId} ${r.source.licence}`, "wikipedia CC BY-SA 4.0", r.recordId);
    assert.match(r.source.url ?? "", /^https:\/\/en\.wikipedia\.org\/wiki\/List_of_/, r.recordId);
    assert.ok(r.playerName && r.clubName && r.featAmount && r.featNth, r.recordId);
    assert.equal(r.text, captionFromFact(r, "en"), r.recordId);
    assert.ok(r.textJa && r.textJa.includes(r.playerName!), r.recordId);
    assert.equal(r.person, undefined, `${r.recordId}: a name is a label, never an identity`);
  }
  assert.equal(new Set(feats.map((r) => r.recordId)).size, feats.length);
});

test("the lists are complete, so a count is a count: Gretzky's four five-goal games, Chamberlain's six of 70 points, one 500th goal for each player", () => {
  const count = (kind: string, name: string) => of(kind).filter((r) => r.playerName === name).length;
  assert.equal(count("goals-in-game", "Wayne Gretzky"), 4);
  assert.equal(count("goals-in-game", "Joe Malone"), 5);
  assert.equal(count("points-in-game", "Wilt Chamberlain"), 6);
  assert.equal(new Set(of("career-goals").map((r) => r.playerName)).size, 50);
  assert.equal(new Set(of("points-in-game").map((r) => r.playerName)).size, 11);
  assert.equal(of("goals-in-game").filter((r) => r.phase === "playoffs").length, 5);
  for (const kind of ["goals-in-game", "points-in-game"]) {
    const byPlayer = new Map<string, number[]>();
    for (const r of of(kind).sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""))) byPlayer.set(r.playerName!, [...(byPlayer.get(r.playerName!) ?? []), r.featNth!]);
    for (const [name, nth] of byPlayer) assert.deepEqual(nth, nth.map((_, i) => i + 1), `${kind} ${name}`);
  }
});

test("worded: five goals, a 500th goal into an empty net, 100 points, in English and in Japanese", () => {
  const find = (kind: string, name: string, day: string) => of(kind).find((r) => r.playerName === name && r.eventDate === day)!;
  assert.equal(find("goals-in-game", "Joe Malone", "1917-12-19").text, "On December 19, 1917, Joe Malone of the Montreal Canadiens scored five goals in an NHL game.");
  assert.equal(find("goals-in-game", "Darryl Sittler", "1976-04-22").text, "On April 22, 1976, Darryl Sittler of the Toronto Maple Leafs scored five goals in an NHL playoff game, his 2nd game of five or more goals.");
  const gretzky = find("career-goals", "Wayne Gretzky", "1986-11-22");
  assert.equal(gretzky.text, "On November 22, 1986, Wayne Gretzky of the Edmonton Oilers scored his 500th NHL goal into an empty net against the Canucks, in his 575th game.");
  assert.equal(gretzky.textJa, "1986年11月22日、Edmonton OilersのWayne GretzkyがCanucks戦で無人のゴールにNHL通算500ゴール目を決めた（通算575試合目）。");
  const wilt = find("points-in-game", "Wilt Chamberlain", "1962-03-02");
  assert.equal(wilt.text, "On March 2, 1962, Wilt Chamberlain of the Philadelphia Warriors scored 100 points against the New York Knicks, winning 169–147, his 3rd game of seventy or more points.");
  assert.equal(find("points-in-game", "Wilt Chamberlain", "1961-12-08").text, "On December 8, 1961, Wilt Chamberlain of the Philadelphia Warriors scored 78 points against the Los Angeles Lakers, losing 147–151.");
});
