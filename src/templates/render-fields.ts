import type { OnThisDayRecord } from "../schema.ts";
import { isCareerHighlight, publicClubName } from "./clubs.ts";
import { cleanLabel, stageJa } from "./labels.ts";
import { OVERTIME_BY_SPORT, ordinal, phrase } from "./phrases.ts";
import type { FragmentId } from "./phrases.ts";
import { positionName } from "./positions.ts";
import { championshipTitle } from "./titles.ts";
import type { TemplateLocale, TemplateType } from "./types.ts";
import { leagueLabel, teamName, VENUE_WORDS, RECORD_VERB, RECORD_BY } from "./render.ts";
import type { Chooser } from "./render.ts";
import { yearOf, dateFields, deathYearOf, yearsAgoToday } from "./render-dates.ts";
import type { When } from "./render-dates.ts";

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

export function isPersonDay(record: OnThisDayRecord): boolean {
  return record.category === "player-birthday" || record.category === "player-death";
}

/** The tally of a final that was a series: games won by the title winner and by the loser, and every game played (a tied game counts here, not as a win). Only when the counts agree with one another. */
export function seriesOf(record: OnThisDayRecord): { winnerWins: number; loserWins: number; games: number } | null {
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

const ALL_STAR_NAME: Record<string, FragmentId> = { nhl: "allStarNhl", nba: "allStarNba", mlb: "allStarMlb", nfl: "allStarNfl", cfl: "allStarCfl" };

/** The parts of an All-Star Game sentence: its name as the league writes it, the deciding game's result (never for a tie) and the most valuable players. */
function allStarFields(record: OnThisDayRecord, say: (id: FragmentId, ...args: string[]) => string): Record<string, string> {
  const name = record.category === "all-star" ? ALL_STAR_NAME[record.league ?? ""] : undefined;
  if (!name) return { allStarName: "", allStarResult: "", allStarMvp: "" };
  const winner = cleanLabel(record.winnerName), loser = cleanLabel(record.loserName);
  const ws = record.winnerScore, ls = record.loserScore;
  const decided = winner && loser && ws != null && ls != null && ws > ls;
  const extra = decided ? (record.decidedBy === "SO" ? say("shootout") : record.decidedBy === "OT" ? say("overtime") : "") : "";
  const mvps = (record.mvpNames ?? []).map(cleanLabel).filter(Boolean);
  return {
    allStarName: say(name),
    allStarResult: decided ? say("allStarResult", winner, loser, String(ws), String(ls)) + extra : "",
    allStarMvp: mvps.length === 1 ? say("allStarMvp", mvps[0]!) : mvps.length > 1 ? say("allStarMvps", mvps.join(say("listLast"))) : "",
  };
}

const FEAT_STAGE: Record<string, FragmentId> = {
  "world-series": "featWorldSeries", "league-championship": "featLeagueChampionship", "division-series": "featDivisionSeries", "wild-card": "featWildCard",
};

/** The parts of a no-hitter or perfect-game sentence: what was done, by the pitcher or by the club, the club's score, and the round of a postseason game. */
function featFields(record: OnThisDayRecord, say: (id: FragmentId, ...args: string[]) => string): Record<string, string> {
  if (record.category !== "game-feat" || !record.feat) return { featDid: "", featClubDid: "", featResult: "", featStage: "", featOfClub: "", opponentName: "", pitcherName: "" };
  const perfect = record.feat === "perfect-game";
  const cs = record.clubScore, os = record.opponentScore;
  const club = cleanLabel(record.clubName);
  const pitcher = (record.pitchersUsed ?? 0) === 1 ? cleanLabel(record.pitcherName) : "";
  return {
    featDid: say(perfect ? "featPerfect" : "featNoHitter"),
    featClubDid: say(perfect ? "featClubPerfect" : (record.pitchersUsed ?? 1) > 1 ? "featClubCombined" : "featClubNoHit"),
    featResult: cs != null && os != null && cs !== os ? say(cs > os ? "featWin" : "featLoss", String(cs), String(os)) : "",
    featStage: FEAT_STAGE[record.phase ?? ""] ? say(FEAT_STAGE[record.phase ?? ""]!) : "",
    featOfClub: pitcher && club ? say("featOfClub", club) : "",
    opponentName: cleanLabel(record.opponentName),
    pitcherName: pitcher,
  };
}

const PF_WORD: Record<number, FragmentId> = { 5: "pfWord5", 6: "pfWord6", 7: "pfWord7" };

/** The parts of a player's feat sentence: what he did, against whom, and the tail (the score, how many times he has done it, the career game of a 500th goal). */
function playerFeatFields(record: OnThisDayRecord, locale: TemplateLocale, say: (id: FragmentId, ...args: string[]) => string): Record<string, string> {
  const empty = { playerName: "", pfOfClub: "", pfDid: "", pfAgainst: "", pfTail: "" };
  const kind = record.featKind, amount = record.featAmount;
  if (record.category !== "player-feat" || !kind || amount == null) return empty;
  const club = cleanLabel(record.clubName), opponent = cleanLabel(record.opponentName);
  const count = PF_WORD[amount] ? say(PF_WORD[amount]!) : String(amount);
  const did = kind === "goals-in-game" ? say(record.phase === "playoffs" ? "pfGoalsPlayoff" : "pfGoals", count)
    : kind === "career-goals" ? say("pfCareer", ordinal(amount, locale)) : say("pfPoints", String(amount));
  const nth = (record.featNth ?? 1) > 1 && kind !== "career-goals" ? say(kind === "goals-in-game" ? "pfNthGoals" : "pfNthPoints", ordinal(record.featNth!, locale)) : "";
  const cs = record.clubScore, os = record.opponentScore;
  const result = kind === "points-in-game" && cs != null && os != null && cs !== os ? say(cs > os ? "featWin" : "featLoss", String(cs), String(os)) : "";
  const gameNo = kind === "career-goals" && record.careerGame ? say("pfGameNo", ordinal(record.careerGame, locale)) : "";
  const net = kind === "career-goals" && record.emptyNet === true;
  return {
    playerName: cleanLabel(record.playerName),
    pfOfClub: club ? say("featOfClub", club) : "",
    pfDid: did,
    pfAgainst: net ? (opponent ? say("pfAgainstEmpty", opponent) : say("pfEmptyNet")) : opponent ? say("pfAgainst", opponent) : "",
    pfTail: `${result}${nth}${gameNo}`,
    opponentName: opponent,
  };
}

export function fieldsOf(
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
    number: record.jerseyNumber == null ? "" : String(record.jerseyNumber),
    ...allStarFields(record, say),
    ...featFields(record, say),
    ...playerFeatFields(record, locale, say),
    leagueWide: record.category === "retired-number" && record.leagueWide ? league : "",
    theClub: record.sport === "soccer" ? "" : say("article"),
    venueName: venueNameClean,
    cityIn,
    aged, agedJa: ja ? aged : "",
    eventLabel, labelThe, placeIn, wonBy, wonByTitle,
  };
}
