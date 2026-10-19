import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { OFFLINE_BUILD, offline } from "../src/data/offline.ts";
import { VERSION } from "../src/version.ts";
import { manifestDigest } from "./offline.ts";

/**
 * One build ships both places. This fails when the bundled offline set and the data GitHub Pages serves
 * come from different builds: another package version, another data folder, or other facts.
 *
 *   node scripts/check-build.ts [site]                    the built site folder (run `pnpm site` first)
 *   node scripts/check-build.ts [site] --live <pagesUrl>  also the Pages site that is really serving, retried for up to --wait seconds
 */
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const live = flag("--live");
const wait = Number(flag("--wait") ?? 120);
const positional = args.filter((arg, i) => !arg.startsWith("--") && !(i > 0 && args[i - 1]?.startsWith("--")));
const site = resolve(positional[0] ?? "site");

interface Latest { dataVersion: string; package: string; build: string; offlineRecords: number; factRecords: number; offline: string; factsManifest: string }
const problems: string[] = [];
const expect = (ok: boolean, message: string): void => { if (!ok) problems.push(message); };

const packageVersion = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
expect(VERSION === packageVersion, `src/version.ts says ${VERSION} but package.json says ${packageVersion}`);

function readLocal(): { latest: Latest; factsManifest: Uint8Array; offlineFile: { build: typeof OFFLINE_BUILD; records: { recordId: string }[] } } {
  const path = (name: string): string => resolve(site, name);
  if (!existsSync(path("data/v1/latest.json"))) throw new Error(`No built site at ${site}: run pnpm site first`);
  const latest = JSON.parse(readFileSync(path("data/v1/latest.json"), "utf8")) as Latest;
  return {
    latest,
    factsManifest: readFileSync(path(`data/v1/${latest.factsManifest}`)),
    offlineFile: JSON.parse(readFileSync(path(`data/v1/${latest.offline}`), "utf8")),
  };
}

function compareToBundle(label: string, latest: Latest, factsManifestSha256: string | null): void {
  expect(latest.package === packageVersion, `${label}: Pages says package ${latest.package}, the package is ${packageVersion}`);
  expect(latest.dataVersion === OFFLINE_BUILD.dataVersion, `${label}: Pages data version ${latest.dataVersion}, bundled ${OFFLINE_BUILD.dataVersion}`);
  expect(latest.build === OFFLINE_BUILD.factsManifestSha256, `${label}: Pages build ${latest.build.slice(0, 12)}, bundled ${OFFLINE_BUILD.factsManifestSha256.slice(0, 12)}`);
  expect(latest.offlineRecords === offline.length, `${label}: Pages lists ${latest.offlineRecords} offline facts, the package has ${offline.length}`);
  expect(latest.factRecords === OFFLINE_BUILD.factsRecords, `${label}: Pages has ${latest.factRecords} facts, the offline set was chosen from ${OFFLINE_BUILD.factsRecords}`);
  if (factsManifestSha256 !== null) expect(factsManifestSha256 === OFFLINE_BUILD.factsManifestSha256, `${label}: the facts manifest hashes to ${factsManifestSha256.slice(0, 12)}, bundled ${OFFLINE_BUILD.factsManifestSha256.slice(0, 12)}`);
}

const local = readLocal();
compareToBundle(`built site (${site})`, local.latest, manifestDigest(local.factsManifest));
expect(local.offlineFile.records.length === offline.length && local.offlineFile.records.every((r, i) => r.recordId === offline[i]!.recordId), "built site offline.json is not the bundled offline set");
expect(JSON.stringify(local.offlineFile.build) === JSON.stringify(OFFLINE_BUILD), "built site offline.json names another build than the package");
expect(offline.length === OFFLINE_BUILD.records, `the package lists ${OFFLINE_BUILD.records} offline facts but holds ${offline.length}`);

if (live) {
  const base = live.replace(/\/?$/, "/");
  const deadline = Date.now() + wait * 1000;
  let last = "";
  for (;;) {
    last = "";
    try {
      const response = await fetch(`${base}data/v1/latest.json`, { headers: { "cache-control": "no-cache" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const latest = await response.json() as Latest;
      const before = problems.length;
      compareToBundle(`live ${base}`, latest, null);
      if (problems.length === before) break;
      last = problems.splice(before).join("; ");
    } catch (error) { last = `live ${base}: ${(error as Error).message}`; }
    if (Date.now() > deadline) { problems.push(last); break; }
    await new Promise((done) => setTimeout(done, 10_000));
  }
}

if (problems.length) {
  console.error(`The bundled data and the Pages data are not one build:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`One build: package ${packageVersion}, data ${OFFLINE_BUILD.dataVersion}, facts ${OFFLINE_BUILD.factsManifestSha256.slice(0, 12)}, ${offline.length} offline of ${OFFLINE_BUILD.factsRecords} facts${live ? ", and the live Pages site serves it" : ""}.`);
