import type { OnThisDayRecord, TeamRef } from "../schema.ts";
import type { MeigenRecord } from "../types.ts";
import { TEMPLATES } from "./catalog.ts";
import { isCareerHighlight, publicClubName } from "./clubs.ts";
import { isDate } from "../dates.ts";
import { cleanLabel, hasPlaceholder, roundJa, stageJa } from "./labels.ts";
import { OVERTIME_BY_SPORT, formatDate, ordinal, phrase } from "./phrases.ts";
import type { FragmentId } from "./phrases.ts";
import { positionName } from "./positions.ts";
import { championshipTitle, isLopsided } from "./titles.ts";
import type {
  RenderedSentence, RenderOptions, SentenceTemplate, TemplateLocale, TemplateType, Wording,
} from "./types.ts";

const LEAGUE_LABEL: Record<string, string> = {
  nhl: "NHL", nba: "NBA", mlb: "MLB", nfl: "NFL", cfl: "CFL", mls: "MLS",
  wc: "World Cup", wwc: "Women's World Cup", afl: "AFL", aafc: "AAFC",
  nha: "NHA", pcha: "PCHA", wchl: "WCHL", wha: "WHA",
};

/** A record's `event` is a closed list; only the four that read as a verb are rendered. */
const RECORD_VERB: Record<string, FragmentId> = {
  set: "recordSet", held: "recordHeld", equalled: "recordEqualled", surpassed: "recordSurpassed",
};
const RECORD_BY: Record<string, FragmentId> = {
  set: "recordSetBy", held: "recordHeldBy", equalled: "recordEqualledBy", surpassed: "recordBrokenBy",
};

/** A place that is a venue, not a town: it is "at" it ("at Wembley Stadium"), where a city or a country is "in" it. */
const VENUE_WORDS = /\b(?:Stadium|Stadion|Stadio|Arena|Circuit|Park|Field|Grounds?|Centre|Center|Gardens?|Dome|Hall|Course|Raceway|Speedway|Velodrome|Coliseum|Pavilion|Gymnasium|Gimnasio|Palacio|Hippodrome|Bowl|Oval|Complex|Autodromo|Autódromo|Ring|Lake|Piste|Pool|Aquatics|Club|Links|Court|Courts|Theatre|Theater|Road|Casino|Hotel|Auditorium|Fairgrounds?|Racecourse|Showgrounds?)\b/i;

function leagueLabel(record: OnThisDayRecord): string {
  const code = record.league ?? record.competition;
  if (!code) return "";
  return LEAGUE_LABEL[code] ?? code.toUpperCase();
}

function teamName(team: TeamRef | undefined): string {
  return cleanLabel(team?.name);
}

function yearOf(record: OnThisDayRecord): string {
  if (record.eventDate && /^\d{4}-/.test(record.eventDate)) return record.eventDate.slice(0, 4);
  if (record.draftYear) return String(record.draftYear);
  if (record.seasonStartYear) return String(record.seasonStartYear);
  if (record.bornYear) return String(record.bornYear);
  return "";
}

function deathYearOf(record: OnThisDayRecord): string {
  const death = record.deathDate ?? "";
  return /^\d{4}/.test(death) ? death.slice(0, 4) : "";
}

/** When a fact happened, as precisely as the record knows it. */
export interface When {
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
  readonly approximate: boolean;
  /** The full day `YYYY-MM-DD`, only when the record knows the day. */
  readonly iso: string | null;
}

/** Categories whose games are really played on January 1; for any other kind a January 1 date is how a source writes "some time that year". */
const REAL_JANUARY_FIRST = new Set(["game-on-day", "soccer-on-day", "championship-final", "upset", "comeback"]);

function whenOfFact(record: OnThisDayRecord): When | null {
  const iso = record.eventDate ?? "";
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const precision = record.datePrecision;
  if (full && isDate(iso) && precision === "day") {
    const yearOnly = iso.endsWith("-01-01") && !isPersonDay(record) && !REAL_JANUARY_FIRST.has(record.category);
    const year = Number(full[1]);
    return yearOnly ? { year, approximate: false, iso: null } : { year, month: Number(full[2]), day: Number(full[3]), approximate: false, iso };
  }
  const monthly = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(iso);
  if (precision === "month" && monthly && Number(monthly[2]) >= 1 && Number(monthly[2]) <= 12) {
    return { year: Number(monthly[1]), month: Number(monthly[2]), approximate: false, iso: null };
  }
  const year = Number(yearOf(record));
  return Number.isInteger(year) && year > 0 ? { year, approximate: precision === "approximate", iso: null } : null;
}

