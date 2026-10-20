import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bestOfDay } from "../src/facts.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

/**
 * The bundled offline set: the best few facts for every calendar day, chosen from the same
 * on-this-day facts that GitHub Pages serves, so "today" works with no network.
 * Everything here is a pure function of `data/v1/<version>/facts/`; the build id below names that exact input.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface OfflineBuild {
  /** The data folder the facts live in (`data/v1/<dataVersion>/facts`). */
  readonly dataVersion: string;
  /** SHA-256 of `facts/manifest.json`, which lists the SHA-256 of every shard: it names the whole fact dataset. */
  readonly factsManifestSha256: string;
  /** Facts in the full dataset the offline set was chosen from. */
  readonly factsRecords: number;
  /** Facts in the offline set. */
  readonly records: number;
  /** Calendar days (of 366) with at least three offline facts. */
  readonly days: number;
}

/** The offline set empties each person's `teamSeasonIds` to stay small; no template, selector or `rankFeed` reads them (`franchiseIds` stays). */

const digest = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

/** SHA-256 of the facts manifest with Windows line endings read as Unix ones, so a checkout on any system names the same build. */
export function manifestDigest(bytes: Uint8Array): string {
  return digest(Buffer.from(Buffer.from(bytes).toString("utf8").replaceAll("\r\n", "\n")));
}

function loadFacts(dataVersion: string): { records: OnThisDayRecord[]; manifest: string } {
  const dir = resolve(ROOT, `data/v1/${dataVersion}/facts`);
  const manifest = readFileSync(resolve(dir, "manifest.json"));
  const records: OnThisDayRecord[] = [];
  for (const name of readdirSync(resolve(dir, "store")).sort()) {
    const shard = JSON.parse(readFileSync(resolve(dir, "store", name), "utf8")) as { records: OnThisDayRecord[] };
    records.push(...shard.records);
  }
  return { records, manifest: manifestDigest(manifest) };
}

function slim(r: OnThisDayRecord): OnThisDayRecord {
  if (!r.person) return r;
  return { ...r, person: { ...r.person, teamSeasonIds: [] } };
}

/** Choose the offline set from the committed facts. Deterministic: no clock, no randomness. */
export function buildOffline(dataVersion: string): { records: OnThisDayRecord[]; build: OfflineBuild } {
  const { records: all, manifest } = loadFacts(dataVersion);
  const byDay = new Map<string, OnThisDayRecord[]>();
  for (const r of all) {
    if (r.datePrecision !== "day" || !r.eventDate) continue;
    const day = r.eventDate.slice(5);
    const list = byDay.get(day);
    if (list) list.push(r); else byDay.set(day, [r]);
  }
  const days = [...byDay.keys()].sort();
  const records: OnThisDayRecord[] = [];
  let covered = 0;
  for (const day of days) {
    const picked = bestOfDay(byDay.get(day)!);
    if (picked.length >= 3) covered += 1;
    // Show a day's facts oldest first, so the file reads as a calendar.
    records.push(...picked.sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? "") || a.recordId.localeCompare(b.recordId)).map(slim));
  }
  const ids = new Set(records.map((r) => r.recordId));
  if (ids.size !== records.length) throw new Error("Duplicate fact in the offline set");
  return { records, build: { dataVersion, factsManifestSha256: manifest, factsRecords: all.length, records: records.length, days: covered } };
}
