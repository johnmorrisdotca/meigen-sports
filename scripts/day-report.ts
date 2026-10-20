import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { offline } from "../src/data/offline.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

/**
 * node scripts/day-report.ts [factsDir] [--day MM-DD]
 * What a reader gets for a day: how many facts, how many sports and how many kinds. It reads three lists:
 *   served   days/MM-DD.json, the ranked list Pages serves for a day (up to 12)
 *   offline  the best three to five facts per day bundled in the package
 *   all      every fact the dataset holds for that calendar day
 * Prints the chosen day in full (default 10-20), then the minimum, quartiles, mean and maximum over all 366 days.
 */
const args = process.argv.slice(2);
const dayFlag = args.indexOf("--day");
const day = dayFlag >= 0 ? args[dayFlag + 1]! : "10-20";
const dir = resolve(args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--day") ?? "data/v1/0.1.0/facts");

const calendar: string[] = [];
for (let i = 0; i < 366; i += 1) calendar.push(new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(5, 10));

const read = (file: string): OnThisDayRecord[] => existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { records: OnThisDayRecord[] }).records : [];
const served = new Map(calendar.map((d) => [d, read(resolve(dir, "days", `${d}.json`))]));
const all = new Map<string, OnThisDayRecord[]>(calendar.map((d) => [d, []]));
for (const name of readdirSync(resolve(dir, "store")).sort()) {
  for (const r of read(resolve(dir, "store", name))) if (r.eventDate && r.datePrecision === "day") all.get(r.eventDate.slice(5))?.push(r);
}
const bundled = new Map<string, OnThisDayRecord[]>(calendar.map((d) => [d, []]));
for (const r of offline) if (r.eventDate) bundled.get(r.eventDate.slice(5))?.push(r);

const sportOf = (r: OnThisDayRecord): string => r.sport ?? "(none)";
const kindOf = (r: OnThisDayRecord): string => r.category;
const distinct = (rows: readonly OnThisDayRecord[], by: (r: OnThisDayRecord) => string): number => new Set(rows.map(by)).size;

function spread(values: number[]): string {
  const v = values.slice().sort((a, b) => a - b);
  const at = (p: number): number => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))]!;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return `min ${v[0]}, p25 ${at(0.25)}, median ${at(0.5)}, p75 ${at(0.75)}, max ${v.at(-1)}, mean ${mean.toFixed(2)}`;
}

function show(label: string, lists: Map<string, OnThisDayRecord[]>): void {
  const rows = calendar.map((d) => lists.get(d)!);
  const days = (pick: (r: OnThisDayRecord[]) => number): number[] => rows.map(pick);
  console.log(`${label}`);
  console.log(`  facts per day:  ${spread(days((r) => r.length))}`);
  console.log(`  sports per day: ${spread(days((r) => distinct(r, sportOf)))}`);
  console.log(`  kinds per day:  ${spread(days((r) => distinct(r, kindOf)))}`);
  const most = Math.max(...rows.map((r) => {
    const counts = new Map<string, number>();
    for (const x of r) counts.set(sportOf(x), (counts.get(sportOf(x)) ?? 0) + 1);
    return Math.max(0, ...counts.values());
  }));
  console.log(`  most facts of one sport on any day: ${most}`);
  console.log(`  days with 3+ sports: ${rows.filter((r) => distinct(r, sportOf) >= 3).length} of 366; days with 3+ kinds: ${rows.filter((r) => distinct(r, kindOf) >= 3).length} of 366`);
}

console.log(`Day report for ${dir}\n`);
console.log(`== ${day} ==`);
for (const [label, lists] of [["served (days/MM-DD.json)", served], ["offline (bundled)", bundled]] as const) {
  const rows = lists.get(day)!;
  console.log(`${label}: ${rows.length} facts, ${distinct(rows, sportOf)} sports, ${distinct(rows, kindOf)} kinds`);
  for (const r of rows) console.log(`  ${(r.eventDate ?? "").padEnd(10)} ${sportOf(r).padEnd(18)} ${kindOf(r).padEnd(17)} ${r.text ?? r.recordId}`);
}
const every = all.get(day)!;
console.log(`all facts on ${day}: ${every.length}, ${distinct(every, sportOf)} sports, ${distinct(every, kindOf)} kinds\n`);
console.log("== all 366 days ==");
show("served (days/MM-DD.json)", served);
show("offline (bundled)", bundled);
show("all facts held", all);
