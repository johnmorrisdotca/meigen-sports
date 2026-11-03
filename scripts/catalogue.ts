import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Catalogue } from "../src/catalogue.ts";
import type { MeigenRecord } from "../src/types.ts";
import type { OnThisDayRecord } from "../src/schema.ts";
import type { OfflineBuild } from "./offline.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A day, sport, league or decade is "thin" below these numbers of facts. */
export const THRESHOLDS = { day: 150, sport: 10, league: 100, decade: 500 } as const;

interface Notes { gaps: Catalogue["gaps"]["notes"]; rules: Catalogue["rules"] }
interface Inputs { builtOn?: string; inputs?: Record<string, { sha256: string; bytes: number; modified?: string }> }

const sorted = (counts: Map<string, number>, by: "count" | "key" = "count"): Record<string, number> =>
  Object.fromEntries([...counts].sort(by === "key" ? (a, b) => a[0].localeCompare(b[0]) : (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
const bump = (counts: Map<string, number>, key: string): void => { counts.set(key, (counts.get(key) ?? 0) + 1); };
const below = (counts: Record<string, number>, limit: number, skip = "none"): Record<string, number> =>
  Object.fromEntries(Object.entries(counts).filter(([key, n]) => key !== skip && n < limit).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])));

/** The 366 days of a year with a 29 February, as `MM-DD` in calendar order. */
export const CALENDAR_DAYS: readonly string[] = Array.from({ length: 366 }, (_, day) => new Date(Date.UTC(2024, 0, day + 1)).toISOString().slice(5, 10));

