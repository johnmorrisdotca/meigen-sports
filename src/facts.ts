import { isDate, monthDayOf } from "./dates.ts";
import type { FactFilters, OnThisDayRecord, TeamRef } from "./schema.ts";
import { captionFromFact } from "./sentences.ts";

function sportSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  const mapped: Record<string, string> = {
    hockey: "ice-hockey", ice_hockey: "ice-hockey", american_football: "american-football",
    canadian_football: "canadian-football", soccer: "soccer", baseball: "baseball", basketball: "basketball",
  };
  return mapped[value] ?? value.replaceAll("_", "-");
}

function yearOf(record: OnThisDayRecord): number | null {
  if (record.eventDate && /^\d{4}-/.test(record.eventDate)) return Number(record.eventDate.slice(0, 4));
  if (record.draftYear) return record.draftYear;
  if (record.seasonStartYear) return record.seasonStartYear;
  if (record.bornYear) return record.bornYear;
  return null;
}

function teamMatches(team: TeamRef | undefined, filter: NonNullable<FactFilters["team"]>): boolean {
  if (!team) return false;
  if (filter.franchiseId != null && team.franchiseId === filter.franchiseId) return true;
  if (filter.fifaCode && team.fifaCode === filter.fifaCode) return true;
  if (filter.soccerTeamId && team.soccerTeamId === filter.soccerTeamId) return true;
  if (filter.countryCode && team.countryCode === filter.countryCode) return true;
  return false;
}

/** Primary extract family plus non-exclusive history tags. Order is category first, then tags, unique. */
export function tagsOf(record: OnThisDayRecord): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [record.category, ...(record.tags ?? [])]) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

function matches(record: OnThisDayRecord, filters: FactFilters): boolean {
  if (filters.sport && sportSlug(record.sport) !== sportSlug(filters.sport) && !(record.sport === filters.sport)) return false;
  if (filters.league && record.league !== filters.league) return false;
  if (filters.competition && record.competition !== filters.competition && record.league !== filters.competition) return false;
  if (filters.category && !tagsOf(record).includes(filters.category)) return false;
  if (filters.country) {
    const code = filters.country;
    const hit = record.home?.countryCode === code || record.away?.countryCode === code || record.venueCountry === code;
    if (!hit) return false;
  }
  if (filters.team) {
    const personTeams = record.person?.franchiseIds ?? [];
    const byFranchise = filters.team.franchiseId != null && personTeams.includes(filters.team.franchiseId);
    if (!teamMatches(record.home, filters.team) && !teamMatches(record.away, filters.team) && !byFranchise) return false;
  }
  if (filters.player) {
    const person = record.person;
    const byId = filters.player.personId != null && person?.personId === filters.player.personId;
    const byQid = filters.player.qid != null && person?.qid === filters.player.qid;
    if (!byId && !byQid) return false;
  }
  if (filters.from != null || filters.to != null) {
    const year = yearOf(record);
    if (year == null) return false;
    if (filters.from != null && year < filters.from) return false;
    if (filters.to != null && year > filters.to) return false;
  }
  if (filters.date) {
    if (record.datePrecision !== "day" || !record.eventDate) return false;
    const day = monthDayOf(filters.date);
    if (record.eventDate.slice(5) !== day) return false;
    if (isDate(filters.date) && record.eventDate > filters.date) return false;
  }
  return true;
}

/** Filter on-this-day facts. Multiple filters intersect. The input order is kept. */
export function factsFor(records: readonly OnThisDayRecord[], filters: FactFilters = {}): OnThisDayRecord[] {
  if (filters.date) monthDayOf(filters.date);
  if (filters.from != null && filters.to != null && filters.from > filters.to) return [];
  const seen = new Set<string>();
  const out: OnThisDayRecord[] = [];
  for (const record of records) {
    if (!matches(record, filters) || seen.has(record.recordId)) continue;
    seen.add(record.recordId);
    out.push(record);
  }
  return out;
}

/**
 * Calendar month-day in an IANA time zone for an explicit instant.
 * The library does not read the clock; the caller supplies `nowIso`.
 */
export function calendarDayInZone(timeZone: string, nowIso: string): string {
  if (!timeZone || !nowIso) throw new RangeError("Expected a time zone and an ISO instant");
  const ms = Date.parse(nowIso);
  if (!Number.isFinite(ms)) throw new RangeError("Expected an ISO instant");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new RangeError("Expected a calendar day in the given time zone");
  return `${month}-${day}`;
}

