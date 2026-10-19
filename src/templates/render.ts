import type { OnThisDayRecord, TeamRef } from "../schema.ts";
import type { MeigenRecord } from "../types.ts";
import { TEMPLATES } from "./catalog.ts";
import { isCareerHighlight, publicClubName } from "./clubs.ts";
import { OVERTIME_BY_SPORT, phrase } from "./phrases.ts";
import type { FragmentId } from "./phrases.ts";
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

function leagueLabel(record: OnThisDayRecord): string {
  const code = record.league ?? record.competition;
  if (!code) return "";
  return LEAGUE_LABEL[code] ?? code.toUpperCase();
}

function teamName(team: TeamRef | undefined): string {
  return team?.name?.trim() ?? "";
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
  readonly blocked: boolean;
}

/** Clubs of a team sport take "the" (the Chicago Bears); national sides and soccer clubs do not (Argentina, Arsenal). */
function clubArticles(record: OnThisDayRecord, say: (id: FragmentId, ...args: string[]) => string): { theW: string; theL: string } {
  const none = record.sport === "soccer" || record.league === "wc" || record.league === "wwc";
  return none ? { theW: "", theL: "" } : { theW: say("articleCap"), theL: say("article") };
}

function fieldsOf(record: OnThisDayRecord, locale: TemplateLocale, asOf: string | undefined, choose: Chooser): Record<string, string> {
  const ja = locale === "ja";
  const say = (id: FragmentId, ...args: string[]): string => phrase(id, locale, args, choose(id));
  const name = record.person?.name?.trim() ?? "";
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
  const ctxBits = [league, year].filter(Boolean).join(say("join"));
  const ctx = ctxBits ? say("context", ctxBits) : "";
  const sportWords = OVERTIME_BY_SPORT[record.sport ?? ""];
  const ot = record.decidedByShootout ? say("shootout")
    : record.wentToOvertime ? (sportWords ? phrase("overtime", locale, [], choose("overtime"), sportWords) : say("overtime")) : "";
  const stageRaw = record.stage ?? record.phase ?? record.roundLabel;
  const stage = stageRaw && stageRaw !== "regular" ? say("stage", stageRaw.replaceAll("_", " ")) : "";
  const venue = record.venueName
    ? (record.venueCity ? say("venueCityAt", record.venueName, record.venueCity) : say("venueAt", record.venueName))
    : "";
  const gameNo = record.seriesGameNumber ? say("gameNumber", String(record.seriesGameNumber)) : "";
  const clubs = (record.clubNames?.filter((n) => n.trim()) ?? []).join(say("join")) || (record.clubName?.trim() ?? "");
  const club = publicClubName(record.clubNames, record.clubName ?? "");
  const position = record.position?.trim() ?? "";
  const clubPosition = [club, position].filter(Boolean).join(" ");
  const honour = record.highlight?.trim() ?? "";
  const birthday = record.category === "player-birthday";
  const career = birthday && honour && isCareerHighlight(honour);
  const whoCore = career ? honour : (clubPosition || honour);
  const who = whoCore ? "who" : "";
  let whoClause = "";
  if (whoCore) {
    if (ja) {
      whoClause = say("whoParen", career ? honour : birthday ? (clubPosition || honour) : [clubPosition, honour].filter(Boolean).join(say("join")));
    } else if (career) whoClause = say("whoPlain", honour);
    else if (birthday && clubPosition) whoClause = say("whoThe", clubPosition);
    else if (clubPosition && honour) whoClause = say("whoTheAnd", clubPosition, honour);
    else if (clubPosition) whoClause = say("whoThe", clubPosition);
    else whoClause = say("whoPlain", honour);
  }
  const deathYear = deathYearOf(record);
  const deceased = record.livingStatus === "deceased" && Boolean(deathYear);
  const diedParen = deceased && !ja ? say("diedParen", deathYear) : "";
  const diedParenJa = deceased && ja ? say("diedParen", deathYear) : "";
  const aged = record.ageYears != null ? say("aged", String(record.ageYears)) : "";
  const rec = record.record;
  const previous = rec?.previousHolderName ? say("previousHolder", rec.previousHolderName) : "";
  const pick = record.overallPick != null ? say("overallPick", String(record.overallPick)) : "";
  const clubBy = record.clubName?.trim() ? say("clubBy", record.clubName) : "";
  const cityIn = record.venueCity ? say("cityIn", record.venueCity) : "";
  const homeClause = clubs ? say("homeOf", clubs) : "";
  const finalClause = honour ? say("hosted", honour) : "";
  const venueContext = (record.venueCity?.trim() || clubs || honour) ? "venue" : "";
  const leagueIdentity = record.league ? league : "";
  const franchiseContext = (record.league?.trim() || record.venueCity?.trim()) ? "franchise" : "";
  const yearsAgo = yearsAgoToday(record, asOf);
  const { theW, theL } = clubArticles(record, say);
  const recordEvent = rec && RECORD_VERB[rec.event] ? say(RECORD_VERB[rec.event]!) : "";
  const recordBy = rec && RECORD_BY[rec.event] ? say(RECORD_BY[rec.event]!) : "";
  return {
    name, year, league, home, away,
    homeScore: hs == null ? "" : String(hs),
    awayScore: aws == null ? "" : String(aws),
    winner, loser, winScore, loseScore, theW, theL, ctx, ot, stage, venue, gameNo,
    clubs,
    who, whoClause, whoAfter: whoClause.replace(/,$/, ""), diedParen, diedParenJa, homeClause, finalClause,
    venueContext, franchiseContext, leagueIdentity,
    highlight: record.highlight?.trim() ?? "",
    title: championshipTitle(record, locale),
    birthPlace: record.birthPlace?.trim() ?? "",
    deathYear,
    yearsAgo, yearsAgoToday: yearsAgo,
    dayPrecision: record.datePrecision === "day" && record.eventDate && !/-01-01$/.test(record.eventDate) ? "day" : "",
    winnerName: (record.winnerName?.trim() || name),
    award: record.awardName?.trim() ?? "",
    holderName: rec?.holderName ?? "",
    scope: rec?.scope ?? "",
    metric: rec?.metric ?? "",
    value: rec?.value == null ? "" : String(rec.value),
    unit: rec?.unit ?? "",
    recordEvent, recordBy,
    previous,
    draftYear: record.draftYear == null ? "" : String(record.draftYear),
    pick, clubBy, clubName: record.clubName?.trim() || record.winnerName?.trim() || "",
    venueName: record.venueName?.trim() || "",
    cityIn,
    aged, agedJa: ja ? aged : "",
  };
}

