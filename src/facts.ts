import { isDate, monthDayOf } from "./dates.ts";
import type { FactFilters, OnThisDayRecord, TeamRef } from "./schema.ts";
import { captionFromFact, isRichFact } from "./sentences.ts";
import { countriesOf, derivedTags, isNamespaced } from "./tags.ts";

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

/**
 * Every tag of a fact: the primary extract family, then the history tags and the namespaced tags the fact carries (`country:RO`, `sport:handball`,
 * `decade:1960s`, ...), then any namespaced tag its fields give that it does not carry yet. Unique, in that order.
 * @param record - A fact.
 * @returns Every tag of the fact, without repeats.
 * @example
 * ```ts
 * import { tagsOf } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(tagsOf(offline[0]!).length > 0);
 * ```
 */
export function tagsOf(record: OnThisDayRecord): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [record.category, ...(record.tags ?? []), ...derivedTags(record)]) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * The kind of fact: the primary family and the history tags, without the namespaced tags. Ranking caps count these (two of one kind in a list), never a country or a decade.
 * @param record - A fact.
 * @returns The kind tags of the fact: its primary family and its history tags.
 * @example
 * ```ts
 * import { kindTagsOf } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(kindTagsOf(offline[0]!));
 * ```
 */
export function kindTagsOf(record: OnThisDayRecord): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [record.category, ...(record.tags ?? [])]) {
    if (!tag || isNamespaced(tag) || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

function matches(record: OnThisDayRecord, filters: FactFilters): boolean {
  if (filters.sport && sportSlug(record.sport) !== sportSlug(filters.sport) && !(record.sport === filters.sport)) return false;
  // A person who played in several leagues (Gordie Howe: NHL and WHA) has no one league on his fact but belongs to each of them.
  if (filters.league && record.league !== filters.league && !(record.person?.leagueCodes ?? []).includes(filters.league)) return false;
  if (filters.competition && record.competition !== filters.competition && record.league !== filters.competition) return false;
  if (filters.category && !tagsOf(record).includes(filters.category)) return false;
  if (filters.country) {
    const code = filters.country;
    const hit = countriesOf(record).includes(code) || record.home?.countryCode === code || record.away?.countryCode === code || record.venueCountry === code;
    if (!hit) return false;
  }
  if (filters.host && !(record.hostCountries ?? []).includes(filters.host)) return false;
  if (filters.birthCountry && record.birthCountry !== filters.birthCountry) return false;
  if (filters.tags?.length) {
    const have = new Set(tagsOf(record));
    if (!filters.tags.every((tag) => have.has(tag))) return false;
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

/**
 * Filter on-this-day facts. Multiple filters intersect. The input order is kept.
 * @param records - Facts to filter.
 * @param filters - A date, a sport, a league, a category or the other filters; all of them must hold.
 * @returns The matching facts in their original order, each once.
 * @example
 * ```ts
 * import { factsFor } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(factsFor(offline, { date: "10-20" }).length > 0);
 * ```
 */
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
 * @param timeZone - An IANA time zone such as `America/Toronto`.
 * @param nowIso - An ISO instant, given by the caller: the package never reads the clock.
 * @returns The month and day as `MM-DD`.
 * @example
 * ```ts
 * import { calendarDayInZone } from "@johnmorrisdotca/meigen-sports";
 * console.log(calendarDayInZone("Asia/Tokyo", "2026-10-20T20:00:00Z"));
 * ```
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

/**
 * Facts whose calendar day matches `nowIso` in `timeZone`, then any other filters.
 * @param records - Facts to choose from.
 * @param timeZone - An IANA time zone.
 * @param nowIso - An ISO instant, given by the caller.
 * @param filters - Other filters.
 * @returns The facts of that calendar day.
 * @example
 * ```ts
 * import { today } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(today(offline, "America/Toronto", "2026-10-20T15:00:00Z").length > 0);
 * ```
 */
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

/**
 * Whether every fact in a list has its own id.
 * @param records - Facts to check.
 * @returns `true` when no id appears twice.
 * @example
 * ```ts
 * import { uniqueRecordIds } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(uniqueRecordIds(offline));
 * ```
 */
export function uniqueRecordIds(records: readonly OnThisDayRecord[]): boolean {
  const ids = records.map((record) => record.recordId);
  return new Set(ids).size === ids.length;
}

/**
 * The significance from which a fact is a legend: the caps of a list never hold it back, only the list's own length does.
 * @example
 * ```ts
 * import { LEGEND, significance } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(offline.filter((record) => significance(record) >= LEGEND).length > 0);
 * ```
 */
export const LEGEND = 85;

/** The significance from which a sixth fact or a later one joins a day's best: a fame that fills the day. */
const LEGEND_FULL = 90;

/** Leagues whose games count for less in `significance`: minor, college and developmental ones. */
const MINOR_LEAGUES: ReadonlySet<string> = new Set(["ahl", "echl", "ncaaf", "pwhl", "nwsl"]);

/** What a place on the fame list adds to a person's significance: 50 for the first hundred, 45 to 300, 38 to 700, 28 to 1,200, 18 after that. */
function fameBonus(fameRank: number): number {
  return fameRank <= 100 ? 50 : fameRank <= 300 ? 45 : fameRank <= 700 ? 38 : fameRank <= 1200 ? 28 : 18;
}

/**
 * How much a fact is worth showing: finals, famous people and playoff drama above routine results. A pure function of the fact's fields.
 * @param record - A fact.
 * @returns A number that is higher for finals, famous people and playoff drama.
 * @example
 * ```ts
 * import { significance } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(typeof significance(offline[0]!));
 * ```
 */
export function significance(record: OnThisDayRecord): number {
  const tags = new Set(kindTagsOf(record));
  const reasons = new Set(record.featuredReasons ?? []);
  if (tags.has("sport-record") || tags.has("career-stat-milestone") || reasons.has("record")) return 100;
  switch (record.category) {
    case "championship-final": return 95 + (tags.has("shutout") ? 3 : 0);
    case "award": return 90;
    case "soccer-on-day": return 70 + (/^final$/i.test(record.stage ?? "") ? 35 : /semi/i.test(record.stage ?? "") ? 20 : /quarter/i.test(record.stage ?? "") ? 10 : 0);
    case "venue-opening": return 100;
    // An event or a competition edition: by the editions of its page, as a person is. A winner named adds a little: the fact says who.
    case "competition-start":
    case "competition-end":
    case "sport-event": {
      const editions = record.sitelinks ?? 0;
      return 30 + (editions >= 100 ? 75 : editions >= 80 ? 70 : editions >= 50 ? 55 : editions >= 30 ? 24 : editions >= 20 ? 14 : editions >= 10 ? 6 : 0) + (record.winnerName ? 6 : 0);
    }
    case "franchise-event": return 45;
    // A retired number: a league-wide retirement is a league's act; a club's counts for more when the person is known in other languages.
    // An All-Star Game: a league's showpiece, but below a final or a famous person.
    case "all-star": return 44 + ((record.league === "mlb" || record.league === "nba" || record.league === "nhl") ? 4 : 0);
    // A player's own feat is below an All-Star Game: a 500th goal, more than five goals or more than 80 points count for more.
    case "player-feat": return 34 + (record.featKind === "career-goals" ? 8 : record.featKind === "points-in-game" ? ((record.featAmount ?? 0) >= 100 ? 14 : (record.featAmount ?? 0) >= 80 ? 8 : 0) : (record.featAmount ?? 0) >= 6 ? 6 : 0);
    // A no-hitter is rare; a perfect game rarer.
    case "game-feat": return 38 + (record.feat === "perfect-game" ? 10 : 0) + (record.phase === "world-series" ? 4 : 0);
    case "retired-number": return 38 + (record.leagueWide ? 12 : 0) + ((record.sitelinks ?? 0) >= 20 ? 6 : 0) + ((record.sitelinks ?? 0) >= 50 ? 8 : 0);
    case "player-birthday":
    case "player-death": {
      let score = 30;
      // A place on the fame list of 2,000 people (1 is the most famous in the world) adds more the nearer the top; a fact made before the list was ranked adds the flat 45.
      if (record.fameRank != null) score += fameBonus(record.fameRank);
      else if (record.priorityAthlete) score += 45;
      if (record.personAward) score += 30;
      if (record.hallOfFameYear) score += 25;
      // The number of individual awards he won himself: a long list of them is fame that one flagship award is not.
      score += (record.awardCount ?? 0) >= 10 ? 15 : (record.awardCount ?? 0) >= 5 ? 8 : 0;
      if (record.highlight) score += 10;
      if ((record.championships ?? 0) > 0) score += 10;
      if ((record.championships ?? 0) >= 3) score += 6;
      // A club that retired his number has named him a legend, whatever the number of Wikipedia editions of a league the world follows less.
      if (record.jerseyRetired) score += 20;
      // Editions of the person's Wikipedia page are the one fame every sport shares: a name known in fifty languages outranks a long list of club honours,
      // and one known in a hundred is known everywhere.
      const editions = record.sitelinks ?? 0;
      score += editions >= 100 ? 75 : editions >= 80 ? 65 : editions >= 50 ? 55 : editions >= 30 ? 28 : editions >= 20 ? 15 : 0;
      if (record.category === "player-death") score += 5;
      return score;
    }
    default: {
      // A game of a minor, college or developmental league counts for less than the same game of a major one, so a playoff shutout of the AHL does not outrank a famous venue's opening.
      let score = MINOR_LEAGUES.has(record.league ?? "") ? 0 : 20;
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

/**
 * How a ranked list is chosen. Every cap names what it counts: a tag (`championship-win`), a competition (`competition:nhl`), a person (`p:12`) or a club (`f:3`).
 * @example
 * ```ts
 * import type { RankOptions } from "@johnmorrisdotca/meigen-sports";
 * const options: RankOptions = { maxPer: 2, personMax: 1, minimum: 3 };
 * console.log(options.maxPer);
 * ```
 */
export interface RankOptions {
  /** Most facts of one tag, and of one competition, in the list. Default 2. */
  readonly maxPer?: number;
  /** Most facts about one person. Default 1. A club is never listed twice while another choice is left. */
  readonly personMax?: number;
  /** The list's fewest facts, when the day or the feed has that many: caps and the one-person rule relax, in that order, to reach it. Default 3. */
  readonly minimum?: number;
  /** Most facts of one sport in the list (no cap when left out). Relaxed together with `maxPer`, so a quiet day still reaches its minimum. */
  readonly maxPerSport?: number;
  /** A legend (`LEGEND`) is held back by no cap, only by the list's own length: for a short list where a place is scarce (a day's list, the offline set, a pick). A deep feed about one thing keeps its caps, so it stays varied. */
  readonly keepLegends?: boolean;
  /** Keys the list is already about (a tag feed's tag, a league feed's league, a team feed's club, `sport:<sport>`): they are not counted. */
  readonly exempt?: readonly string[];
}

/** How a calendar day's list is chosen: at most three facts of one sport, so a day is not all baseball or all basketball. */
const DAY_LIST: RankOptions = { maxPerSport: 3, keepLegends: true };

/**
 * Rank facts by `significance` and take the first `n` that keep to the caps, with no repeated fact. The same input always gives the
 * same list, and a list of `n` is the head of a longer list of the same facts. Facts are used as given: nothing is dropped for wording.
 * @param records - Facts to rank.
 * @param n - How many to take.
 * @param options - The caps.
 * @returns Up to `n` facts, the same list every time for the same input.
 * @example
 * ```ts
 * import { rankRecords } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(rankRecords(offline, 3).length);
 * ```
 */
export function rankRecords(records: readonly OnThisDayRecord[], n: number, options: RankOptions = {}): OnThisDayRecord[] {
  const maxPer = options.maxPer ?? 2, personMax = options.personMax ?? 1, minimum = options.minimum ?? 3;
  const exempt = new Set(options.exempt ?? []);
  // Equal significance: the better known first (more Wikipedia editions), then the more recent (a reader knows the 2022 final better than the 1932 championship), then by id.
  const scores = new Map<string, number>();
  const ordered = records.map((record) => { const score = significance(record); scores.set(record.recordId, score); return { record, score }; }).sort((a, b) =>
    b.score - a.score || (b.record.sitelinks ?? 0) - (a.record.sitelinks ?? 0) || `${b.record.eventDate ?? ""}\t${a.record.recordId}`.localeCompare(`${a.record.eventDate ?? ""}\t${b.record.recordId}`)).map((item) => item.record);
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
      const keys = [...kindTagsOf(record), `competition:${competitionKey(record)}`].filter((key) => !exempt.has(key));
      // The caps keep a list varied; a legend (a fact of the top fame) is never held back by them, only by the list's own length.
      const legend = scores.get(record.recordId)! >= LEGEND;
      const bypass = legend && options.keepLegends === true;
      if (!bypass && cap !== null && keys.some((key) => (counts.get(key) ?? 0) >= cap)) continue;
      const sport = record.sport && !exempt.has(`sport:${record.sport}`) ? `sport:${record.sport}` : null;
      if (!bypass && sportCap !== null && sport && (counts.get(sport) ?? 0) >= sportCap) continue;
      const person = personKey(record);
      if (people && person && !exempt.has(person) && (persons.get(person) ?? 0) >= personMax + (bypass ? 1 : 0)) continue;
      const clubs = teamKeys(record).filter((key) => !exempt.has(key));
      if (people && !legend && clubs.some((key) => teams.has(key))) continue;
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

/**
 * `rankRecords` over the facts a default sentence can say (no name-and-year stubs, no Joseon-era general). `options` as a number is `maxPer`.
 * @param records - Facts to rank.
 * @param n - How many to take.
 * @param options - The caps, or a number for `maxPer`.
 * @returns Up to `n` facts a default sentence can say.
 * @example
 * ```ts
 * import { rankFeed } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(rankFeed(offline, 3).length);
 * ```
 */
export function rankFeed(records: readonly OnThisDayRecord[], n: number, options: number | RankOptions = {}): OnThisDayRecord[] {
  return rankRecords(records.filter(isRichFact), n, typeof options === "number" ? { maxPer: options } : options);
}

/**
 * A calendar day's list: `rankRecords` with at most three facts of one sport. The Pages day shards are `rankDay(facts, 16)`.
 * @param records - A day's facts.
 * @param n - How many to take (12 by default).
 * @returns The day's list, at most three facts of one sport.
 * @example
 * ```ts
 * import { rankDay } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(rankDay(offline, 5).length);
 * ```
 */
export function rankDay(records: readonly OnThisDayRecord[], n = 12): OnThisDayRecord[] {
  return rankRecords(records, n, DAY_LIST);
}

/**
 * The facts worth keeping for one calendar day when only a few can be kept: the head of that day's ranking, three to eight long.
 * @param records - A day's facts.
 * @returns The three to eight facts worth keeping for that day.
 * @example
 * ```ts
 * import { bestOfDay } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(bestOfDay(offline.filter((record) => record.eventDate?.endsWith("-10-20"))).length);
 * ```
 */
export function bestOfDay(records: readonly OnThisDayRecord[]): OnThisDayRecord[] {
  return rankFeed(records, 8, DAY_LIST).filter((record, index) => index < 4 || significance(record) >= (index < 5 ? 85 : LEGEND_FULL));
}

/**
 * Pick `n` facts after applying filters. The same seed always yields the same rows.
 * Each fact is counted once. Caps at two records per history tag and per competition.
 * A multi-tag fact is skipped if any of its tags is already at the cap.
 * @param records - Facts to choose from.
 * @param n - How many to take.
 * @param filters - Filters applied first.
 * @param seed - A seed: the same seed always gives the same facts.
 * @returns Up to `n` facts, shuffled by the seed.
 * @example
 * ```ts
 * import { randomFacts } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(randomFacts(offline, 3, {}, "card").length);
 * ```
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
    const tags = kindTagsOf(record);
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

/**
 * How a pick is made: `ranked` takes the most famous, `random` a seeded draw from the whole pool, `mixed` the most famous `fixed` of them and a seeded draw for the rest.
 * @example
 * ```ts
 * import type { PickMode } from "@johnmorrisdotca/meigen-sports";
 * const mode: PickMode = "mixed";
 * console.log(mode);
 * ```
 */
export type PickMode = "ranked" | "random" | "mixed";

/**
 * The modes `pickFacts` knows, in the order a picker lists them.
 * @example
 * ```ts
 * import { PICK_MODES } from "@johnmorrisdotca/meigen-sports";
 * console.log(PICK_MODES.join(", "));
 * ```
 */
export const PICK_MODES: readonly PickMode[] = ["ranked", "random", "mixed"];

/**
 * What `pickFacts` is asked for.
 * @example
 * ```ts
 * import type { PickOptions } from "@johnmorrisdotca/meigen-sports";
 * const options: PickOptions = { date: "2026-11-03", filters: { league: "nhl" }, n: 5, mode: "mixed", fixed: 2, seed: "morning" };
 * console.log(options.n);
 * ```
 */
export interface PickOptions {
  /** The day: `YYYY-MM-DD` or `MM-DD`. Left out, every day of the records is in the pool. */
  readonly date?: string;
  /** Narrow the pool first (a sport, a league, a club, a person, a country ...); the pick is ranked within what is left. */
  readonly filters?: FactFilters;
  /** How many facts. Default 5. */
  readonly n?: number;
  /** Default `ranked`. */
  readonly mode?: PickMode;
  /** `mixed` only: how many of the `n` are the most famous, the same every time. Default half of `n`, rounded up. */
  readonly fixed?: number;
  /** `random` and `mixed`: the same seed gives the same facts. The package never reads a clock or a random number, so the caller makes a new seed for a fresh pick. */
  readonly seed?: string;
}

/**
 * Pick the facts of a day or of a filter. The pool is narrowed by the filters first and ranked after, so a fact far down the overall ranking
 * (a CFL legend, a club's own hero) comes out on top of its narrow filter. `ranked` is the head of that ranking, `random` a seeded draw
 * from the whole pool, `mixed` the `fixed` most famous and a seeded draw for the rest. The same input and seed always give the same facts.
 * @param records - Facts to pick from: the offline set, or a day's facts from the Pages feeds.
 * @param options - The day, the filters, how many, the mode, how many are fixed and the seed.
 * @returns Up to `n` facts, the famous ones first.
 * @example
 * ```ts
 * import { pickFacts } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * const famous = pickFacts(offline, { date: "2026-07-07", filters: { league: "nhl" }, n: 3 });
 * const mixed = pickFacts(offline, { date: "2026-07-07", n: 5, mode: "mixed", fixed: 2, seed: "morning" });
 * console.log(famous.length, mixed.length);
 * ```
 */
export function pickFacts(records: readonly OnThisDayRecord[], options: PickOptions = {}): OnThisDayRecord[] {
  const n = options.n ?? 5, mode = options.mode ?? "ranked", filters = options.filters ?? {};
  if (!Number.isInteger(n) || n < 0) throw new RangeError("Expected n to be a whole number from zero");
  if (!PICK_MODES.includes(mode)) throw new RangeError(`Expected a mode of ${PICK_MODES.join(", ")}`);
  const fixed = mode === "mixed" ? options.fixed ?? Math.ceil(n / 2) : 0;
  if (!Number.isInteger(fixed) || fixed < 0 || fixed > n) throw new RangeError("Expected fixed to be a whole number from zero to n");
  if (mode !== "ranked" && !options.seed) throw new RangeError(`pickFacts in ${mode} mode requires an explicit seed`);
  // In one fixed order, so the same seed picks the same facts however the caller's records are ordered.
  const pool = factsFor(records, options.date ? { ...filters, date: options.date } : filters).filter(isRichFact).sort((a, b) => a.recordId.localeCompare(b.recordId));
  // What the pool is already about is not capped: a league's pick may hold several facts of that league, a sport's several of that sport, a club's several of its own.
  const exempt: string[] = [
    ...(filters.league ? [`competition:${filters.league}`] : []),
    ...(filters.competition ? [`competition:${filters.competition}`] : []),
    ...(filters.sport ? [`sport:${filters.sport}`] : []),
    ...(filters.team?.franchiseId != null ? [`f:${filters.team.franchiseId}`] : []),
  ];
  const filtered = Object.keys(filters).length > 0;
  const sports = new Set(pool.map((record) => record.sport));
  if (sports.size === 1 && pool[0]?.sport) exempt.push(`sport:${pool[0].sport}`);
  const head = (count: number, among: readonly OnThisDayRecord[]): OnThisDayRecord[] => rankRecords(among, count, { ...DAY_LIST, exempt, minimum: filtered ? count : Math.min(3, count) });
  if (mode === "ranked") return head(n, pool);
  if (mode === "random") return randomFacts(pool, n, {}, options.seed!);
  const top = head(fixed, pool);
  const chosen = new Set(top.map((record) => record.recordId));
  return [...top, ...randomFacts(pool.filter((record) => !chosen.has(record.recordId)), n - top.length, {}, options.seed!)];
}

/**
 * A fact with its English and Japanese caption filled in where it had none.
 * @param record - A fact.
 * @returns The same fact with `text` and `textJa`.
 * @example
 * ```ts
 * import { withCaptions } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(typeof withCaptions(offline[0]!).text);
 * ```
 */
export function withCaptions(record: OnThisDayRecord): OnThisDayRecord {
  const text = record.text ?? captionFromFact(record, "en") ?? undefined;
  const textJa = record.textJa ?? captionFromFact(record, "ja") ?? undefined;
  return { ...record, ...(text ? { text } : {}), ...(textJa ? { textJa } : {}) };
}

export { sportSlug };
