// Fails when a hand-written source file has more than 500 lines.
//
//   node scripts/check-max-lines.mjs
//
// Counts every line of each tracked file (blank lines and comments included), so a long file is split by what it does
// rather than squeezed. Not counted: generated and vendored files, data tables (`*.data.*`), and the lock file.
// `KNOWN_OVER` lists files that are still over the limit and not yet split: each may not grow, and the script says when
// one is under the limit again so that it can be taken off the list.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAX_LINES = 500;
const SOURCE = /\.(ts|tsx|js|mjs|cjs|css|html|py|sh)$/;
const NOT_COUNTED = [
  /(^|\/)(dist|site|node_modules|vendor|coverage|playwright-report|test-results|\.next)\//,
  /\.d\.[cm]?ts$/,
  /\.min\./,
  /\.data\.[cm]?[jt]s$/,
  /(^|\/)__snapshots__\//,
  // Written by scripts/data.ts and scripts/offline.ts: the generators are the place to fix their size.
  /^src\/data\/(history|offline|quotes)\.ts$/,
];
// File path -> its line count when it was listed. Why each is listed is in the board ticket named beside it.
const KNOWN_OVER = {
  // Family files, copied from johnmorrisdotca/.github; split there and synced (MODULES-276, MODULES-277, MODULES-325).
  "scripts/docs-site.mjs": 1356,
  "src/family-backgrounds.ts": 554,
  // Changed by another session today (MODULES-318 to MODULES-321).
  "src/facts.ts": 613,
  "demo/demo.ts": 515,
  "src/load.ts": 771,
  "pipeline/convert_extract.py": 2293,
  // Python files and one big table, not split yet (MODULES-322 to MODULES-324).
  "pipeline/wikidata_dump_people.py": 691,
  "pipeline/fetch_priority_pages.py": 554,
  "src/templates/catalog.ts": 1032,
};

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((file) => file && SOURCE.test(file) && !NOT_COUNTED.some((pattern) => pattern.test(file)));

const problems = [];
const listedAndFixed = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  const allowed = KNOWN_OVER[file];
  if (allowed === undefined && lines > MAX_LINES) problems.push(`${file}: ${lines} lines (limit ${MAX_LINES})`);
  else if (allowed !== undefined && lines > allowed) problems.push(`${file}: ${lines} lines, listed at ${allowed}`);
  else if (allowed !== undefined && lines <= MAX_LINES) listedAndFixed.push(file);
}
for (const file of Object.keys(KNOWN_OVER)) if (!files.includes(file)) listedAndFixed.push(file);

if (listedAndFixed.length) {
  console.error(`Take off KNOWN_OVER in scripts/check-max-lines.mjs (no longer over the limit): ${listedAndFixed.join(", ")}`);
  process.exit(1);
}
if (problems.length) {
  console.error(`Files over ${MAX_LINES} lines. Split each by what it does:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`No source file is over ${MAX_LINES} lines (${files.length} checked).`);
