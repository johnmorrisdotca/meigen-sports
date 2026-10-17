import type { OnThisDayRecord } from "../schema.ts";
import type { TemplateLocale } from "./types.ts";

const GENERIC_ROUND = new Set(["", "final", "championship", "championship-final", "regular", "playoffs", "championship_final"]);

const TITLE_EN: Record<string, string> = {
  mlb: "World Series",
  nhl: "Stanley Cup",
  nba: "NBA Finals",
  cfl: "Grey Cup",
  wc: "World Cup",
  wwc: "Women's World Cup",
  afl: "AFL Championship",
  aafc: "AAFC Championship",
  nha: "NHA Championship",
  pcha: "PCHA Championship",
  wchl: "WCHL Championship",
  wha: "Avco World Trophy",
  mls: "MLS Cup",
};

const TITLE_JA: Record<string, string> = {
  "World Series": "ワールドシリーズ",
  "Stanley Cup": "スタンレー・カップ",
  "NBA Finals": "NBAファイナル",
  "NFL Championship": "NFL選手権",
  "Super Bowl": "スーパーボウル",
  "Grey Cup": "グレイ・カップ",
  "World Cup": "ワールドカップ",
  "Women's World Cup": "女子ワールドカップ",
  "AFL Championship": "AFL選手権",
  "AAFC Championship": "AAFC選手権",
  "NHA Championship": "NHA選手権",
  "PCHA Championship": "PCHA選手権",
  "WCHL Championship": "WCHL選手権",
  "Avco World Trophy": "AVCOトロフィー",
  "MLS Cup": "MLSカップ",
};

const LOPSIDED: Record<string, { margin: number; shutout: boolean }> = {
  baseball: { margin: 8, shutout: true },
  "american-football": { margin: 21, shutout: true },
  american_football: { margin: 21, shutout: true },
  "canadian-football": { margin: 21, shutout: true },
  canadian_football: { margin: 21, shutout: true },
  "ice-hockey": { margin: 5, shutout: true },
  hockey: { margin: 5, shutout: true },
  ice_hockey: { margin: 5, shutout: true },
  soccer: { margin: 4, shutout: true },
  basketball: { margin: 25, shutout: false },
};

function yearNumber(record: OnThisDayRecord): number | null {
  if (record.seasonStartYear != null) return record.seasonStartYear;
  if (record.eventDate && /^\d{4}-/.test(record.eventDate)) return Number(record.eventDate.slice(0, 4));
  return null;
}

function nflTitle(record: OnThisDayRecord): string {
  const year = yearNumber(record);
  if (year != null && year >= 1966) return "Super Bowl";
  return "NFL Championship";
}

function localize(title: string, locale: TemplateLocale): string {
  if (locale !== "ja") return title;
  return TITLE_JA[title] ?? title;
}

/** The championship this final decided. Never the league code alone ("the 1934 MLB"). */
export function championshipTitle(record: OnThisDayRecord, locale: TemplateLocale = "en"): string {
  const labeled = (record.roundLabel ?? record.stage ?? record.phase ?? "").trim().replaceAll("_", " ");
  if (labeled && !GENERIC_ROUND.has(labeled.toLowerCase())) {
    return localize(labeled, locale);
  }
  const code = (record.league ?? record.competition ?? "").toLowerCase();
  if (code === "nfl") return localize(nflTitle(record), locale);
  const mapped = TITLE_EN[code];
  return mapped ? localize(mapped, locale) : "";
}

/** Shutout plus a large margin for that sport. A 2–1 soccer win is never lopsided. */
export function isLopsided(record: OnThisDayRecord): boolean {
  const hs = record.homeScore, aws = record.awayScore;
  if (hs == null || aws == null || hs === aws) return false;
  const win = Math.max(hs, aws), lose = Math.min(hs, aws);
  const rule = LOPSIDED[record.sport ?? ""];
  if (!rule) return false;
  if (win - lose < rule.margin) return false;
  if (rule.shutout && lose !== 0) return false;
  return true;
}
