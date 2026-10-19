import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { OFFLINE_BUILD, offline } from "../src/data/offline.ts";
import { factsFor, today } from "../src/facts.ts";
import { isFactRecord } from "../src/load.ts";
import { VERSION } from "../src/version.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

const dataDir = `data/v1/${OFFLINE_BUILD.dataVersion}`;

test("the offline set has three to five facts for every one of the 366 days", () => {
  const perDay = new Map<string, number>();
  for (const r of offline) perDay.set(r.eventDate!.slice(5), (perDay.get(r.eventDate!.slice(5)) ?? 0) + 1);
  assert.equal(perDay.size, 366);
  for (const [day, n] of perDay) assert.ok(n >= 3 && n <= 5, `${day} has ${n}`);
  assert.ok(offline.length >= 1300 && offline.length <= 1830, `${offline.length} offline facts`);
  assert.equal(offline.length, OFFLINE_BUILD.records);
  assert.equal(OFFLINE_BUILD.days, 366);
});

test("each offline fact is a published, unique, public-licence fact with both captions", () => {
  assert.equal(new Set(offline.map((r) => r.recordId)).size, offline.length);
  for (const r of offline) {
    assert.ok(isFactRecord(r), r.recordId);
    assert.ok(r.text && r.textJa, r.recordId);
  }
});

test("every offline fact is in the full dataset unchanged, apart from the emptied team-season list", () => {
  const full = new Map<string, OnThisDayRecord>();
  for (const name of readdirSync(`${dataDir}/facts/store`)) for (const r of (JSON.parse(readFileSync(`${dataDir}/facts/store/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records) full.set(r.recordId, r);
  assert.equal(full.size, OFFLINE_BUILD.factsRecords);
  for (const r of offline) {
    const original = full.get(r.recordId);
    assert.ok(original, `${r.recordId} is not in the full dataset`);
    const same = original.person ? { ...original, person: { ...original.person, teamSeasonIds: [] } } : original;
    assert.deepEqual(r, same);
  }
});

test("most days keep to two facts of a kind", () => {
  let strict = 0;
  for (let i = 0; i < offline.length;) {
    const day = offline[i]!.eventDate!.slice(5);
    const rows = factsFor(offline, { date: day });
    i += rows.length;
    const kinds = new Map<string, number>();
    for (const r of rows) kinds.set(r.category, (kinds.get(r.category) ?? 0) + 1);
    if ([...kinds.values()].every((n) => n <= 2)) strict += 1;
  }
  assert.ok(strict >= 300, `${strict} days keep to two per kind`);
});

test("today() works offline from the offline set for any day, leap day included", () => {
  assert.ok(today(offline, "UTC", "2024-02-29T12:00:00Z").length >= 3);
  assert.ok(today(offline, "America/Vancouver", "2026-10-19T23:00:00Z").length >= 3);
});

test("the offline set, the data version and the package version name one build", () => {
  const latest = JSON.parse(readFileSync("data/v1/latest.json", "utf8")) as Record<string, unknown>;
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  assert.equal(VERSION, pkg.version);
  assert.equal(latest.package, pkg.version);
  assert.equal(latest.build, OFFLINE_BUILD.factsManifestSha256);
  assert.equal(latest.offlineRecords, offline.length);
  assert.equal(latest.dataVersion, OFFLINE_BUILD.dataVersion);
});

function checkBuild(site: string): { status: number | null; stderr: string } {
  const r = spawnSync(process.execPath, ["scripts/check-build.ts", site], { encoding: "utf8" });
  return { status: r.status, stderr: r.stderr };
}

test("check-build passes for matching Pages data and fails for another package, data build or offline set", () => {
  const site = mkdtempSync(join(tmpdir(), "meigen-site-"));
  try {
    mkdirSync(join(site, "data/v1", OFFLINE_BUILD.dataVersion, "facts"), { recursive: true });
    cpSync("data/v1/latest.json", join(site, "data/v1/latest.json"));
    cpSync(`${dataDir}/facts/manifest.json`, join(site, `data/v1/${OFFLINE_BUILD.dataVersion}/facts/manifest.json`));
    cpSync(`${dataDir}/offline.json`, join(site, `data/v1/${OFFLINE_BUILD.dataVersion}/offline.json`));
    assert.equal(checkBuild(site).status, 0);

    const latest = JSON.parse(readFileSync("data/v1/latest.json", "utf8")) as Record<string, unknown>;
    for (const [field, value, expected] of [["package", "0.0.1", /package 0\.0\.1/], ["build", "0".repeat(64), /build 000000000000/], ["offlineRecords", 7, /lists 7 offline facts/]] as const) {
      writeFileSync(join(site, "data/v1/latest.json"), JSON.stringify({ ...latest, [field]: value }));
      const result = checkBuild(site);
      assert.equal(result.status, 1, field);
      assert.match(result.stderr, expected);
    }
    writeFileSync(join(site, "data/v1/latest.json"), JSON.stringify(latest));
    const manifest = readFileSync(`${dataDir}/facts/manifest.json`, "utf8");
    writeFileSync(join(site, `data/v1/${OFFLINE_BUILD.dataVersion}/facts/manifest.json`), manifest.replace('"records": 29961', '"records": 29962'));
    assert.match(checkBuild(site).stderr, /facts manifest hashes to/);
  } finally { rmSync(site, { recursive: true, force: true }); }
});
