import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isRichFact } from "../src/sentences.ts";
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

function loadFacts(dataVersion: string): { records: OnThisDayRecord[]; manifest: string } {
  const dir = resolve(ROOT, `data/v1/${dataVersion}/facts`);
  const manifest = readFileSync(resolve(dir, "manifest.json"));
  const records: OnThisDayRecord[] = [];
  for (const name of readdirSync(resolve(dir, "store")).sort()) {
    const shard = JSON.parse(readFileSync(resolve(dir, "store", name), "utf8")) as { records: OnThisDayRecord[] };
    records.push(...shard.records);
  }
  return { records, manifest: digest(manifest) };
}

/** How much a fact is worth showing on its day: finals, famous people and playoff drama above routine results. */
export function offlineScore(r: OnThisDayRecord): number {
  const tags = new Set([r.category, ...(r.tags ?? [])]);
  const reasons = new Set(r.featuredReasons ?? []);
  const playoffs = r.phase === "playoffs";
  switch (r.category) {
    case "championship-final": return 95 + (tags.has("shutout") ? 3 : 0);
    case "award": return 85;
    case "soccer-on-day": return 70 + (r.stage && /final|semi|quarter/i.test(r.stage) ? 25 : 0);
    case "venue-opening": return 55;
    case "franchise-event": return 45;
    case "player-birthday":
    case "player-death": {
      let score = 30;
      if (r.priorityAthlete) score += 45;
      if (r.personAward) score += 30;
      if (r.highlight) score += 10;
      if ((r.championships ?? 0) > 0) score += 10;
      if ((r.sitelinks ?? 0) >= 20) score += 15;
      if (r.category === "player-death") score += 5;
      return score;
    }
    default: {
      let score = 20;
      if (playoffs) score += 25;
      if (tags.has("overtime-result")) score += 15;
      if (reasons.has("playoff-shutout")) score += 20;
      else if (tags.has("shutout")) score += 12;
      if (reasons.has("big-margin")) score += 8;
      return score;
    }
  }
}

function personKey(r: OnThisDayRecord): string | null {
  if (r.person?.personId != null) return `p:${r.person.personId}`;
  return r.person?.qid ? `q:${r.person.qid}` : null;
}

function teamKeys(r: OnThisDayRecord): string[] {
  const keys: string[] = [];
  for (const team of [r.home, r.away]) {
    if (team?.franchiseId != null) keys.push(`f:${team.franchiseId}`);
    else if (team?.soccerTeamId) keys.push(`s:${team.soccerTeamId}`);
  }
  return keys;
}

const BASE = 4;
const MAX = 5;
/** A fifth fact is added only when it is clearly as good as a final or a famous person. */
const FIFTH_AT_LEAST = 85;

/** Pick the best three to five facts for one day, varied by kind, sport, person and club. */
export function pickDay(rows: readonly OnThisDayRecord[]): OnThisDayRecord[] {
  const ordered = rows.filter(isRichFact).map((r) => ({ r, score: offlineScore(r) })).sort((a, b) =>
    b.score - a.score || (a.r.eventDate ?? "").localeCompare(b.r.eventDate ?? "") || a.r.recordId.localeCompare(b.r.recordId));
  const pass = (perCategory: number, perSport: number, unique: boolean): { r: OnThisDayRecord; score: number }[] => {
    const picked: { r: OnThisDayRecord; score: number }[] = [];
    const byCategory = new Map<string, number>();
    const bySport = new Map<string, number>();
    const seen = new Set<string>();
    for (const item of ordered) {
      if (picked.length >= MAX) break;
      const { r } = item;
      if ((byCategory.get(r.category) ?? 0) >= perCategory) continue;
      const sport = r.sport ?? "";
      if (sport && (bySport.get(sport) ?? 0) >= perSport) continue;
      const keys = [personKey(r), ...teamKeys(r)].filter((k): k is string => k !== null);
      if (unique && keys.some((k) => seen.has(k))) continue;
      picked.push(item);
      byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
      if (sport) bySport.set(sport, (bySport.get(sport) ?? 0) + 1);
      for (const k of keys) seen.add(k);
    }
    return picked;
  };
  const need = Math.min(3, ordered.length);
  let picked = pass(2, 2, true);
  if (picked.length < need) picked = pass(2, 3, true);
  if (picked.length < need) picked = pass(3, 4, false);
  if (picked.length < need) picked = pass(5, 5, false);
  const kept = picked.filter((item, index) => index < BASE || item.score >= FIFTH_AT_LEAST);
  return kept.map((item) => item.r);
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
    const picked = pickDay(byDay.get(day)!);
    if (picked.length >= 3) covered += 1;
    // Show a day's facts oldest first, so the file reads as a calendar.
    records.push(...picked.sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? "") || a.recordId.localeCompare(b.recordId)).map(slim));
  }
  const ids = new Set(records.map((r) => r.recordId));
  if (ids.size !== records.length) throw new Error("Duplicate fact in the offline set");
  return { records, build: { dataVersion, factsManifestSha256: manifest, factsRecords: all.length, records: records.length, days: covered } };
}
