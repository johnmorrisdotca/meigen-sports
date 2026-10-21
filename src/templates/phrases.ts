import type { TemplateLocale } from "./types.ts";

/**
 * Sentence fragments the templates slot in (`{ot}`, `{gameNo}`, `{homeClause}` ...).
 * Nothing in `render.ts` writes English or Japanese words of its own: every phrase that reaches a
 * reader is a row here or a row in `catalog.ts`. A fragment may list several alternates; the first
 * is the default (`wording: "fixed"`), the others are chosen by seed for `seeded` / `varied`.
 * `{0}`, `{1}` ... are filled from the arguments.
 */
export type FragmentId =
  | "clubPosition" | "seriesSweepScore" | "seriesGamesScore" | "seriesSweeping" | "seriesBeating" | "seriesSwept" | "seriesBeat"
  | "clincher" | "clincherAn" | "titleNumber" | "regularSeason"
  | "context" | "overtime" | "shootout" | "stage" | "venueAt" | "venueCityAt" | "gameNumber" | "seriesWin"
  | "aged" | "diedParen" | "previousHolder" | "overallPick" | "clubBy" | "cityIn" | "homeOf"
  | "hosted" | "extraTime" | "penaltiesAfterDraw" | "penaltiesAfterExtraTime" | "penaltyShootout"
  | "roundPart" | "articleCap" | "article" | "join" | "whoPlain" | "whoThe" | "whoTheAnd" | "whoOf" | "whoOfAnd" | "whoParen" | "result"
  | "onDate" | "inDate" | "aroundDate" | "leadOnDate" | "leadInDate" | "leadAroundDate"
  | "placeIn" | "placeAt" | "wonBy" | "wonByTitle"
  | "noteDate" | "noteBirth" | "noteDeath" | "noteAge" | "listLast" | "ageUnit" | "ageOr"
  | "recordSet" | "recordHeld" | "recordEqualled" | "recordSurpassed" | "recordSetBy" | "recordHeldBy" | "recordEqualledBy" | "recordBrokenBy";

type Table = Record<FragmentId, { readonly en: readonly string[]; readonly ja: readonly string[] }>;

export const FRAGMENTS: Table = {
  clubPosition: { en: ["{0} {1}"], ja: ["{0}の{1}"] },
  seriesSweepScore: { en: ["{0}\u2013{1}"], ja: ["{0}勝{1}敗"] },
  seriesGamesScore: { en: ["{0} games to {1}"], ja: ["{0}勝{1}敗"] },
  seriesSweeping: { en: ["sweeping"], ja: [""] },
  seriesBeating: { en: ["beating"], ja: [""] },
  seriesSwept: { en: ["swept"], ja: [""] },
  seriesBeat: { en: ["beat"], ja: [""] },
  clincher: { en: [" with a {0}\u2013{1} win in Game {2}"], ja: ["（第{2}戦は{0}対{1}）"] },
  clincherAn: { en: [" with an {0}\u2013{1} win in Game {2}"], ja: ["（第{2}戦は{0}対{1}）"] },
  titleNumber: { en: [" It was their {0} title.", " That made it their {0} title."], ja: ["。通算{0}度目の優勝"] },
  regularSeason: { en: [" They had finished the regular season {0}.", " Their regular season record was {0}."], ja: ["。レギュラーシーズンの成績は{0}"] },
  context: { en: [" ({0})"], ja: ["（{0}）"] },
  overtime: { en: [" in overtime", " after overtime"], ja: ["（延長）"] },
  extraTime: { en: [" after extra time", " in extra time"], ja: ["（延長）"] },
  shootout: { en: [" in a shootout", " after a shootout"], ja: ["（PK戦）"] },
  stage: { en: [", {0}"], ja: ["（{0}）"] },
  venueAt: { en: [" at {0}"], ja: ["（{0}）"] },
  venueCityAt: { en: [" at {0}, {1}"], ja: ["（{0}、{1}）"] },
  gameNumber: { en: [" in Game {0}"], ja: ["（第{0}戦）"] },
  seriesWin: { en: [" to win the{0} {1}"], ja: ["。シリーズ{1}で{0}を制した"] },
  aged: { en: [", aged {0}", " at the age of {0}"], ja: ["{0}歳で"] },
  diedParen: { en: [" (died {0})"], ja: ["（{0}年死去）"] },
  previousHolder: { en: [" Previous holder: {0}.", " The previous holder was {0}."], ja: ["。それ以前は{0}"] },
  overallPick: { en: [" No. {0} overall", " as the No. {0} pick"], ja: ["全体{0}位で"] },
  clubBy: { en: [" by the {0}"], ja: ["{0}に"] },
  cityIn: { en: [" in {0}"], ja: ["（{0}）"] },
  homeOf: { en: ["; home of the {0}", ", the home of the {0}"], ja: ["。{0}の本拠地"] },
  hosted: { en: ["; it hosted {0}"], ja: ["。{0}を開催"] },
  penaltiesAfterDraw: { en: [" on penalties after a {0} draw"], ja: ["（PK戦、{0}の引き分け後）"] },
  penaltiesAfterExtraTime: { en: [" on penalties after extra time"], ja: ["（延長の後、PK戦）"] },
  penaltyShootout: { en: [" on penalties"], ja: ["（PK戦）"] },
  roundPart: { en: [", {0}"], ja: ["（{0}）"] },
  articleCap: { en: ["The "], ja: [""] },
  article: { en: ["the "], ja: [""] },
  join: { en: [", "], ja: ["、"] },
  whoPlain: { en: [", {0},"], ja: ["（{0}）"] },
  whoThe: { en: [", the {0},"], ja: ["（{0}）"] },
  whoTheAnd: { en: [", the {0} and {1},"], ja: ["（{0}、{1}）"] },
  // A club and no position: "Gregg Popovich, of the San Antonio Spurs,", never "the San Antonio Spurs," (a club is not what he is).
  whoOf: { en: [", of the {0},"], ja: ["（{0}）"] },
  whoOfAnd: { en: [", of the {0}, {1},"], ja: ["（{0}、{1}）"] },
  whoParen: { en: [" ({0})"], ja: ["（{0}）"] },
  result: { en: ["{0}\u2013{1}"], ja: ["{0}対{1}"] },
  // A date said at the precision the source holds. {0} is the date as `formatDate` writes it.
  onDate: { en: ["on {0}"], ja: ["{0}に"] },
  inDate: { en: ["in {0}"], ja: ["{0}に"] },
  aroundDate: { en: ["around {0}"], ja: ["{0}ごろに"] },
  leadOnDate: { en: ["On {0}, "], ja: ["{0}、"] },
  leadInDate: { en: ["In {0}, "], ja: ["{0}、"] },
  leadAroundDate: { en: ["Around {0}, "], ja: ["{0}ごろ、"] },
  // Where an event was held and who won it (events and competition editions).
  placeIn: { en: [" in {0}"], ja: ["（{0}）"] },
  placeAt: { en: [" at {0}"], ja: ["（{0}）"] },
  wonBy: { en: [", won by {0}"], ja: ["勝者は{0}。"] },
  // The winner of a whole competition (a season, a championship): 優勝, where a match or a bout has a 勝者.
  wonByTitle: { en: [", won by {0}"], ja: ["優勝は{0}。"] },
  // The note on a date Wikidata disputes (`dateNote`): one sentence for each disputed date, one for an age the dates leave open. {0} is the list of other days (or ages).
  noteDate: { en: ["Date disputed: Wikidata also gives {0}."], ja: ["日付に諸説あり：Wikidataにはほかに{0}の記載がある。"] },
  noteBirth: { en: ["Birth date disputed: Wikidata also gives {0}."], ja: ["生年月日に諸説あり：Wikidataにはほかに{0}の記載がある。"] },
  noteDeath: { en: ["Death date disputed: Wikidata also gives {0}."], ja: ["没年月日に諸説あり：Wikidataにはほかに{0}の記載がある。"] },
  noteAge: { en: ["The age may also be {0}."], ja: ["年齢は{0}の可能性もある。"] },
  listLast: { en: [" and "], ja: ["、"] },
  ageUnit: { en: ["{0}"], ja: ["{0}歳"] },
  ageOr: { en: [" or "], ja: ["または"] },
  recordSet: { en: ["set"], ja: [""] },
  recordHeld: { en: ["held"], ja: [""] },
  recordEqualled: { en: ["equalled"], ja: [""] },
  recordSurpassed: { en: ["surpassed"], ja: [""] },
  recordSetBy: { en: ["set by"], ja: [""] },
  recordHeldBy: { en: ["held by"], ja: [""] },
  recordEqualledBy: { en: ["equalled by"], ja: [""] },
  recordBrokenBy: { en: ["broken by"], ja: [""] },
};

