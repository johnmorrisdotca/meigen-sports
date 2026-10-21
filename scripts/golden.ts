import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { OnThisDayRecord } from "../src/schema.ts";
import { factDate } from "../src/templates/index.ts";

/**
 * The golden facts: famous, well-sourced facts the published data MUST hold with the right date and key
 * details, facts it is known to lack, and things that must never appear. The list itself is
 * test/golden/golden-facts.json, written by pipeline/golden/build_golden.py from Wikidata and English Wikipedia.
 */
export type Path = "full" | "offline" | "day" | "team" | "player";

export interface GoldenEntry {
  id: string; kind: string; sport: string; league: string | null; fame: "icon" | "star"; label: string; date: string;
  era: "pre-1920" | "1920-1969" | "1970-"; /** Set by the network builder from its seed; never set for an entry checked against the Wikidata dump, which holds no sex or gender. */ women?: boolean; para?: boolean; reason?: string;
  match?: { category: string; qid?: string; league?: string; winner?: string | null };
  source: { wikidata?: string | null; wikipedia?: string | null; verifiedBy: string; checkedOn: string };
}
export interface Golden { schemaVersion: 1; checkedOn: string; must: GoldenEntry[]; gaps: GoldenEntry[] }

/** The sport each league is played in: a fact about a league's club is about that sport. */
export const LEAGUE_SPORT: Record<string, string> = {
  mlb: "baseball", nba: "basketball", wnba: "basketball", nhl: "ice-hockey", nha: "ice-hockey", pcha: "ice-hockey", wchl: "ice-hockey", wha: "ice-hockey",
  nfl: "american-football", afl: "american-football", aafc: "american-football", cfl: "canadian-football", mls: "soccer", wc: "soccer", wwc: "soccer",
};
/** Sports the dataset holds facts for. Each needs at least `MIN_PER_SPORT` golden facts that must be present. */
export const COVERED_SPORTS = ["baseball", "basketball", "ice-hockey", "american-football", "canadian-football", "soccer"] as const;
export const MIN_PER_SPORT = 10;

export class Facts {
  readonly all: OnThisDayRecord[] = [];
  readonly dir: string;
  constructor(dir: string) {
    this.dir = dir;
    for (const name of readdirSync(resolve(dir, "store")).sort()) this.all.push(...(JSON.parse(readFileSync(resolve(dir, "store", name), "utf8")) as { records: OnThisDayRecord[] }).records);
  }
  private shard(path: string): OnThisDayRecord[] {
    const file = resolve(this.dir, path);
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { records: OnThisDayRecord[] }).records : [];
  }
  day(date: string): OnThisDayRecord[] { return this.shard(`days/${date.slice(5)}.json`); }
  team(franchiseId: number): OnThisDayRecord[] { return this.shard(`feeds/teams/f-${franchiseId}.json`); }
  player(personId: number): OnThisDayRecord[] { return this.shard(`feeds/players/${String(personId % 100).padStart(2, "0")}.json`); }
}

const fold = (text: string): string => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The fact in `records` that a golden entry names, or undefined. Names are never identity: a person is matched by Wikidata id. */
export function find(entry: GoldenEntry, records: readonly OnThisDayRecord[]): OnThisDayRecord | undefined {
  const m = entry.match;
  if (!m) return undefined;
  return records.find((r) => {
    if (r.eventDate !== entry.date || r.category !== m.category) return false;
    if (m.qid) return r.person?.qid === m.qid || r.recordId.endsWith(`:${m.qid}`) || r.recordId.includes(`:${m.qid}:`);
    return r.league === m.league;
  });
}

/** What is wrong with the fact a golden entry names: its details against the source, never against the data itself. */
export function details(entry: GoldenEntry, r: OnThisDayRecord): string[] {
  const problems: string[] = [];
  const m = entry.match!;
  if (r.datePrecision !== "day") problems.push("date precision is not day");
  const league = r.league ?? entry.league;
  if (league && LEAGUE_SPORT[league] && r.sport && r.sport !== LEAGUE_SPORT[league]) problems.push(`sport ${r.sport} for league ${league}`);
  if (r.sport && entry.sport !== r.sport && !["venue"].includes(entry.kind)) problems.push(`sport ${r.sport}, source sport ${entry.sport}`);
  if (m.winner) {
    // A sentence outside its own day opens with its date ("On December 18, 1932, Chicago Bears won ..."); the winner follows it.
    const text = fold(r.text ?? "").replace(/^(?:on|in|around) (?:[a-z]+ )?(?:\d{1,2}, )?\d{4}, /, ""), winner = fold(m.winner);
    const decided = r.homeScore != null && r.awayScore != null && r.homeScore !== r.awayScore;
    if (decided ? !text.startsWith(winner) : !text.includes(winner)) problems.push(`the text does not give ${m.winner} the win: ${r.text}`);
  }
  if (m.category === "player-birthday" && r.birthDate && r.birthDate !== entry.date) problems.push(`birthDate ${r.birthDate}`);
  if (m.category === "player-death" && r.deathDate && r.deathDate !== entry.date) problems.push(`deathDate ${r.deathDate}`);
  if (m.category === "player-birthday" && entry.label && r.person?.name && !fold(entry.label).startsWith(fold(r.person.name))) problems.push(`person ${r.person.name}, source says ${entry.label}`);
  return problems;
}

