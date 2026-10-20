import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import type { OnThisDayRecord } from "../src/schema.ts";
import { captionFromFact } from "../src/sentences.ts";
import { isCareerHighlight } from "../src/templates/clubs.ts";
import { positionName } from "../src/templates/positions.ts";

/** Every sentence is built from fields the record holds and words committed in the templates: nothing is invented. */
const dir = "data/v1/0.1.0/facts/store";
const records: OnThisDayRecord[] = [];
for (const name of readdirSync(dir)) records.push(...(JSON.parse(readFileSync(`${dir}/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records);

const tokens = (text: string): string[] => text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const literals = (file: string): string => [...readFileSync(file, "utf8").matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? "").join(" ");
const committed = new Set(["src/templates/catalog.ts", "src/templates/phrases.ts", "src/templates/positions.ts", "src/templates/titles.ts", "src/templates/render.ts"].flatMap((f) => tokens(literals(f))));

/** Words and numbers a record's own fields can supply, with its text and links left out. */
function held(record: OnThisDayRecord): Set<string> {
  const out = new Set<string>();
  const walk = (value: unknown, key: string): void => {
    if (key === "text" || key === "textJa" || key === "url" || key === "recordId" || key === "attribution") return;
    if (typeof value === "string") for (const t of tokens(value)) out.add(t);
    else if (typeof value === "number") { out.add(String(value)); out.add(`${value}${["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][value % 10]}`); }
    else if (Array.isArray(value)) for (const v of value) walk(v, key);
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, k);
  };
  walk(record, "");
  return out;
}

test("a sentence says only what its record holds: every word is the record's or a committed template word", () => {
  const bad: string[] = [];
  for (const r of records) {
    const have = held(r);
    for (const t of tokens(r.text ?? "")) if (!have.has(t) && !committed.has(t)) bad.push(`${r.recordId}: "${t}" in ${r.text}`);
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test("no sentence holds a number its record does not", () => {
  const bad: string[] = [];
  for (const r of records) {
    const have = held(r);
    for (const t of tokens(r.text ?? "")) if (/^\d+$/.test(t) && !have.has(t)) bad.push(`${r.recordId}: ${t}`);
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test("a fuller record gives a fuller sentence: club, position and a career honour all appear when the record holds them", () => {
  const rich = records.filter((r) => r.category === "player-birthday" && r.clubNames?.length && r.position && r.highlight && isCareerHighlight(r.highlight));
  assert.ok(rich.length > 500, `${rich.length} rich births`);
  for (const r of rich.slice(0, 400)) {
    const text = r.text ?? "";
    assert.ok(text.includes(positionName(r.sport, r.position, "en")), `${r.recordId} drops its position: ${text}`);
    assert.ok(text.includes(r.highlight!.replace(/^Winner of the /, "")) || /winner|champion/i.test(text), `${r.recordId} drops its honour: ${text}`);
  }
  const thin = records.filter((r) => r.category === "player-birthday" && !r.clubNames?.length && !r.position && !r.highlight);
  assert.equal(thin.length, 0, "a birthday with nothing but a name is dropped, not published");
});

test("a missing field is left out, never filled in", () => {
  const noClub = records.find((r) => r.category === "player-birthday" && !r.clubNames?.length && !r.position && r.highlight);
  assert.ok(noClub);
  assert.ok(!(noClub.text ?? "").includes(" the "), noClub.text);
  assert.equal(captionFromFact({ ...noClub, clubNames: [], position: undefined, highlight: undefined }, "en"), null);
});