function subjectOfFact(record: OnThisDayRecord, locale: TemplateLocale, asOf: string | undefined, choose: Chooser): Subject | null {
  const type = factType(record);
  if (!type) return null;
  const hs = record.homeScore, aws = record.awayScore;
  const tie = hs != null && aws != null && hs === aws;
  const deathYear = deathYearOf(record);
  return {
    type, recordId: record.recordId, fields: fieldsOf(record, locale, asOf, choose),
    living: record.livingStatus === "living",
    deceasedOk: record.category === "player-death" ? record.livingStatus !== "living" : record.livingStatus === "deceased" && Boolean(deathYear),
    tie, decisive: hs != null && aws != null && !tie, lopsided: isLopsided(record),
    blocked: record.category === "franchise-event" && /^\d{4}-01-01$/.test(record.eventDate ?? ""),
  };
}

// ---- History rows: the stored line is a canonical data label; these read its fields back and say it in prose ----

const MATCH_LINE = /^(.+?) (\d+)–(\d+) (.+?) \(World Cup (\d+), ([^;)]+)((?:; after extra time)?)(?:; penalties (\d+)–(\d+))?\)\.$/;
const BOUNDARY_LINE = /^(\d{4}) (.+) (began|ended)\.$/;
const EVENT_LINE = /^(.+) took place\.$/;
/** A final already rewritten to the winner-and-result form (the merged World Cup finals). */
const FINAL_LINE = /^(.+?) won the (\d{4}) World Cup, beating (.+?) (\d+)–(\d+)(?: (after extra time)| (on penalties) after (?:(extra time)|a (\d+)–(\d+) draw))?\.$/;

function historySubject(type: TemplateType, recordId: string, fields: Record<string, string>, decisive: boolean): Subject {
  return { type, recordId, fields, living: false, deceasedOk: false, tie: !decisive && type === "world-cup-match", decisive, lopsided: false, blocked: false };
}

function subjectOfHistory(record: MeigenRecord, locale: TemplateLocale, choose: Chooser): Subject | null {
  if (record.kind !== "history") return null;
  const say = (id: FragmentId, ...args: string[]): string => phrase(id, locale, args, choose(id));
  const text = record.text.trim();
  const match = MATCH_LINE.exec(text);
  if (match) {
    const [, team1 = "", s1 = "", s2 = "", team2 = "", year = "", roundRaw = "", extra = "", p1, p2] = match;
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
    const fields = { team1, team2, score1: s1, score2: s2, year, round, roundPart: round ? say("roundPart", round) : "", winner, loser, result };
    return historySubject(/^final$/i.test(round) ? "world-cup-final" : "world-cup-match", record.id, fields, decisive);
  }
  const final = FINAL_LINE.exec(text);
  if (final) {
    const [, winner = "", year = "", loser = "", w = "", l = "", afterEt, pens, penEt, d1, d2] = final;
    const how = pens ? (penEt ? say("penaltiesAfterExtraTime") : say("penaltiesAfterDraw", say("result", d1 ?? "", d2 ?? ""))) : afterEt ? say("extraTime") : "";
    return historySubject("world-cup-final", record.id, { winner, loser, year, result: `${say("result", w, l)}${how}` }, true);
  }
  const boundary = BOUNDARY_LINE.exec(text);
  if (boundary) {
    return historySubject(boundary[3] === "began" ? "competition-start" : "competition-end", record.id, { year: boundary[1] ?? "", name: boundary[2] ?? "" }, false);
  }
  const event = EVENT_LINE.exec(text);
  if (event) return historySubject("event-date", record.id, { label: event[1] ?? "" }, false);
  return null;
}

function eligible(template: SentenceTemplate, subject: Subject, type: TemplateType): boolean {
  if (template.type !== type) return false;
  if (template.gate === "living" && !subject.living) return false;
  if (template.gate === "deceased" && !subject.deceasedOk) return false;
  if (template.when === "tie" && !subject.tie) return false;
  if (template.when === "decisive" && !subject.decisive) return false;
  if (template.when === "lopsided" && !subject.lopsided) return false;
  if (subject.blocked) return false;
  for (const need of template.needs) {
    if (!subject.fields[need]) return false;
  }
  return true;
}

function apply(template: SentenceTemplate, fields: Record<string, string>): string {
  const filled = template.pattern.replace(/\{([a-zA-Z0-9]+)\}/g, (_, key: string) => fields[key] ?? "");
  return filled.replace(/[ \t]{2,}/g, " ").replace(" .", ".").replace(" 。", "。").trim();
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
  const subject = history ? subjectOfHistory(item, locale, choose) : subjectOfFact(item, locale, asOf, choose);
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