export interface Presence { readonly record: OnThisDayRecord; readonly paths: Path[] }

/** Where a present fact is served: the full dataset, the bundled offline set, its day shard, a team feed, a player feed. */
export function presence(entry: GoldenEntry, record: OnThisDayRecord, facts: Facts, offlineIds: ReadonlySet<string>): Presence {
  const paths: Path[] = ["full"];
  if (offlineIds.has(record.recordId)) paths.push("offline");
  if (facts.day(entry.date).some((r) => r.recordId === record.recordId)) paths.push("day");
  const franchises = [...(record.person?.franchiseIds ?? []), record.home?.franchiseId, record.away?.franchiseId].filter((n): n is number => typeof n === "number");
  if (franchises.some((id) => facts.team(id).some((r) => r.recordId === record.recordId))) paths.push("team");
  if (record.person?.personId != null && facts.player(record.person.personId).some((r) => r.recordId === record.recordId)) paths.push("player");
  return { record, paths };
}

export interface Rule { id: string; says: string; violations: (records: readonly OnThisDayRecord[], asOf: string) => string[] }

/** Awards only one position can win. Each is held to the position(s) its winners play, as DS1 spells them. */
export const POSITION_AWARDS: { award: RegExp; positions: RegExp }[] = [
  { award: /Cy Young|Rolaids Relief/i, positions: /^(P|SP|RP|CL|LHP|RHP)$/ },
  { award: /Vezina/i, positions: /^G$/ },
];