function whenOfHistory(record: MeigenRecord): When | null {
  const iso = record.date ?? "";
  if (!isDate(iso)) return null;
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)), approximate: false, iso };
}

/** The fact's day is the day being shown (same month and day, whatever the year): "today" and "on this day" are true. */
function isOnDay(when: When | null, asOf: string | undefined): boolean {
  return Boolean(when?.iso && asOf && isDate(asOf) && asOf.slice(5) === when.iso.slice(5));
}

/** The four ways a sentence carries its date. On the fact's own day the year is enough and `dateLead` is empty; anywhere else it is the full date. */
function dateFields(
  locale: TemplateLocale, when: When | null, onDay: boolean, say: (id: FragmentId, ...args: string[]) => string,
): Record<string, string> {
  if (!when) return { date: "", dateOn: "", dateLead: "", leadIn: "", theFirst: say("articleCap") };
  const text = formatDate(locale, when.year, when.month, when.day);
  const yearText = formatDate(locale, when.year);
  const on = when.approximate ? say("aroundDate", text) : when.day ? say("onDate", text) : say("inDate", text);
  const lead = when.approximate ? say("leadAroundDate", text) : when.day ? say("leadOnDate", text) : say("leadInDate", text);
  return {
    date: text,
    dateOn: onDay ? say("inDate", yearText) : on,
    dateLead: onDay ? "" : lead,
    leadIn: onDay ? say("leadInDate", yearText) : lead,
    // "The" opens a sentence, "the" follows a date: "On July 4, 1945, the Chicago Bears ...".
    theFirst: onDay ? say("articleCap") : say("article"),
  };
}

/** The date a sentence about this record states, at the precision the record holds ("July 4, 1945", "July 1945", "1945"); null when it holds none. */
export function factDate(record: OnThisDayRecord | MeigenRecord, locale: TemplateLocale = "en"): string | null {
  const when = "kind" in record ? whenOfHistory(record) : whenOfFact(record);
  return when ? formatDate(locale, when.year, when.month, when.day) : null;
}

/** Whether a sentence about this record is worded for the day it is shown on, or for anywhere. Exported so a caller can say which it is. */
export function dayContext(record: OnThisDayRecord | MeigenRecord, asOf: string | undefined): "onThisDay" | "anywhere" {
  const when = "kind" in record ? whenOfHistory(record) : whenOfFact(record);
  return isOnDay(when, asOf) ? "onThisDay" : "anywhere";
}

function factType(record: OnThisDayRecord): TemplateType | null {
  if (record.record) return "record";
  switch (record.category) {
    case "player-birthday": return "birthday";
    case "player-death": return "death";
    case "championship-final": return "final";
    case "game-on-day":
    case "soccer-on-day":
    case "upset":
    case "comeback": {
      const stage = (record.stage ?? record.roundLabel ?? "").toLowerCase();
      if (stage === "final" || stage === "championship") return "final";
      return "game";
    }
    case "award":
    case "milestone":
      return "award";
    case "draft": return "draft";
    case "competition-start": return "competition-start";
    case "competition-end": return "competition-end";
    case "sport-event": return "event-date";
    case "venue-opening": return "venue";
    case "franchise-event": return "franchise";
    case "first": return "first";
    default: return null;
  }
}