/** The catalogue, a pure function of the facts and what is passed in: no clock, nothing random. Every number is counted here from the facts. */
export function buildCatalogue(args: {
  facts: readonly OnThisDayRecord[]; records: readonly MeigenRecord[]; offline: readonly OnThisDayRecord[]; offlineBuild: OfflineBuild;
  packageVersion: string; notes: Notes; inputs: Inputs;
}): Catalogue {
  const { facts, records, offline, offlineBuild } = args;
  const kinds = new Map<string, number>(), sports = new Map<string, number>(), leagues = new Map<string, number>();
  const decades = new Map<string, number>(), years = new Map<string, number>(), perDay = new Map<string, number>();
  const sources = new Map<string, { licence: string; attribution: string; facts: number }>();
  const people = new Map<string, { sport: string; deceased: boolean }>();
  const eventItems = new Map<string, string>(), eventKinds = new Map<string, number>();
  let en = 0, ja = 0, both = 0;
  for (const f of facts) {
    bump(kinds, f.category); bump(sports, f.sport ?? "none"); bump(leagues, f.league ?? "none");
    if (f.eventDate) {
      bump(years, f.eventDate.slice(0, 4)); bump(decades, `${f.eventDate.slice(0, 3)}0s`);
      if (f.datePrecision === "day") bump(perDay, f.eventDate.slice(5));
    }
    const source = sources.get(f.source.sourceId) ?? { licence: f.source.licence, attribution: f.source.attribution, facts: 0 };
    source.facts += 1; sources.set(f.source.sourceId, source);
    if (f.text) en += 1;
    if (f.textJa) ja += 1;
    if (f.text && f.textJa) both += 1;
    if (f.category === "player-birthday" || f.category === "player-death") {
      const key = f.person?.qid ?? String(f.person?.personId);
      const known = people.get(key);
      const deceased = f.category === "player-death" || f.livingStatus === "deceased";
      people.set(key, { sport: known?.sport ?? f.sport ?? "none", deceased: (known?.deceased ?? false) || deceased });
    }
    if (f.category === "sport-event" || f.category === "competition-start" || f.category === "competition-end") {
      bump(eventKinds, f.category);
      if (f.wikidata) eventItems.set(f.wikidata, f.sport ?? "none");
    }
  }
  const peopleBySport = new Map<string, { total: number; deceased: number }>();
  for (const { sport, deceased } of people.values()) {
    const row = peopleBySport.get(sport) ?? { total: 0, deceased: 0 };
    row.total += 1; if (deceased) row.deceased += 1; peopleBySport.set(sport, row);
  }
  const eventSports = new Map<string, number>();
  for (const sport of eventItems.values()) bump(eventSports, sport);
  const dayCounts = CALENDAR_DAYS.map((day) => perDay.get(day) ?? 0);
  const least = dayCounts.indexOf(Math.min(...dayCounts)), most = dayCounts.indexOf(Math.max(...dayCounts));
  const offlinePerDay = new Map<string, number>();
  for (const r of offline) if (r.eventDate) bump(offlinePerDay, r.eventDate.slice(5));
  const offlineCounts = [...offlinePerDay.values()];
  const bySport = sorted(sports), byLeague = sorted(leagues), byDecade = sorted(decades, "key");
  const quoteSources = new Map<string, number>();
  for (const r of records) if (r.kind === "quote") bump(quoteSources, r.source.sourceId);
  const deceased = [...people.values()].filter((p) => p.deceased).length;
  const extracts = Object.entries(args.inputs.inputs ?? {}).map(([name, v]) => ({ name, sha256: v.sha256, bytes: v.bytes, modified: v.modified ?? null })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    schemaVersion: 1, package: args.packageVersion, dataVersion: offlineBuild.dataVersion, builtOn: args.inputs.builtOn ?? null, factsManifestSha256: offlineBuild.factsManifestSha256,
    totals: { facts: facts.length, quotations: records.filter((r) => r.kind === "quote").length, historyRows: records.filter((r) => r.kind === "history").length },
    byKind: sorted(kinds), bySport, byLeague, byDecade, byYear: sorted(years, "key"),
    days: {
      perDay: dayCounts, first: CALENDAR_DAYS[0]!, min: { day: CALENDAR_DAYS[least]!, facts: dayCounts[least]! }, max: { day: CALENDAR_DAYS[most]!, facts: dayCounts[most]! },
      empty: CALENDAR_DAYS.filter((_, i) => dayCounts[i] === 0), thin: CALENDAR_DAYS.filter((_, i) => dayCounts[i]! < THRESHOLDS.day),
    },
    languages: { en, ja, both },
    people: { total: people.size, deceased, notKnownDeceased: people.size - deceased, bySport: Object.fromEntries([...peopleBySport].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))) },
    events: { total: eventItems.size, bySport: sorted(eventSports), factsByKind: sorted(eventKinds) },
    sources: [...sources].sort((a, b) => b[1].facts - a[1].facts || a[0].localeCompare(b[0])).map(([sourceId, s]) => ({ sourceId, ...s, share: Math.round((s.facts / facts.length) * 10000) / 10000 })),
    extracts,
    quotations: { total: records.filter((r) => r.kind === "quote").length, bySource: sorted(quoteSources) },
    offline: { records: offline.length, days: offlineBuild.days, minPerDay: Math.min(...offlineCounts), maxPerDay: Math.max(...offlineCounts), shareOfFacts: Math.round((offline.length / facts.length) * 10000) / 10000 },
    gaps: { thresholds: THRESHOLDS, thinSports: below(bySport, THRESHOLDS.sport), thinLeagues: below(byLeague, THRESHOLDS.league), thinDecades: below(byDecade, THRESHOLDS.decade), notes: args.notes.gaps },
    rules: args.notes.rules,
  };
}

/** The notes and the inputs record the build reads, from the committed files. */
export function readCatalogueSources(): { notes: Notes; inputs: Inputs } {
  const inputsFile = resolve(ROOT, "data-sources/facts/inputs.json");
  return {
    notes: JSON.parse(readFileSync(resolve(ROOT, "data-sources/catalogue-notes.json"), "utf8")) as Notes,
    inputs: existsSync(inputsFile) ? JSON.parse(readFileSync(inputsFile, "utf8")) as Inputs : {},
  };
}
