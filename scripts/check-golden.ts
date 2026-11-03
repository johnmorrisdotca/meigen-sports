import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { OFFLINE_BUILD, offline } from "../src/data/offline.ts";
import { Facts, describe, failures, loadEverLocked, loadGolden, loadLocked } from "./golden.ts";

/**
 * node scripts/check-golden.ts [factsDir] [--lock]
 * Runs the golden facts against the offline set and the full dataset (default: data/v1/<version>/facts, or the built site's copy
 * of it, which is what GitHub Pages serves). Exits 1, naming each miss, on any failure.
 */
const dir = resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) ?? `data/v1/${OFFLINE_BUILD.dataVersion}/facts`);
const golden = loadGolden();
if (process.argv.includes("--lock")) {
  // Record where each golden fact is served today, as a floor: a later build may serve more but never fewer. A path is only ever added.
  const found = failures(golden, new Facts(dir), new Set(offline.map((r) => r.recordId)), {}, offline).report;
  const order = ["offline", "day", "team", "player"];
  const merge = (before: Record<string, string[]>): Record<string, string[]> => Object.fromEntries(Object.entries(found.paths).sort().map(([id, paths]) => {
    const union = new Set([...(before[id] ?? []), ...paths.filter((p) => p !== "full")]);
    return [id, order.filter((p) => union.has(p))];
  }));
  const ever = merge(loadEverLocked() as Record<string, string[]>);
  const locked = merge(loadLocked() as Record<string, string[]>);
  writeFileSync("test/golden/locked-paths.json", `${JSON.stringify(locked, null, 1)}\n`);
  writeFileSync("test/golden/ever-locked.json", `${JSON.stringify(ever, null, 1)}\n`);
  console.log(`Locked the paths of ${Object.keys(locked).length} golden facts (paths are added, never removed).`);
}
const { report, problems } = failures(golden, new Facts(dir), new Set(offline.map((r) => r.recordId)), loadLocked(), offline, loadEverLocked());
console.log(`${describe(golden, report)}\n  against ${dir}`);
if (problems.length) {
  console.error(`\n${problems.length} golden fact problem(s):\n- ${problems.slice(0, 80).join("\n- ")}${problems.length > 80 ? `\n- ... and ${problems.length - 80} more` : ""}`);
  process.exit(1);
}
console.log("The golden facts hold.");
