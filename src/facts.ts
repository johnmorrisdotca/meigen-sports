import { isDate, monthDayOf } from "./dates.ts";
import type { FactFilters, OnThisDayRecord, TeamRef } from "./schema.ts";
import { captionFromFact, isRichFact } from "./sentences.ts";

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

/** How much a fact is worth showing: finals, famous people and playoff drama above routine results. A pure function of the fact's fields. */
export function significance(record: OnThisDayRecord): number {
  const tags = new Set(tagsOf(record));
  const reasons = new Set(record.featuredReasons ?? []);
  if (tags.has("sport-record") || tags.has("career-stat-milestone") || reasons.has("record")) return 100;
  switch (record.category) {
    case "championship-final": return 95 + (tags.has("shutout") ? 3 : 0);
    case "award": return 85;
    case "soccer-on-day": return 70 + (/^final$/i.test(record.stage ?? "") ? 30 : /semi/i.test(record.stage ?? "") ? 20 : /quarter/i.test(record.stage ?? "") ? 10 : 0);
    case "venue-opening": return 55;
    // An event or a competition edition: by the editions of its page, as a person is. A winner named adds a little: the fact says who.
    case "competition-start":
    case "competition-end":
    case "sport-event": {
      const editions = record.sitelinks ?? 0;
      return 30 + (editions >= 100 ? 45 : editions >= 50 ? 28 : editions >= 30 ? 16 : editions >= 20 ? 10 : editions >= 10 ? 5 : 0) + (record.winnerName ? 6 : 0);
    }
    case "franchise-event": return 45;
    case "player-birthday":
    case "player-death": {
      let score = 30;
      // A name on the priority list is famous; a list fill known to have under 20 Wikipedia editions counts for less than a major award.
      if (record.priorityAthlete) score += record.sitelinks != null && record.sitelinks < 20 ? 20 : 45;
      if (record.personAward) score += 30;
      if (record.hallOfFameYear) score += 25;
      // The number of individual awards he won himself: a long list of them is fame that one flagship award is not.
      score += (record.awardCount ?? 0) >= 10 ? 15 : (record.awardCount ?? 0) >= 5 ? 8 : 0;
      if (record.highlight) score += 10;
      if ((record.championships ?? 0) > 0) score += 10;
      if ((record.sitelinks ?? 0) >= 20) score += 15;
      // Editions beyond twenty: a name known in fifty languages outranks one known in twenty, and one known in a hundred is known everywhere (the
      // priority list gives such a name 45 and the twenty-edition bonus 15; a name the list does not hold gets the same by its editions alone).
      if ((record.sitelinks ?? 0) >= 50) score += 20;
      if ((record.sitelinks ?? 0) >= 100) score += 25;
      if (record.category === "player-death") score += 5;
      return score;
    }
    default: {
      let score = 20;
      if (record.phase === "playoffs") score += 25;
      if (tags.has("overtime-result")) score += 15;
      if (reasons.has("playoff-shutout")) score += 20;
      else if (tags.has("shutout")) score += 12;
      if (reasons.has("big-margin")) score += 8;
      return score;
    }
  }
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

/** How a ranked list is chosen. Every cap names what it counts: a tag (`championship-win`), a competition (`competition:nhl`), a person (`p:12`) or a club (`f:3`). */
export interface RankOptions {
  /** Most facts of one tag, and of one competition, in the list. Default 2. */
  readonly maxPer?: number;
  /** Most facts about one person. Default 1. A club is never listed twice while another choice is left. */
  readonly personMax?: number;
  /** The list's fewest facts, when the day or the feed has that many: caps and the one-person rule relax, in that order, to reach it. Default 3. */
  readonly minimum?: number;
  /** Most facts of one sport in the list (no cap when left out). Relaxed together with `maxPer`, so a quiet day still reaches its minimum. */
  readonly maxPerSport?: number;
  /** Keys the list is already about (a tag feed's tag, a league feed's league, a team feed's club, `sport:<sport>`): they are not counted. */
  readonly exempt?: readonly string[];
}

/** How a calendar day's list is chosen: at most three facts of one sport, so a day is not all baseball or all basketball. */
const DAY_LIST: RankOptions = { maxPerSport: 3 };

/**
 * Rank facts by `significance` and take the first `n` that keep to the caps, with no repeated fact. The same input always gives the
 * same list, and a list of `n` is the head of a longer list of the same facts. Facts are used as given: nothing is dropped for wording.
 */
export function rankRecords(records: readonly OnThisDayRecord[], n: number, options: RankOptions = {}): OnThisDayRecord[] {
  const maxPer = options.maxPer ?? 2, personMax = options.personMax ?? 1, minimum = options.minimum ?? 3;
  const exempt = new Set(options.exempt ?? []);
  // Equal significance: the more recent first (a reader knows the 2022 final better than the 1932 championship), then by id.
  const ordered = records.map((record) => ({ record, score: significance(record) })).sort((a, b) =>
    b.score - a.score || `${b.record.eventDate ?? ""}\t${a.record.recordId}`.localeCompare(`${a.record.eventDate ?? ""}\t${b.record.recordId}`)).map((item) => item.record);
  const pick = (cap: number | null, people: boolean): OnThisDayRecord[] => {
    const picked: OnThisDayRecord[] = [];
    const seen = new Set<string>();
    const counts = new Map<string, number>();
    const persons = new Map<string, number>();
    const teams = new Set<string>();
    // The sport cap loosens by the same steps as the tag and competition caps, and goes with them when they do.
    const sportCap = options.maxPerSport == null || cap === null ? null : options.maxPerSport + (cap - maxPer);
    for (const record of ordered) {
      if (picked.length >= n) break;
      if (seen.has(record.recordId)) continue;
      const keys = [...tagsOf(record), `competition:${competitionKey(record)}`].filter((key) => !exempt.has(key));
      if (cap !== null && keys.some((key) => (counts.get(key) ?? 0) >= cap)) continue;
      const sport = record.sport && !exempt.has(`sport:${record.sport}`) ? `sport:${record.sport}` : null;
      if (sportCap !== null && sport && (counts.get(sport) ?? 0) >= sportCap) continue;
      const person = personKey(record);
      if (people && person && !exempt.has(person) && (persons.get(person) ?? 0) >= personMax) continue;
      const clubs = teamKeys(record).filter((key) => !exempt.has(key));
      if (people && clubs.some((key) => teams.has(key))) continue;
      picked.push(record);
      seen.add(record.recordId);
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
      if (sport) counts.set(sport, (counts.get(sport) ?? 0) + 1);
      if (person) persons.set(person, (persons.get(person) ?? 0) + 1);
      for (const key of clubs) teams.add(key);
    }
    return picked;
  };
  const want = Math.min(minimum, n, new Set(ordered.map((r) => r.recordId)).size);
  let list = pick(maxPer, true);
  if (list.length >= want) return list;
  list = pick(maxPer, false);
  for (let cap = maxPer + 1; list.length < want && cap <= maxPer + 4; cap += 1) list = pick(cap, false);
  return list.length >= want ? list : pick(null, false);
}

/** `rankRecords` over the facts a default sentence can say (no name-and-year stubs, no Joseon-era general). `options` as a number is `maxPer`. */
export function rankFeed(records: readonly OnThisDayRecord[], n: number, options: number | RankOptions = {}): OnThisDayRecord[] {
  return rankRecords(records.filter(isRichFact), n, typeof options === "number" ? { maxPer: options } : options);
}

/** A calendar day's list: `rankRecords` with at most three facts of one sport. The Pages day shards are `rankDay(facts, 12)`. */
export function rankDay(records: readonly OnThisDayRecord[], n = 12): OnThisDayRecord[] {
  return rankRecords(records, n, DAY_LIST);
}

/** The facts worth keeping for one calendar day when only a few can be kept: the head of that day's ranking, three to five long. */
export function bestOfDay(records: readonly OnThisDayRecord[]): OnThisDayRecord[] {
  return rankFeed(records, 5, DAY_LIST).filter((record, index) => index < 4 || significance(record) >= 85);
}

/**
 * Pick `n` facts after applying filters. The same seed always yields the same rows.
 * Each fact is counted once. Caps at two records per history tag and per competition.
 * A multi-tag fact is skipped if any of its tags is already at the cap.
 */
export function randomFacts(records: readonly OnThisDayRecord[], n: number, filters: FactFilters = {}, seed: string): OnThisDayRecord[] {
  if (!seed) throw new RangeError("randomFacts requires an explicit seed");
  const pool = shuffleWithSeed(factsFor(records, filters).filter(isRichFact), seed);
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
