import type { OnThisDayRecord } from "./schema.ts";

/**
 * Every tag a fact can carry, built from the fields the fact already holds. A tag is `namespace:value` ("country:RO", "sport:handball",
 * "decade:1960s"); the history types (`player-birthday`, `championship-win`) have no colon and are the kind of fact. Nothing is guessed: a tag
 * exists only where a field says it. Never a tag for sex or gender, ethnicity, religion, politics, family or health: no field holds them, and
 * `test/tags.test.ts` holds the vocabulary to that.
 */
export const TAG_NAMESPACES = [
  "sport", "league", "competition", "series", "country", "host", "birthcountry", "team", "person", "position", "venue", "decade", "century",
  "phase", "stage", "award", "title", "honour", "source", "date",
] as const;
export type TagNamespace = (typeof TAG_NAMESPACES)[number];

/** A tag with a namespace: lower-case letters and hyphens, a colon, then letters, digits, hyphens, dots and underscores. */
export const NAMESPACED_TAG = /^[a-z][a-z-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** A history type, or a namespaced tag. */
export const VALID_TAG = /^[a-z][a-z0-9-]*(?::[A-Za-z0-9][A-Za-z0-9._-]*)?$/;

/** The words a name becomes in an id: "Hart Memorial Trophy" is `hart-memorial-trophy`. */
export function slugOf(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** True for a tag that has a namespace ("country:RO"): such a tag says what a fact is about, not what kind of fact it is. */
export const isNamespaced = (tag: string): boolean => tag.includes(":");

/** The year a fact is dated to, for its decade and century. */
function yearOf(record: OnThisDayRecord): number | null {
  if (record.eventDate && /^\d{4}-/.test(record.eventDate)) return Number(record.eventDate.slice(0, 4));
  if (record.draftYear) return record.draftYear;
  if (record.seasonStartYear) return record.seasonStartYear;
  return null;
}

function add(out: string[], seen: Set<string>, namespace: TagNamespace, value: string | number | null | undefined): void {
  if (value === null || value === undefined) return;
  const text = String(value).trim();
  if (!text) return;
  const tag = `${namespace}:${text}`;
  if (!NAMESPACED_TAG.test(tag) || seen.has(tag)) return;
  seen.add(tag);
  out.push(tag);
}

const SERIES: readonly (readonly [string, RegExp])[] = [
  ["olympics", /\bOlympic(?:s| Games)?\b/i],
  ["world-cup", /\bWorld Cup\b/i],
  ["world-championships", /\bWorld Championships?\b/i],
];

/** The countries of the people and the teams a fact is about: the stored `countries`, else the teams' country codes, else the person's nationality. Codes are ISO 3166-1 alpha-2, or ISO 3166-3 for a former country. */
export function countriesOf(record: OnThisDayRecord): string[] {
  if (record.countries?.length) return [...new Set(record.countries)];
  const teams = [record.home?.countryCode, record.away?.countryCode].filter((code): code is string => Boolean(code));
  if (teams.length) return [...new Set(teams)];
  return record.nationality ? [record.nationality] : [];
}

/**
 * The flag a fact may show, by the code a flag set keys its flags by ("US", "GB-ENG", "SUHH"), only when it is unambiguous: one person of one country, or two teams of one country.
 * `null` when the fact is about two countries, a country with no flag, a person of two countries, or no country at all. A flag is never guessed.
 */
export function flagOf(record: OnThisDayRecord): string | null {
  if (record.flag) return record.flag;
  const flags = [record.home?.flagCode, record.away?.flagCode];
  if (record.home || record.away) {
    const set = new Set(flags);
    return set.size === 1 && flags[0] ? flags[0] : null;
  }
  return null;
}

/** Every namespaced tag the fact's own fields give, in a fixed order, without repeats. */
export function derivedTags(record: OnThisDayRecord): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  add(out, seen, "sport", record.sport);
  add(out, seen, "league", record.league);
  if (record.competition && record.competition !== record.league) add(out, seen, "competition", record.competition);
  const label = `${record.eventLabel ?? ""} ${record.competition ?? ""} ${record.awardName ?? ""}`;
  for (const [id, pattern] of SERIES) if (pattern.test(label) || (id === "world-cup" && (record.league === "wc" || record.league === "wwc"))) add(out, seen, "series", id);
  for (const code of countriesOf(record)) add(out, seen, "country", code);
  for (const code of record.hostCountries ?? []) add(out, seen, "host", code);
  add(out, seen, "birthcountry", record.birthCountry);
  for (const team of [record.home, record.away]) {
    if (team?.franchiseId != null) add(out, seen, "team", `f${team.franchiseId}`);
    else if (team?.soccerTeamId) add(out, seen, "team", team.soccerTeamId);
  }
  for (const id of record.person?.franchiseIds ?? []) add(out, seen, "team", `f${id}`);
  if (record.person) add(out, seen, "person", record.person.qid ?? (record.person.personId != null ? `p${record.person.personId}` : null));
  add(out, seen, "position", record.position);
  add(out, seen, "venue", record.venueId);
  const year = yearOf(record);
  if (year !== null) {
    add(out, seen, "decade", `${Math.floor(year / 10) * 10}s`);
    add(out, seen, "century", Math.floor((year - 1) / 100) + 1);
  }
  add(out, seen, "phase", record.phase);
  add(out, seen, "stage", record.stage);
  for (const award of record.awards ?? []) add(out, seen, "award", award);
  if (record.category === "award" && record.awardName) add(out, seen, "award", slugOf(record.awardName));
  if ((record.championships ?? 0) > 0 && record.championshipName) add(out, seen, "title", slugOf(record.championshipName));
  if (record.awards?.length) add(out, seen, "honour", "award-winner");
  if ((record.championships ?? 0) > 0) add(out, seen, "honour", "champion");
  if (record.hallOfFameYear) add(out, seen, "honour", "hall-of-fame");
  add(out, seen, "source", record.source?.sourceId);
  // Wikidata itself disagrees about a date of this fact (`dateAlternatives`): `date:disputed`.
  if (record.dateDisputed) add(out, seen, "date", "disputed");
  return out;
}

/** The namespaces of a list of tags, for a caller that wants "the countries of this fact". */
export function tagValues(tags: readonly string[], namespace: TagNamespace): string[] {
  const prefix = `${namespace}:`;
  return tags.filter((tag) => tag.startsWith(prefix)).map((tag) => tag.slice(prefix.length));
}