const clubStartYears = (r: OnThisDayRecord): number[] => (r.clubNames ?? []).flatMap((n) => { const m = n.match(/\((\d{4})/); return m ? [Number(m[1])] : []; });

/** Things that must never appear. Each rule returns the offending record ids, so a failure names them. */
export const NEVER: Rule[] = [
  { id: "no-person-before-1850", says: "no birth or death in 1602 or any year before 1850 (a general of the Joseon era was once taken for an athlete)",
    violations: (rs) => rs.filter((r) => r.person && r.eventDate && Number(r.eventDate.slice(0, 4)) < 1850).map((r) => r.recordId) },
  { id: "sport-matches-league", says: "a baseball player is never tagged motor racing, and a fact about a league's club carries that league's sport",
    violations: (rs) => rs.filter((r) => r.league && LEAGUE_SPORT[r.league] && r.sport && r.sport !== LEAGUE_SPORT[r.league]).map((r) => `${r.recordId} ${r.league}/${r.sport}`) },
  { id: "no-motor-racing", says: "no fact carries the bare label \"motor-racing\": it was the mislabel of a baseball player. A named discipline (formula-one, motorcycle-racing, rallying) is a real sport",
    violations: (rs) => rs.filter((r) => r.sport === "motor-racing").map((r) => r.recordId) },
  { id: "award-fits-position", says: "an individual award belongs to the person it names, never to a teammate: a Cy Young Award or a Rolaids Relief Man Award goes only with a pitcher and a Vezina Trophy only with a goaltender (148 non-pitchers once carried a Cy Young Award, read through the team-season of the real winner)",
    violations: (rs) => rs.filter((r) => {
      const award = `${r.personAward ?? ""} ${r.highlight ?? ""}`;
      return !!r.position && POSITION_AWARDS.some((rule) => rule.award.test(award) && !rule.positions.test(r.position!));
    }).map((r) => `${r.recordId} ${r.position}: ${r.personAward ?? r.highlight}`) },
  { id: "born-before-debut", says: "an athlete is never born after (or within thirteen years of) the first season of a club he is said to have played for",
    violations: (rs) => rs.filter((r) => r.category === "player-birthday" && r.birthDate && clubStartYears(r).some((y) => y < Number(r.birthDate!.slice(0, 4)) + 14)).map((r) => r.recordId) },
  { id: "birth-before-death", says: "a death never precedes the birth, and a stated age is between 0 and 125",
    violations: (rs) => rs.filter((r) => (r.birthDate && r.deathDate && r.birthDate >= r.deathDate) || (r.ageYears != null && (r.ageYears < 0 || r.ageYears > 125))).map((r) => r.recordId) },
  { id: "born-year-agrees", says: "bornYear is the year of birthDate",
    violations: (rs) => rs.filter((r) => r.bornYear != null && r.birthDate && r.bornYear !== Number(r.birthDate.slice(0, 4))).map((r) => r.recordId) },
  { id: "nothing-in-the-future", says: "no fact is dated after the day the golden list was checked",
    violations: (rs, asOf) => rs.filter((r) => r.eventDate && r.eventDate > asOf).map((r) => `${r.recordId} ${r.eventDate}`) },
  { id: "birthday-wording", says: "a birthday never says someone \"turns\" a number or \"would have turned\": living status is unknown unless a source confirms it",
    violations: (rs) => rs.filter((r) => /\bturns? \d|would have turned|\bturned \d/i.test(`${r.text ?? ""} ${r.textJa ?? ""}`)).map((r) => r.recordId) },
  { id: "title-needs-the-last-game", says: "\"won the <year> World Series / NBA Finals\" is said only of the game that ended the series",
    violations: (rs) => {
      const claims = rs.filter((r) => r.category === "championship-final" && (r.league === "mlb" || r.league === "nba"));
      const last = new Map<string, string>();
      for (const r of claims) { const key = `${r.league}:${r.seasonStartYear}`; if (!last.has(key) || r.eventDate! > last.get(key)!) last.set(key, r.eventDate!); }
      return claims.filter((r) => r.eventDate !== last.get(`${r.league}:${r.seasonStartYear}`)).map((r) => r.recordId);
    } },
  { id: "one-title-game-per-season", says: "a league season has one title game, never two",
    violations: (rs) => {
      const seen = new Map<string, string[]>();
      for (const r of rs.filter((x) => x.category === "championship-final")) { const key = `${r.league}:${r.seasonStartYear}`; seen.set(key, [...(seen.get(key) ?? []), r.recordId]); }
      return [...seen].filter(([, ids]) => ids.length > 1).map(([key, ids]) => `${key}: ${ids.join(", ")}`);
    } },
  { id: "final-is-not-a-tie", says: "a World Cup final level after extra time is never worded as a plain tie",
    violations: (rs) => rs.filter((r) => (r.league === "wc" || r.league === "wwc") && r.stage === "final" && r.homeScore != null && r.homeScore === r.awayScore && / tied /.test(r.text ?? "")).map((r) => r.recordId) },
  { id: "no-invented-day", says: "no franchise identity or award is dated on a placeholder day (Jan 1, Mar 1, Jul 1)",
    violations: (rs) => rs.filter((r) => r.category === "franchise-event" && /-(01-01|03-01|07-01)$/.test(r.eventDate ?? "")).map((r) => r.recordId) },
  { id: "no-sex-or-para-labels", says: "no sport, tag or text carries a women- or para- batch label (John's rule: no sex, gender or para classification in the data)",
    violations: (rs) => rs.filter((r) => /^(women|para)[-_]/.test(r.sport ?? "") || (r.tags ?? []).some((t) => /^(women|para)[-_]/.test(t))).map((r) => r.recordId) },
  { id: "unique-record-ids", says: "no fact is stored twice",
    violations: (rs) => { const seen = new Set<string>(); const dup: string[] = []; for (const r of rs) { if (seen.has(r.recordId)) dup.push(r.recordId); seen.add(r.recordId); } return dup; } },
  { id: "clean-sentences", says: "a sentence never holds undefined, null, NaN, \"(none)\" or a doubled space, and ends with a full stop",
    violations: (rs) => rs.filter((r) => /undefined|\bnull\b|NaN|\(none\)|（none）|\s{2}/.test(`${r.text ?? ""} ${r.textJa ?? ""}`) || !/[.。]$/.test(r.text ?? "")).map((r) => r.recordId) },
  { id: "dated-sentences", says: "a stored sentence is read on days that are not its fact's day, so it carries the full date at the precision the record holds and never says \"today\" or \"on this day\"",
    violations: (rs) => rs.filter((r) => {
      const en = factDate(r, "en"), ja = factDate(r, "ja");
      const said = (text: string | undefined, date: string | null) => !text || !date || text.includes(date);
      return !said(r.text, en) || !said(r.textJa, ja) || /\btoday\b|\bthis day\b|\bturns? \d|今日|この日/i.test(`${r.text ?? ""} ${r.textJa ?? ""}`);
    }).map((r) => r.recordId) },
];

export function loadGolden(root = "."): Golden {
  return JSON.parse(readFileSync(resolve(root, "test/golden/golden-facts.json"), "utf8")) as Golden;
}
export function loadLocked(root = "."): Record<string, Path[]> {
  const file = resolve(root, "test/golden/locked-paths.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) as Record<string, Path[]> : {};
}

export interface Report {
  readonly present: number; readonly missing: string[]; readonly wrong: string[]; readonly gapsNowPresent: string[];
  readonly bySport: Record<string, number>; readonly byEra: Record<string, number>; readonly byKind: Record<string, number>; readonly byPath: Record<Path, number>;
  readonly women: number; readonly rankingGaps: string[]; readonly lost: string[]; readonly paths: Record<string, Path[]>;
}

/** Run the whole list against one fact dataset and the offline set. */
export function run(golden: Golden, facts: Facts, offlineIds: ReadonlySet<string>, locked: Record<string, Path[]> = {}): Report {
  const missing: string[] = [], wrong: string[] = [], rankingGaps: string[] = [], lost: string[] = [];
  const bySport: Record<string, number> = {}, byEra: Record<string, number> = {}, byKind: Record<string, number> = {};
  const byPath: Record<Path, number> = { full: 0, offline: 0, day: 0, team: 0, player: 0 };
  const paths: Record<string, Path[]> = {};
  let present = 0, women = 0;
  for (const entry of golden.must) {
    const record = find(entry, facts.all);
    if (!record) { missing.push(`${entry.id} ${entry.date} ${entry.label}`); continue; }
    present += 1;
    for (const problem of details(entry, record)) wrong.push(`${entry.id} ${entry.label}: ${problem}`);
    const found = presence(entry, record, facts, offlineIds);
    paths[entry.id] = found.paths;
    for (const p of found.paths) byPath[p] += 1;
    bySport[entry.sport] = (bySport[entry.sport] ?? 0) + 1;
    byEra[entry.era] = (byEra[entry.era] ?? 0) + 1;
    byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1;
    if (entry.women) women += 1;
    if (entry.fame === "icon" && !found.paths.includes("offline")) rankingGaps.push(`${entry.id} ${entry.label}`);
    for (const p of locked[entry.id] ?? []) if (!found.paths.includes(p)) lost.push(`${entry.id} ${entry.label}: no longer on ${p}`);
  }
  const gapsNowPresent: string[] = [];
  for (const entry of golden.gaps) {
    const record = entry.match ? find(entry, facts.all) : undefined;
    if (record) gapsNowPresent.push(`${entry.id} ${entry.label}`);
  }
  return { present, missing, wrong, gapsNowPresent, bySport, byEra, byKind, byPath, women, rankingGaps, lost, paths };
}

export function describe(golden: Golden, report: Report): string {
  const gapBySport: Record<string, number> = {}, gapByKind: Record<string, number> = {};
  for (const g of golden.gaps) { gapBySport[g.sport] = (gapBySport[g.sport] ?? 0) + 1; gapByKind[g.kind] = (gapByKind[g.kind] ?? 0) + 1; }
  const line = (label: string, counts: Record<string, number>): string => `  ${label}: ${Object.entries(counts).sort().map(([k, v]) => `${k} ${v}`).join(", ")}`;
  return [
    `Golden facts: ${golden.must.length} must (${report.present} present), ${golden.gaps.length} known gaps; list checked ${golden.checkedOn}`,
    line("must by sport", report.bySport), line("must by era", report.byEra), line("must by kind", report.byKind),
    `  must by path: ${Object.entries(report.byPath).map(([k, v]) => `${k} ${v}`).join(", ")}; women's facts ${report.women}`,
    line("known gaps by sport", gapBySport), line("known gaps by kind", gapByKind),
    `  icons not on the offline set (ranking gaps): ${report.rankingGaps.length}`,
  ].join("\n");
}

/** Every reason the golden suite fails, empty when it passes. */
export function failures(golden: Golden, facts: Facts, offlineIds: ReadonlySet<string>, locked: Record<string, Path[]>, offlineRecords: readonly OnThisDayRecord[]): { report: Report; problems: string[] } {
  const report = run(golden, facts, offlineIds, locked);
  const problems: string[] = [];
  for (const m of report.missing) problems.push(`MISSING from the published data: ${m}`);
  for (const w of report.wrong) problems.push(`WRONG: ${w}`);
  for (const g of report.gapsNowPresent) problems.push(`A known gap is now present, move it to the must list: ${g}`);
  for (const l of report.lost) problems.push(`LOST a path it had: ${l}`);
  for (const sport of COVERED_SPORTS) if ((report.bySport[sport] ?? 0) < MIN_PER_SPORT) problems.push(`Only ${report.bySport[sport] ?? 0} golden facts for ${sport}; at least ${MIN_PER_SPORT} are needed`);
  for (const rule of NEVER) for (const v of rule.violations(facts.all, golden.checkedOn)) problems.push(`NEVER (${rule.id}): ${v}`);
  for (const rule of NEVER.filter((r) => !["no-person-before-1850", "nothing-in-the-future", "title-needs-the-last-game", "one-title-game-per-season", "no-invented-day", "unique-record-ids"].includes(r.id))) {
    for (const v of rule.violations(offlineRecords, golden.checkedOn)) problems.push(`NEVER in the offline set (${rule.id}): ${v}`);
  }
  return { report, problems };
}
