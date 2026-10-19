import { manifestDigest } from "./offline.ts";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
const root = process.cwd();
const latest = JSON.parse(readFileSync("data/v1/latest.json", "utf8")) as { dataVersion: string };
const factsManifest = readFileSync(`data/v1/${latest.dataVersion}/facts/manifest.json`);
const factsSha = manifestDigest(factsManifest);
const factsRecords = (JSON.parse(factsManifest.toString("utf8")) as { records: number }).records;
const scratch = mkdtempSync(join(tmpdir(), "meigen-package-"));
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { name: string; exports: Record<string, string | { import: string }> };
function run(command: string, args: string[], cwd: string) {
  const r = spawnSync(command, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  if (r.status !== 0) throw new Error(`${command} failed: ${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
try {
  const pack = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", scratch], root)) as { filename: string; files: { path: string }[] }[];
  const files = pack[0].files.map((f) => f.path);
  const allowedCatalogueFiles = new Set(["data-sources/sources.json", "data-sources/README.md"]);
  if (files.some((f) => /^(demo|docs|pipeline|db)\//.test(f) || (/^data-sources\//.test(f) && !allowedCatalogueFiles.has(f)))) throw new Error("Private/tools/demo source entered the npm package");
  if ([...allowedCatalogueFiles].some((file) => !files.includes(file))) throw new Error("The public source lifecycle catalogue is missing from the npm package");
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(scratch, pack[0].filename)], scratch);
  const imports = Object.keys(pkg.exports).filter((key) => key !== "./package.json").map((key) => key === "." ? pkg.name : `${pkg.name}/${key.slice(2)}`);
  writeFileSync(join(scratch, "check.mjs"), `import assert from 'node:assert/strict';\nimport {createRequire} from 'node:module';\nconst require=createRequire(import.meta.url);\nfor(const name of ${JSON.stringify(imports)}){const esm=await import(name);const cjs=require(name);assert.ok(Object.keys(esm).length);assert.ok(Object.keys(cjs).length);}
const core=await import('${pkg.name}');const {quotes}=await import('${pkg.name}/quotes');const {history}=await import('${pkg.name}/history');assert.ok(quotes.length);assert.ok(history.length);assert.equal(core.quoteForDate(quotes,'2026-10-14').kind,'quote');assert.ok(core.historyOnDate(history,'2026-12-18').length);const {offline,OFFLINE_BUILD}=await import('${pkg.name}/offline');assert.ok(offline.length>=1000);assert.equal(offline.length,OFFLINE_BUILD.records);assert.equal(OFFLINE_BUILD.factsManifestSha256,${JSON.stringify(factsSha)});assert.equal(OFFLINE_BUILD.factsRecords,${JSON.stringify(factsRecords)});const days=new Set(offline.map((r)=>r.eventDate.slice(5)));assert.equal(days.size,366);for(const day of days){assert.ok(core.factsFor(offline,{date:day}).length>=3,'fewer than three offline facts on '+day);}const installed=JSON.parse((await import('node:fs')).readFileSync(new URL('node_modules/${pkg.name}/data/v1/latest.json',import.meta.url),'utf8'));assert.equal(installed.build,OFFLINE_BUILD.factsManifestSha256);assert.equal(installed.package,JSON.parse((await import('node:fs')).readFileSync(new URL('node_modules/${pkg.name}/package.json',import.meta.url),'utf8')).version);assert.equal(core.today(offline,'UTC','2026-10-19T12:00:00Z').length>=3,true);console.log('Installed entry imports, data and pure selections passed.');`);
  console.log(run(process.execPath, [join(scratch, "check.mjs")], scratch).trim());
  console.log(`Packed ${files.length} files; all public entries work from an empty install.`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