/** FNV-1a. The library never reads the clock or a random number: every choice comes from a seed. */
export function hash32(text: string): number {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

function yearsAgoToday(record: OnThisDayRecord, asOf: string | undefined): string {
  if (!asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return "";
  if (record.datePrecision !== "day" || !record.eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(record.eventDate)) return "";
  if (asOf.slice(5) !== record.eventDate.slice(5)) return "";
  const born = Number(record.eventDate.slice(0, 4));
  const now = Number(asOf.slice(0, 4));
  if (!Number.isInteger(born) || !Number.isInteger(now) || now < born) return "";
  const age = now - born;
  return age > 0 ? String(age) : "";
}

/** Picks an alternate for each fragment. `fixed` always takes the first, so a published default sentence never moves. */
type Chooser = (id: FragmentId) => (count: number) => number;

function chooserFor(wording: Wording, seed: string, recordId: string, locale: TemplateLocale): Chooser {
  if (wording === "fixed") return () => () => 0;
  return (id) => (count) => hash32(`${seed}:${recordId}:${locale}:fragment:${id}`) % count;
}

/** What a template needs to know about the thing it describes, whatever its source record looks like. */
export interface Subject {
  readonly type: TemplateType;
  readonly recordId: string;
  readonly fields: Record<string, string>;
  readonly living: boolean;
  readonly deceasedOk: boolean;
  readonly tie: boolean;
  readonly decisive: boolean;
  readonly lopsided: boolean;
  /** A final decided over several games, with the series tally known. */
  readonly series: boolean;
  readonly blocked: boolean;
  /** The fact's day is the day being shown, so wording that says "today" is true. */
  readonly onDay: boolean;
}

/** Clubs of a team sport take "the" (the Chicago Bears); national sides and soccer clubs do not (Argentina, Arsenal). */
function clubArticles(record: OnThisDayRecord, say: (id: FragmentId, ...args: string[]) => string, afterLead: boolean): { theW: string; theL: string } {
  const none = record.sport === "soccer" || record.league === "wc" || record.league === "wwc";
  return none ? { theW: "", theL: "" } : { theW: afterLead ? say("article") : say("articleCap"), theL: say("article") };
}

function isPersonDay(record: OnThisDayRecord): boolean {
  return record.category === "player-birthday" || record.category === "player-death";
}

/** The tally of a final that was a series: games won by the title winner and by the loser, and every game played (a tied game counts here, not as a win). Only when the counts agree with one another. */
function seriesOf(record: OnThisDayRecord): { winnerWins: number; loserWins: number; games: number } | null {
  const w = record.seriesWinnerWins, l = record.seriesLoserWins;
  if (w == null || l == null || !Number.isInteger(w) || !Number.isInteger(l) || w <= l || l < 0) return null;
  const hs = record.homeScore, aws = record.awayScore;
  if (hs == null || aws == null || hs === aws) return null;
  const games = record.seriesGames;
  if (games == null || !Number.isInteger(games) || games < w + l) return null;
  return { winnerWins: w, loserWins: l, games };
}

/** A regular-season record as the league writes it: wins, losses, then ties or overtime losses when the record holds them ("91–71", "11–3–0"). */
function recordLine(r: OnThisDayRecord["winnerRecord"]): string {
  if (!r || !Number.isInteger(r.wins) || !Number.isInteger(r.losses) || r.wins < 0 || r.losses < 0) return "";
  const extra = r.otLosses != null ? r.otLosses : r.ties;
  return [r.wins, r.losses, ...(extra != null && Number.isInteger(extra) && extra >= 0 ? [extra] : [])].join("\u2013");
}

function fieldsOf(
  record: OnThisDayRecord, locale: TemplateLocale, asOf: string | undefined, choose: Chooser, when: When | null, onDay: boolean,
): Record<string, string> {
  const ja = locale === "ja";
  const say = (id: FragmentId, ...args: string[]): string => phrase(id, locale, args, choose(id));
  const name = cleanLabel(record.person?.name);
  const year = yearOf(record);
  const league = leagueLabel(record);
  const home = teamName(record.home);
  const away = teamName(record.away);
  const hs = record.homeScore;
  const aws = record.awayScore;
  const homeWon = hs != null && aws != null && hs > aws;
  const winner = hs != null && aws != null && hs !== aws ? (homeWon ? home : away) : "";
  const loser = hs != null && aws != null && hs !== aws ? (homeWon ? away : home) : "";
  const winScore = hs != null && aws != null && hs !== aws ? String(homeWon ? hs : aws) : "";
  const loseScore = hs != null && aws != null && hs !== aws ? String(homeWon ? aws : hs) : "";
  const dates = dateFields(locale, when, onDay, say);
  // A draft's year is part of its name ("the 1990 NHL draft"), so a year alone adds nothing in front of it.
  if (record.category === "draft" && when && !when.day && !when.month) { dates.dateLead = ""; dates.theFirst = say("articleCap"); }
  // An event's own day says no date, but the year is still said: an edition whose name holds no year ("Channel One Russia began in Moscow") starts "In 1995, ".
  if (onDay && when && (record.category === "competition-start" || record.category === "competition-end" || record.category === "sport-event") && !cleanLabel(record.eventLabel).includes(String(when.year))) {
    dates.dateLead = dates.leadIn;
    dates.theFirst = say("article");
  }
  // The year goes in the parenthesis only when no date leads the sentence.
  const ctxBits = [league, dates.dateLead ? "" : (ja && year ? `${year}年` : year)].filter(Boolean).join(say("join"));
  const ctx = ctxBits ? say("context", ctxBits) : "";
  const sportWords = OVERTIME_BY_SPORT[record.sport ?? ""];
  const ot = record.decidedByShootout ? say("shootout")
    : record.wentToOvertime ? (sportWords ? phrase("overtime", locale, [], choose("overtime"), sportWords) : say("overtime")) : "";
  const stageRaw = cleanLabel(record.stage ?? record.phase ?? record.roundLabel);
  const stage = stageRaw && stageRaw !== "regular" ? say("stage", ja ? stageJa(stageRaw, record.sport) : stageRaw.replaceAll("_", " ")) : "";
  const venueNameClean = cleanLabel(record.venueName);
  const venueCityClean = cleanLabel(record.venueCity);
  const venue = venueNameClean
    ? (venueCityClean ? say("venueCityAt", venueNameClean, venueCityClean) : say("venueAt", venueNameClean))
    : "";
  const gameNo = record.seriesGameNumber ? say("gameNumber", String(record.seriesGameNumber)) : "";
  const clubNamesClean = (record.clubNames ?? []).map(cleanLabel).filter(Boolean);
  const clubNameClean = cleanLabel(record.clubName);
  const clubs = clubNamesClean.join(say("join")) || clubNameClean;
  const club = publicClubName(clubNamesClean, clubNameClean);
  const position = positionName(record.sport, record.position, locale);
  const clubPosition = club && position ? say("clubPosition", club, position) : (club || position);
  // A club with no position is "of the club", not "the club": a club is not a trade.
  const clubOnly = Boolean(club) && !position;
  const honour = cleanLabel(record.highlight) || cleanLabel(record.epithet);
  const birthday = record.category === "player-birthday";
  const career = birthday && honour && isCareerHighlight(honour);
  const whoCore = career ? honour : (clubPosition || honour);
  const who = whoCore ? "who" : "";
  let whoClause = "";
  if (whoCore) {
    if (ja) {
      whoClause = say("whoParen", career ? [clubPosition, honour].filter(Boolean).join(say("join")) : birthday ? (clubPosition || honour) : [clubPosition, honour].filter(Boolean).join(say("join")));
    } else if (career && clubPosition) whoClause = clubOnly ? say("whoOfAnd", club, honour) : say("whoTheAnd", clubPosition, honour);
    else if (career) whoClause = say("whoPlain", honour);
    else if (birthday && clubPosition) whoClause = clubOnly ? say("whoOf", club) : say("whoThe", clubPosition);
    else if (clubPosition && honour) whoClause = clubOnly ? say("whoOfAnd", club, honour) : say("whoTheAnd", clubPosition, honour);
    else if (clubPosition) whoClause = clubOnly ? say("whoOf", club) : say("whoThe", clubPosition);
    else whoClause = say("whoPlain", honour);
  }
  const deathYear = deathYearOf(record);
  const series = seriesOf(record);
  const sweep = series?.loserWins === 0;
  const seriesScore = series ? say(sweep ? "seriesSweepScore" : "seriesGamesScore", String(series.winnerWins), String(series.loserWins)) : "";
  const seriesBeat = series ? say(sweep ? "seriesSweeping" : "seriesBeating") : "";
  const seriesBeatPast = series ? say(sweep ? "seriesSwept" : "seriesBeat") : "";
  // English says "an 11–0 win", "an 8–3 win", "an 82–80 win": a number whose first word begins with a vowel sound (eight, eleven, eighteen, eighty-).
  const clincher = series ? say(/^(8|11|18)(\D|$)|^8\d(\D|$)/.test(winScore) ? "clincherAn" : "clincher", winScore, loseScore, String(series.games)) : "";
  const titleNo = record.winnerTitleNumber ? say("titleNumber", ordinal(record.winnerTitleNumber, locale)) : "";
  const seasonRecord = recordLine(record.winnerRecord);
  const regNote = seasonRecord ? say("regularSeason", seasonRecord) : "";
  const deceased = record.livingStatus === "deceased" && Boolean(deathYear);
  const diedParen = deceased && !ja ? say("diedParen", deathYear) : "";
  const diedParenJa = deceased && ja ? say("diedParen", deathYear) : "";
  const aged = record.ageYears != null ? say("aged", String(record.ageYears)) : "";
  const rec = record.record;
  const previous = cleanLabel(rec?.previousHolderName) ? say("previousHolder", cleanLabel(rec?.previousHolderName)) : "";
  const pick = record.overallPick != null ? say("overallPick", String(record.overallPick)) : "";
  const clubBy = clubNameClean ? say("clubBy", clubNameClean) : "";
  const cityIn = venueCityClean ? say("cityIn", venueCityClean) : "";
  const homeClause = clubs ? say("homeOf", clubs) : "";
  const finalClause = honour ? say("hosted", honour) : "";
  // A venue named only by its city ("Calihan Hall in Detroit opened in 1952") says nothing a reader can use: a club or an honour is needed.
  const venueContext = (clubs || honour) ? "venue" : "";
  const leagueIdentity = record.league ? league : "";
  const franchiseContext = (record.league?.trim() || venueCityClean) ? "franchise" : "";
  const yearsAgo = yearsAgoToday(record, asOf);
  // An event or a competition edition: its name ("the" before a name that opens with a year or a number), where it was held, and who won it.
  const eventLabel = cleanLabel(record.eventLabel);
  const eventPlace = cleanLabel(record.eventPlace);
  // A name that opens with a lower-case letter ("biathlon at the 2026 Winter Olympics") is capitalized where it opens the sentence.
  const labelOpening = !dates.dateLead && /^\p{Ll}/u.test(eventLabel) ? eventLabel.charAt(0).toUpperCase() + eventLabel.slice(1) : eventLabel;
  const labelThe = eventLabel ? `${/^\d/.test(eventLabel) ? (dates.dateLead ? say("article") : say("articleCap")) : ""}${labelOpening}` : "";
  const placeIn = eventPlace ? say(VENUE_WORDS.test(eventPlace) ? "placeAt" : "placeIn", eventPlace) : "";
  const wonBy = eventLabel && cleanLabel(record.winnerName) ? say("wonBy", cleanLabel(record.winnerName)) : "";
  const wonByTitle = eventLabel && cleanLabel(record.winnerName) ? say("wonByTitle", cleanLabel(record.winnerName)) : "";
  const { theW, theL } = clubArticles(record, say, Boolean(dates.dateLead));
  const recordEvent = rec && RECORD_VERB[rec.event] ? say(RECORD_VERB[rec.event]!) : "";
  const recordBy = rec && RECORD_BY[rec.event] ? say(RECORD_BY[rec.event]!) : "";
  return {
    name, year, league, home, away, ...dates,
    homeScore: hs == null ? "" : String(hs),
    awayScore: aws == null ? "" : String(aws),
    winner, loser, winScore, loseScore, theW, theL, ctx, ot, stage, venue, gameNo,
    seriesScore, seriesBeat, seriesBeatPast, clincher, titleNo, regNote,
    clubs,
    who, whoClause, whoAfter: whoClause.replace(/,$/, ""), diedParen, diedParenJa, homeClause, finalClause,
    venueContext, franchiseContext, leagueIdentity,
    highlight: honour,
    title: championshipTitle(record, locale),
    birthPlace: cleanLabel(record.birthPlace),
    deathYear,
    yearsAgo, yearsAgoToday: yearsAgo,
    // January 1 is where a source puts an identity or an award it dates only by year; a person's birth or death on it is real.
    dayPrecision: record.datePrecision === "day" && record.eventDate && (isPersonDay(record) || !/-01-01$/.test(record.eventDate)) ? "day" : "",
    winnerName: (cleanLabel(record.winnerName) || name),
    award: cleanLabel(record.awardName),
    holderName: cleanLabel(rec?.holderName),
    scope: cleanLabel(rec?.scope),
    metric: cleanLabel(rec?.metric),
    value: rec?.value == null ? "" : String(rec.value),
    unit: cleanLabel(rec?.unit),
    recordEvent, recordBy,
    previous,
    draftYear: record.draftYear == null ? "" : String(record.draftYear),
    pick, clubBy, clubName: clubNameClean || cleanLabel(record.winnerName),
    venueName: venueNameClean,
    cityIn,
    aged, agedJa: ja ? aged : "",
    eventLabel, labelThe, placeIn, wonBy, wonByTitle,
  };
}

function subjectOfFact(record: OnThisDayRecord, locale: TemplateLocale, asOf: string | undefined, choose: Chooser): Subject | null {
  const type = factType(record);
  if (!type) return null;
  const hs = record.homeScore, aws = record.awayScore;
  const tie = hs != null && aws != null && hs === aws;
  const deathYear = deathYearOf(record);
  const when = whenOfFact(record);
  const onDay = isOnDay(when, asOf);
  return {
    type, recordId: record.recordId, fields: fieldsOf(record, locale, asOf, choose, when, onDay), onDay,
    living: record.livingStatus === "living",
    deceasedOk: record.category === "player-death" ? record.livingStatus !== "living" : record.livingStatus === "deceased" && Boolean(deathYear),
    tie, decisive: hs != null && aws != null && !tie, lopsided: isLopsided(record), series: seriesOf(record) !== null,
    blocked: record.category === "franchise-event" && /^\d{4}-01-01$/.test(record.eventDate ?? ""),
  };
}

// ---- History rows: the stored line is a canonical data label; these read its fields back and say it in prose ----

const MATCH_LINE = /^(.+?) (\d+)–(\d+) (.+?) \(World Cup (\d+), ([^;)]+)((?:; after extra time)?)(?:; penalties (\d+)–(\d+))?\)\.$/;
const BOUNDARY_LINE = /^(\d{4}) (.+) (began|ended)\.$/;
const EVENT_LINE = /^(.+) took place\.$/;
/** A final already rewritten to the winner-and-result form (the merged World Cup finals). */
const FINAL_LINE = /^(.+?) won the (\d{4}) World Cup, beating (.+?) (\d+)–(\d+)(?: (after extra time)| (on penalties) after (?:(extra time)|a (\d+)–(\d+) draw))?\.$/;

function historySubject(type: TemplateType, recordId: string, fields: Record<string, string>, decisive: boolean, onDay: boolean): Subject {
  return { type, recordId, fields, living: false, deceasedOk: false, tie: !decisive && type === "world-cup-match", decisive, lopsided: false, series: false, blocked: false, onDay };
}

function subjectOfHistory(record: MeigenRecord, locale: TemplateLocale, choose: Chooser, asOf: string | undefined): Subject | null {
  if (record.kind !== "history") return null;
  const say = (id: FragmentId, ...args: string[]): string => phrase(id, locale, args, choose(id));
  const when = whenOfHistory(record);
  const onDay = isOnDay(when, asOf);
  const dates = dateFields(locale, when, onDay, say);
  const text = record.text.trim();
  const match = MATCH_LINE.exec(text);
  if (match) {
    const [, team1Raw = "", s1 = "", s2 = "", team2Raw = "", year = "", roundRaw = "", extra = "", p1, p2] = match;
    const team1 = cleanLabel(team1Raw), team2 = cleanLabel(team2Raw);
    const score1 = Number(s1), score2 = Number(s2);
    const round = roundRaw.trim();
    let winner = "", loser = "", result = "", decisive = false;
    if (p1 !== undefined && p2 !== undefined) {
      const left = Number(p1), right = Number(p2);
      if (left === right) return null;
      const leftWon = left > right;
      winner = leftWon ? team1 : team2;
      loser = leftWon ? team2 : team1;
      const how = score1 === score2 ? say("penaltiesAfterDraw", say("result", s1, s2)) : say("penaltiesAfterExtraTime");
      result = `${say("result", String(Math.max(left, right)), String(Math.min(left, right)))}${how}`;
      decisive = true;
    } else if (score1 !== score2) {
      const leftWon = score1 > score2;
      winner = leftWon ? team1 : team2;
      loser = leftWon ? team2 : team1;
      result = `${say("result", String(Math.max(score1, score2)), String(Math.min(score1, score2)))}${extra ? say("extraTime") : ""}`;
      decisive = true;
    }
    const fields = { ...dates, team1, team2, score1: s1, score2: s2, year, round, roundPart: round ? say("roundPart", locale === "ja" ? roundJa(round) : round) : "", winner, loser, result };
    return historySubject(/^final$/i.test(round) ? "world-cup-final" : "world-cup-match", record.id, fields, decisive, onDay);
  }
  const final = FINAL_LINE.exec(text);
  if (final) {
    const [, winnerRaw = "", year = "", loserRaw = "", w = "", l = "", afterEt, pens, penEt, d1, d2] = final;
    const winner = cleanLabel(winnerRaw), loser = cleanLabel(loserRaw);
    const how = pens ? (penEt ? say("penaltiesAfterExtraTime") : say("penaltiesAfterDraw", say("result", d1 ?? "", d2 ?? ""))) : afterEt ? say("extraTime") : "";
    return historySubject("world-cup-final", record.id, { ...dates, winner, loser, year, result: `${say("result", w, l)}${how}` }, true, onDay);
  }
  const boundary = BOUNDARY_LINE.exec(text);
  if (boundary) {
    // The Games of "2020" held in 2021: on its own day the sentence says the year of the day as well.
    const fields = onDay && when && boundary[1] !== String(when.year) ? { ...dates, dateLead: dates.leadIn, theFirst: say("article") } : dates;
    return historySubject(boundary[3] === "began" ? "competition-start" : "competition-end", record.id, { ...fields, year: boundary[1] ?? "", name: cleanLabel(boundary[2]) }, false, onDay);
  }
  const event = EVENT_LINE.exec(text);
  if (event) {
    const label = cleanLabel(event[1]);
    // On its own day an event whose name holds no year still says it ("In 1975, Thrilla in Manila took place.").
    const fields = onDay && when && !label.includes(String(when.year)) ? { ...dates, dateLead: dates.leadIn } : dates;
    return historySubject("event-date", record.id, { ...fields, label, year: when ? String(when.year) : "" }, false, onDay);
  }
  return null;
}

function eligible(template: SentenceTemplate, subject: Subject, type: TemplateType): boolean {
  if (template.type !== type) return false;
  if (template.gate === "living" && !subject.living) return false;
  if (template.gate === "deceased" && !subject.deceasedOk) return false;
  if (template.when === "tie" && !subject.tie) return false;
  if (template.when === "decisive" && !subject.decisive) return false;
  if (template.when === "lopsided" && !subject.lopsided) return false;
  // A final won over several games says the series, never the last game's score as if it were the title.
  if (template.when === "series" && !subject.series) return false;
  if (subject.series && template.type === "final" && template.when !== "series") return false;
  if (subject.blocked) return false;
  // "Today" and "on this day" are true only on the fact's own day.
  if (template.day && !subject.onDay) return false;
  for (const need of template.needs) {
    if (!subject.fields[need]) return false;
  }
  return true;
}

function apply(template: SentenceTemplate, fields: Record<string, string>): string {
  const filled = template.pattern.replace(/\{([a-zA-Z0-9]+)\}/g, (_, key: string) => fields[key] ?? "");
  // A stray space before a full stop goes; a name such as "Colt .45's" keeps its own.
  // A name that ends in a full stop ("Nottingham Forest F.C.") does not double the sentence's own.
  const text = filled.replace(/[ \t]{2,}/g, " ").replace(/ \.(?=$|\s)/g, ".").replace(/ 。/g, "。").replace(/([^.])\.\.$/, "$1.").trim();
  // A placeholder for a missing value is never shown: the sentence is not said at all.
  return hasPlaceholder(text) ? "" : text;
}

function pickFixed(rows: readonly SentenceTemplate[]): SentenceTemplate | undefined {
  const specific = rows.find((row) => row.role === "default" && row.gate !== "neutral");
  return specific ?? rows.find((row) => row.role === "default") ?? rows[0];
}

/** An outline of a template with every field blanked: two templates with the same shape read alike. */
export function shapeOf(template: SentenceTemplate): string {
  return template.pattern.replace(/\{[a-zA-Z0-9]+\}/g, "_").replace(/\s+/g, " ").trim().toLowerCase();
}

/** The first literal word of a template ("was", "on", "today"). Adjacent sentences should not open alike. */
export function leadOf(template: SentenceTemplate): string {
  const shape = shapeOf(template).replace(/^[_\s,.:;（）()、。]+/, "");
  return /^[\p{L}\p{N}]+/u.exec(shape)?.[0] ?? "";
}

/** One record, ready to be worded: its fields and the templates that may say it. */
export interface Prepared {
  readonly subject: Subject;
  readonly type: TemplateType;
  readonly pool: readonly SentenceTemplate[];
}

/** Fields and the eligible templates for one record. A final with no final template falls back to a game. */
export function prepare(
  item: OnThisDayRecord | MeigenRecord, locale: TemplateLocale, wording: Wording, seed: string, asOf: string | undefined,
): Prepared | null {
  const history = "kind" in item;
  const id = history ? item.id : item.recordId;
  const choose = chooserFor(wording, seed, id, locale);
  const subject = history ? subjectOfHistory(item, locale, choose, asOf) : subjectOfFact(item, locale, asOf, choose);
  if (!subject) return null;
  let type = subject.type;
  let pool = TEMPLATES.filter((row) => row.locale === locale && eligible(row, subject, type));
  if (!pool.length && type === "final") {
    type = "game";
    pool = TEMPLATES.filter((row) => row.locale === locale && eligible(row, subject, type));
  }
  return pool.length ? { subject, type, pool } : null;
}

export function sentenceFrom(prepared: Prepared, template: SentenceTemplate): string {
  return apply(template, prepared.subject.fields);
}

function finish(
  prepared: Prepared, recordId: string, locale: TemplateLocale, wording: Wording, seed: string, templateId: string | undefined,
): RenderedSentence | null {
  const { pool } = prepared;
  let chosen: SentenceTemplate | undefined;
  if (templateId) {
    chosen = pool.find((row) => row.id === templateId);
    if (!chosen) return null;
  } else if (wording === "fixed") {
    chosen = pickFixed(pool);
  } else {
    chosen = pool[hash32(`${seed}:${recordId}:${locale}`) % pool.length];
  }
  if (!chosen) return null;
  const text = sentenceFrom(prepared, chosen);
  if (!text) return null;
  return { text, templateId: chosen.id, locale };
}

function guard(options: RenderOptions): void {
  if ((options.wording ?? "fixed") === "varied" && !options.seed && !options.templateId) {
    throw new RangeError("varied wording needs an explicit seed");
  }
}

/** Render a sentence from committed templates and the fact's fields. Never guesses a missing field. */
export function render(record: OnThisDayRecord, options: RenderOptions = {}): RenderedSentence | null {
  guard(options);
  const locale: TemplateLocale = options.locale ?? "en";
  const wording = options.wording ?? "fixed";
  const seed = options.seed ?? record.recordId;
  const prepared = prepare(record, locale, wording, seed, options.asOf);
  return prepared ? finish(prepared, record.recordId, locale, wording, seed, options.templateId) : null;
}

/** Render a bundled history row (a World Cup match, a competition's start or end, a dated event) in prose. `null` for quotations and lines it does not know. */
export function renderHistory(record: MeigenRecord, options: RenderOptions = {}): RenderedSentence | null {
  guard(options);
  const locale: TemplateLocale = options.locale ?? "en";
  const wording = options.wording ?? "fixed";
  const seed = options.seed ?? record.id;
  const prepared = prepare(record, locale, wording, seed, options.asOf);
  return prepared ? finish(prepared, record.id, locale, wording, seed, options.templateId) : null;
}

/** Render a stored History caption line (a string, not a record) and say what kind of statement it was. */
export function renderCaption(text: string, options: RenderOptions = {}): (RenderedSentence & { readonly type: TemplateType }) | null {
  const record = { id: "caption", kind: "history", text } as unknown as MeigenRecord;
  guard(options);
  const locale: TemplateLocale = options.locale ?? "en";
  const wording = options.wording ?? "fixed";
  const seed = options.seed ?? record.id;
  const prepared = prepare(record, locale, wording, seed, options.asOf);
  const done = prepared ? finish(prepared, record.id, locale, wording, seed, options.templateId) : null;
  return prepared && done ? { ...done, type: prepared.type } : null;
}

export function templatesFor(type: TemplateType, locale: TemplateLocale = "en"): readonly SentenceTemplate[] {
  return TEMPLATES.filter((row) => row.type === type && row.locale === locale);
}