/** Facts whose calendar day matches `nowIso` in `timeZone`, then any other filters. */
export function today(records: readonly OnThisDayRecord[], timeZone: string, nowIso: string, filters: FactFilters = {}): OnThisDayRecord[] {
  return factsFor(records, { ...filters, date: calendarDayInZone(timeZone, nowIso) });
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

function shuffleWithSeed<T>(records: readonly T[], seed: string): T[] {
  const copy = records.slice();
  let state = hashSeed(seed) || 1;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    state = Math.imul(state ^ state >>> 15, 1 | state);
    state = state + Math.imul(state ^ state >>> 7, 61 | state) ^ state;
    const j = ((state >>> 0) % (i + 1));
    const a = copy[i]!, b = copy[j]!;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

function competitionKey(record: OnThisDayRecord): string {
  return record.competition ?? record.league ?? record.category;
}

export function uniqueRecordIds(records: readonly OnThisDayRecord[]): boolean {
  const ids = records.map((record) => record.recordId);
  return new Set(ids).size === ids.length;
}

function fame(record: OnThisDayRecord): number {
  if (record.priorityAthlete) return 2;
  if ((record.sitelinks ?? 0) >= 20) return 1;
  return 0;
}

function significance(record: OnThisDayRecord): number {
  const tags = new Set(tagsOf(record));
  let score = 0;
  if (tags.has("sport-record") || tags.has("career-stat-milestone") || record.featuredReasons?.includes("record")) score += 95;
  if (tags.has("championship-win") || record.category === "championship-final") score += 90;
  if (tags.has("series-clinch") || tags.has("historic-cup-series")) score += 80;
  if (tags.has("overtime-result")) score += 70;
  if (tags.has("shutout")) score += 60;
  if (record.featuredReasons?.includes("big-margin")) score += 50;
  if (record.category === "award") score += 45;
  if (record.category === "player-death") score += 40;
  if (record.category === "venue-opening") score += 35;
  if (record.category === "franchise-event") score += 30;
  if (record.category === "player-birthday") score += 15;
  return score;
}

function personKey(record: OnThisDayRecord): string | null {
  if (record.person?.personId != null) return `p:${record.person.personId}`;
  if (record.person?.qid) return `q:${record.person.qid}`;
  return null;
}

function teamKeys(record: OnThisDayRecord): string[] {
  const keys: string[] = [];
  for (const team of [record.home, record.away]) {
    if (team?.franchiseId != null) keys.push(`f:${team.franchiseId}`);
    else if (team?.soccerTeamId) keys.push(`s:${team.soccerTeamId}`);
  }
  for (const fid of record.person?.franchiseIds ?? []) keys.push(`f:${fid}`);
  return keys;
}

/**
 * Rank a day's (or team's) facts for a public feed. Unique recordIds.
 * Caps two per tag and per competition. Skips a later fact that repeats a person or team already listed.
 */
export function rankFeed(records: readonly OnThisDayRecord[], n: number, maxPer = 2): OnThisDayRecord[] {
  const ordered = records.slice().sort((a, b) => {
    const diff = significance(b) - significance(a);
    if (diff !== 0) return diff;
    const byFame = fame(b) - fame(a);
    if (byFame !== 0) return byFame;
    return `${a.eventDate ?? ""}\t${a.recordId}`.localeCompare(`${b.eventDate ?? ""}\t${b.recordId}`);
  });
  const pick = (relaxPeople: boolean, relaxTags: boolean): OnThisDayRecord[] => {
    const picked: OnThisDayRecord[] = [];
    const seen = new Set<string>();
    const byTag = new Map<string, number>();
    const byCompetition = new Map<string, number>();
    const people = new Set<string>();
    const teams = new Set<string>();
    for (const record of ordered) {
      if (picked.length >= n) break;
      if (seen.has(record.recordId)) continue;
      const tags = tagsOf(record);
      const competition = competitionKey(record);
      const person = personKey(record);
      const teamIds = teamKeys(record);
      if (!relaxTags && (tags.some((tag) => (byTag.get(tag) ?? 0) >= maxPer) || (byCompetition.get(competition) ?? 0) >= maxPer)) continue;
      if (!relaxPeople && person && people.has(person)) continue;
      if (!relaxPeople && teamIds.some((key) => teams.has(key))) continue;
      picked.push(record);
      seen.add(record.recordId);
      for (const tag of tags) byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
      byCompetition.set(competition, (byCompetition.get(competition) ?? 0) + 1);
      if (person) people.add(person);
      for (const key of teamIds) teams.add(key);
    }
    return picked;
  };
  const first = pick(false, false);
  if (first.length >= Math.min(3, n, records.length)) return first;
  const second = pick(true, false);
  if (second.length >= Math.min(3, n, records.length)) return second;
  return pick(true, true);
}

/**
 * Pick `n` facts after applying filters. The same seed always yields the same rows.
 * Each fact is counted once. Caps at two records per history tag and per competition.
 * A multi-tag fact is skipped if any of its tags is already at the cap.
 */
export function randomFacts(records: readonly OnThisDayRecord[], n: number, filters: FactFilters = {}, seed: string): OnThisDayRecord[] {
  if (!seed) throw new RangeError("randomFacts requires an explicit seed");
  const pool = shuffleWithSeed(factsFor(records, filters), seed);
  const picked: OnThisDayRecord[] = [];
  const seen = new Set<string>();
  const byTag = new Map<string, number>();
  const byCompetition = new Map<string, number>();
  for (const record of pool) {
    if (picked.length >= n) break;
    const tags = tagsOf(record);
    const competition = competitionKey(record);
    if (seen.has(record.recordId)) continue;
    if (tags.some((tag) => (byTag.get(tag) ?? 0) >= 2) || (byCompetition.get(competition) ?? 0) >= 2) continue;
    picked.push(record);
    seen.add(record.recordId);
    for (const tag of tags) byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
    byCompetition.set(competition, (byCompetition.get(competition) ?? 0) + 1);
  }
  return picked;
}

export function withCaptions(record: OnThisDayRecord): OnThisDayRecord {
  const text = record.text ?? captionFromFact(record, "en") ?? undefined;
  const textJa = record.textJa ?? captionFromFact(record, "ja") ?? undefined;
  return { ...record, ...(text ? { text } : {}), ...(textJa ? { textJa } : {}) };
}

export { sportSlug };
