import type { OnThisDayRecord } from "./schema.ts";

/**
 * The sub-path of the dougu-sports emblem (0.28.0 or later: `@johnmorrisdotca/dougu-sports/gear/gear.baseballglove`) that goes with a sport, one for each sport that has one.
 * A sport that is not here has no gear; a consumer falls back to its sport icon. The library names the emblem and draws nothing.
 */
export const GEAR_BY_SPORT: Readonly<Record<string, string>> = {
  "baseball": "gear/gear.baseballglove",
  "softball": "ball/ball.softball",
  "american-football": "gear/gear.footballhelmet",
  "canadian-football": "gear/gear.footballhelmet",
  "ice-hockey": "gear/gear.hockeystick",
  "field-hockey": "gear/gear.fieldhockeystick",
  "basketball": "ball/ball.basketball",
  "soccer": "ball/ball.soccer",
  "cricket": "gear/gear.cricketbat",
  "tennis": "gear/gear.tennisracket",
  "badminton": "gear/gear.badmintonracket",
  "table-tennis": "gear/gear.tabletennispaddle",
  "lacrosse": "gear/gear.lacrossestick",
  "figure-skating": "gear/gear.skates",
  "speed-skating": "gear/gear.skates",
};

/** What a consumer may draw beside a fact. Colours are never given: the data holds none. */
export interface Visual {
  /** `"retired"`: a retired-number banner for `number`. `"title"`: a championship banner for `year`. */
  readonly banner?: "retired" | "title";
  readonly number?: number;
  readonly year?: number;
  /** A sub-path of dougu-sports (`GEAR_BY_SPORT`). */
  readonly gear?: string;
}

/** The banner and the gear a fact may be drawn with, from the fields it holds; an empty object when it has none. Pure: nothing is guessed. */
export function visualOf(record: OnThisDayRecord): Visual {
  const out: { banner?: "retired" | "title"; number?: number; year?: number; gear?: string } = {};
  const year = record.eventDate && /^\d{4}-/.test(record.eventDate) ? Number(record.eventDate.slice(0, 4)) : null;
  if (record.category === "retired-number" && record.jerseyNumber != null) {
    out.banner = "retired";
    out.number = record.jerseyNumber;
  } else if (record.category === "championship-final" && year !== null) {
    out.banner = "title";
    out.year = year;
  } else if (record.jerseyRetired && record.jerseyNumber != null) {
    out.banner = "retired";
    out.number = record.jerseyNumber;
  }
  const gear = record.sport ? GEAR_BY_SPORT[record.sport] : undefined;
  if (gear) out.gear = gear;
  return out;
}