/**
 * Alternates for a sport that does not play "overtime". Index 0 stays " in overtime" so a published default sentence
 * never changes; `seeded` and `varied` wording may pick the sport's own word.
 */
export const OVERTIME_BY_SPORT: Readonly<Record<string, { readonly en: readonly string[]; readonly ja: readonly string[] }>> = {
  soccer: { en: [" in overtime", " after extra time", " in extra time"], ja: ["（延長）"] },
  baseball: { en: [" in overtime", " in extra innings", " after extra innings"], ja: ["（延長）"] },
  softball: { en: [" in overtime", " in extra innings", " after extra innings"], ja: ["（延長）"] },
};

/** "1st", "2nd", "5th" in English; the bare number in Japanese, whose sentence adds its own counter. */
export function ordinal(n: number, locale: TemplateLocale): string {
  if (locale === "ja") return String(n);
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? ORDINAL_SUFFIX[0] : (ORDINAL_SUFFIX[n % 10] ?? ORDINAL_SUFFIX[0]);
  return `${n}${suffix}`;
}
const ORDINAL_SUFFIX: readonly string[] = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"];

/** Fill `{0}`, `{1}` in a fragment. A missing argument becomes the empty string, never "undefined". */
export function fill(format: string, args: readonly string[]): string {
  return format.replace(/\{(\d)\}/g, (_, index: string) => args[Number(index)] ?? "");
}

/**
 * One fragment, filled. `choose` returns an index in `[0, count)`; the caller supplies it so the library never
 * reads the clock or a random number. `fixed` wording passes `() => 0`.
 */
export function phrase(
  id: FragmentId,
  locale: TemplateLocale,
  args: readonly string[],
  choose: (count: number) => number,
  override?: { readonly en: readonly string[]; readonly ja: readonly string[] },
): string {
  const options = (override ?? FRAGMENTS[id])[locale];
  const format = options[choose(options.length) % options.length] ?? options[0] ?? "";
  return fill(format, args);
}

const MONTHS_EN: readonly string[] = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
];

/** A date at its precision: "July 4, 1945", "July 1945", "1945" in English; "1945年7月4日", "1945年7月", "1945年" in Japanese. */
export function formatDate(locale: TemplateLocale, year: number, month?: number, day?: number): string {
  if (locale === "ja") return `${year}年${month ? `${month}月` : ""}${month && day ? `${day}日` : ""}`;
  const name = month ? MONTHS_EN[month - 1] : undefined;
  if (!name) return String(year);
  return day ? `${name} ${day}, ${year}` : `${name} ${year}`;
}
