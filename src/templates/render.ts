import type { OnThisDayRecord, TeamRef } from "../schema.ts";
import { TEMPLATES } from "./catalog.ts";
import type {
  RenderedSentence, RenderOptions, SentenceTemplate, TemplateLocale, TemplateType,
} from "./types.ts";

const LEAGUE_LABEL: Record<string, string> = {
  nhl: "NHL", nba: "NBA", mlb: "MLB", nfl: "NFL", cfl: "CFL", mls: "MLS",
  wc: "World Cup", wwc: "Women's World Cup", afl: "AFL", aafc: "AAFC",
  nha: "NHA", pcha: "PCHA", wchl: "WCHL", wha: "WHA",
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
    case "comeback":
      return "game";
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

function hash32(text: string): number {
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

function fieldsOf(record: OnThisDayRecord, locale: TemplateLocale, asOf?: string): Record<string, string> {
  const ja = locale === "ja";
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
  const ctxBits = [league, year].filter(Boolean).join(ja ? "、" : ", ");
  const ctx = ctxBits ? (ja ? `（${ctxBits}）` : ` (${ctxBits})`) : "";
  const ot = record.decidedByShootout ? (ja ? "（PK戦）" : " in a shootout")
    : record.wentToOvertime ? (ja ? "（延長）" : " in overtime") : "";
  const stageRaw = record.stage ?? record.phase ?? record.roundLabel;
  const stage = stageRaw && stageRaw !== "regular" ? (ja ? `、${stageRaw.replaceAll("_", " ")}` : `, ${stageRaw.replaceAll("_", " ")}`) : "";
  const venue = record.venueName
    ? (record.venueCity ? (ja ? `（${record.venueName}、${record.venueCity}）` : ` at ${record.venueName}, ${record.venueCity}`)
      : (ja ? `（${record.venueName}）` : ` at ${record.venueName}`))
    : "";
  const gameNo = record.seriesGameNumber ? (ja ? `第${record.seriesGameNumber}戦` : ` in Game ${record.seriesGameNumber}`) : "";
  const winnerSeason = homeWon ? (record.home?.teamSeasonId ?? null) : (record.away?.teamSeasonId ?? null);
  let series = "";
  const best = record.seriesBestOf, high = record.seriesHigherWins, low = record.seriesLowerWins;
  const seriesWinner = record.seriesWinnerTeamSeasonId;
  if (best != null && high != null && low != null && seriesWinner != null && winnerSeason != null) {
    const need = Math.floor(best / 2) + 1;
    if (high >= need && seriesWinner === winnerSeason) {
      const score = `${Math.max(high, low)}–${Math.min(high, low)}`;
      const round = record.roundLabel ? ` ${record.roundLabel}` : "";
      series = ja ? `。シリーズ${score}で${round}を制した` : ` to win the${round} ${score}`;
    }
  }
  const clubs = (record.clubNames?.filter((n) => n.trim()) ?? []).join(ja ? "、" : ", ") || (record.clubName?.trim() ?? "");
  const extraBits = [record.position, clubs].filter((v): v is string => Boolean(v && v.trim()));
  const extra = extraBits.length ? (ja ? `（${extraBits.join("、")}）` : ` (${extraBits.join(", ")})`) : "";
  const age = record.ageYears != null ? (ja ? `${record.ageYears}歳で` : ` at age ${record.ageYears}`) : "";
  const rec = record.record;
  const previous = rec?.previousHolderName
    ? (ja ? `。それ以前は${rec.previousHolderName}` : ` Previous holder: ${rec.previousHolderName}.`)
    : "";
  const pick = record.overallPick != null ? (ja ? `全体${record.overallPick}位` : ` No. ${record.overallPick} overall`) : "";
  const clubBy = record.clubName?.trim() ? (ja ? `、${record.clubName}` : ` by the ${record.clubName}`) : "";
  const cityIn = record.venueCity ? (ja ? `（${record.venueCity}）` : ` in ${record.venueCity}`) : "";
  const yearsAgo = yearsAgoToday(record, asOf);
  const out: Record<string, string> = {
    name, year, league, home, away,
    homeScore: hs == null ? "" : String(hs),
    awayScore: aws == null ? "" : String(aws),
    winner, loser, winScore, loseScore, ctx, ot, stage, venue, gameNo, series,
    extra, age, clubs, highlight: record.highlight?.trim() ?? "",
    birthPlace: record.birthPlace?.trim() ?? "",
    deathYear: deathYearOf(record),
    yearsAgo, yearsAgoToday: yearsAgo,
    dayPrecision: record.datePrecision === "day" && record.eventDate && !/-01-01$/.test(record.eventDate) ? "day" : "",
    winnerName: (record.winnerName?.trim() || name),
    award: record.awardName?.trim() ?? "",
    holderName: rec?.holderName ?? "",
    scope: rec?.scope ?? "",
    metric: rec?.metric ?? "",
    value: rec?.value == null ? "" : String(rec.value),
    unit: rec?.unit ?? "",
    recordEvent: rec?.event ?? "",
    previous,
    draftYear: record.draftYear == null ? "" : String(record.draftYear),
    pick, clubBy, clubName: record.clubName?.trim() || record.winnerName?.trim() || "",
    venueName: record.venueName?.trim() || "",
    cityIn,
  };
  return out;
}

function gated(template: SentenceTemplate, record: OnThisDayRecord): boolean {
  if (template.gate === "living") return record.livingStatus === "living";
  if (template.gate === "deceased") {
    if (record.category === "player-death" && record.livingStatus !== "living") return true;
    return record.livingStatus === "deceased" && Boolean(deathYearOf(record));
  }
  return true;
}

function eligible(template: SentenceTemplate, record: OnThisDayRecord, fields: Record<string, string>, type: TemplateType): boolean {
  if (template.type !== type) return false;
  if (!gated(template, record)) return false;
  const hs = record.homeScore, aws = record.awayScore;
  const tie = hs != null && aws != null && hs === aws;
  if (template.when === "tie" && !tie) return false;
  if (template.when === "decisive" && (hs == null || aws == null || tie)) return false;
  if (record.category === "franchise-event" && /^\d{4}-01-01$/.test(record.eventDate ?? "")) return false;
  for (const need of template.needs) {
    if (!fields[need]) return false;
  }
  return true;
}

function apply(template: SentenceTemplate, fields: Record<string, string>): string {
  const filled = template.pattern.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => fields[key] ?? "");
  return filled.replace(/[ \t]{2,}/g, " ").replace(" .", ".").replace(" 。", "。").trim();
}

function pickFixed(rows: readonly SentenceTemplate[]): SentenceTemplate | undefined {
  const specific = rows.find((row) => row.role === "default" && row.gate !== "neutral");
  return specific ?? rows.find((row) => row.role === "default") ?? rows[0];
}

/** Render a sentence from committed templates and the fact's fields. Never guesses a missing field. */
export function render(record: OnThisDayRecord, options: RenderOptions = {}): RenderedSentence | null {
  const locale: TemplateLocale = options.locale ?? "en";
  const wording = options.wording ?? "fixed";
  if (wording === "varied" && !options.seed && !options.templateId) {
    throw new RangeError("varied wording needs an explicit seed");
  }
  const initialType = factType(record);
  if (!initialType) return null;
  let type: TemplateType = initialType;
  const fields = fieldsOf(record, locale, options.asOf);
  let pool = TEMPLATES.filter((row) => row.locale === locale && eligible(row, record, fields, type));
  if (!pool.length && type === "final") {
    type = "game";
    pool = TEMPLATES.filter((row) => row.locale === locale && eligible(row, record, fields, type));
  }
  if (!pool.length) return null;
  let chosen: SentenceTemplate | undefined;
  if (options.templateId) {
    chosen = pool.find((row) => row.id === options.templateId);
    if (!chosen) return null;
  } else if (wording === "fixed") {
    chosen = pickFixed(pool);
  } else {
    const seed = options.seed ?? record.recordId;
    chosen = pool[hash32(`${seed}:${record.recordId}:${locale}`) % pool.length];
  }
  if (!chosen) return null;
  const text = apply(chosen, fields);
  if (!text) return null;
  return { text, templateId: chosen.id, locale };
}

export function templatesFor(type: TemplateType, locale: TemplateLocale = "en"): readonly SentenceTemplate[] {
  return TEMPLATES.filter((row) => row.type === type && row.locale === locale);
}
