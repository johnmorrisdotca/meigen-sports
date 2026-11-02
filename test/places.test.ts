import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import type { OnThisDayRecord } from "../src/index.ts";

const dir = "data/v1/0.1.0/facts/store";
const facts = readdirSync(dir).flatMap((name) => (JSON.parse(readFileSync(`${dir}/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records);

test("a Wikidata birth place never ends in a state that no longer exists: the town is said alone", () => {
  const gone = /, (?:(?:Holy )?Roman|Russian|British|Ottoman|Spanish|Portuguese|Byzantine) Empire$|, (?:Margraviate|Electorate|Principality) of /;
  assert.deepEqual(facts.filter((r) => r.recordId.startsWith("wikidata:") && gone.test(r.birthPlace ?? "")).map((r) => `${r.recordId}: ${r.birthPlace}`), []);
  const london = facts.filter((r) => r.birthPlace === "London");
  assert.ok(london.length > 100);
  assert.ok(facts.some((r) => r.birthPlace === "Hamburg"));
  assert.ok(facts.some((r) => r.birthPlace === "Beijing, People's Republic of China" || /, People's Republic of China$/.test(r.birthPlace ?? "")));
});

test("an early identity whose source city is the club's own name says no city", () => {
  const allegheny = facts.find((r) => r.recordId === "spx:franchise-event:2390");
  assert.equal(allegheny?.text, "Allegheny Club began this American Association identity on May 2, 1882.");
  assert.equal(allegheny?.venueCity, undefined);
  for (const r of facts.filter((x) => x.category === "franchise-event" && x.venueCity)) assert.ok(!(r.clubNames ?? []).includes(r.venueCity!), r.recordId);
});
