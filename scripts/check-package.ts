import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
const root = process.cwd();
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
const core=await import('${pkg.name}');const {quotes}=await import('${pkg.name}/quotes');const {history}=await import('${pkg.name}/history');assert.ok(quotes.length);assert.ok(history.length);assert.equal(core.quoteForDate(quotes,'2026-10-14').kind,'quote');assert.ok(core.historyOnDate(history,'2026-12-18').length);console.log('Installed entry imports, data and pure selections passed.');`);
  console.log(run(process.execPath, [join(scratch, "check.mjs")], scratch).trim());
  console.log(`Packed ${files.length} files; all public entries work from an empty install.`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
