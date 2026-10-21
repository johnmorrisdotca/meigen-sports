import { flagCode } from "@johnmorrisdotca/hata";
import { flagName } from "@johnmorrisdotca/hata/names";
import { flagOf } from "../src/index.ts";
import type { OnThisDayRecord } from "../src/schema.ts";
import { TROPHY_STANLEY_CUP } from "@johnmorrisdotca/dougu-sports/trophy/stanley-cup";
import { TROPHY_HART_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/hart-trophy";
import { TROPHY_VEZINA_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/vezina-trophy";
import { TROPHY_NORRIS_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/norris-trophy";
import { TROPHY_CALDER_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/calder-trophy";
import { TROPHY_ART_ROSS_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/art-ross-trophy";
import { TROPHY_CONN_SMYTHE_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/conn-smythe-trophy";
import { TROPHY_LADY_BYNG_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/lady-byng-trophy";
import { TROPHY_SELKE_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/selke-trophy";
import { TROPHY_JENNINGS_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/jennings-trophy";
import { TROPHY_MASTERTON_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/masterton-trophy";
import { TROPHY_KING_CLANCY_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/king-clancy-trophy";
import { TROPHY_JACK_ADAMS_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/jack-adams-trophy";
import { TROPHY_ROCKET_RICHARD_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/rocket-richard-trophy";
import { TROPHY_TED_LINDSAY_AWARD } from "@johnmorrisdotca/dougu-sports/trophy/ted-lindsay-award";
import { TROPHY_LOMBARDI_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/lombardi-trophy";
import { TROPHY_LARRY_OBRIEN_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/larry-obrien-trophy";
import { TROPHY_COMMISSIONERS_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/commissioners-trophy";
import { TROPHY_GREY_CUP } from "@johnmorrisdotca/dougu-sports/trophy/grey-cup";
import { TROPHY_CY_YOUNG_AWARD } from "@johnmorrisdotca/dougu-sports/trophy/cy-young-award";
import { TROPHY_MLB_MVP_AWARD } from "@johnmorrisdotca/dougu-sports/trophy/mlb-mvp-award";
import { TROPHY_SILVER_SLUGGER_AWARD } from "@johnmorrisdotca/dougu-sports/trophy/silver-slugger-award";
import { TROPHY_WORLD_SERIES_MVP_TROPHY } from "@johnmorrisdotca/dougu-sports/trophy/world-series-mvp-trophy";
import { TROPHY_OBRIEN_CUP } from "@johnmorrisdotca/dougu-sports/trophy/obrien-cup";
import { TROPHY_GOLD_GLOVE_AWARD } from "@johnmorrisdotca/dougu-sports/trophy/gold-glove-award";
import { TROPHY_CUP } from "@johnmorrisdotca/dougu-sports/trophy/cup";

/**
 * The demo's two small marks beside a fact: the flag of its country, only where the data says it is unambiguous (`flagOf`) and the flag set has one, and the
 * trophy it is about (`trophy`, an id of the emblem set), drawn as that very trophy where the set has a likeness and as its plain cup where it has none.
 * Both are the demo's own choice: the library holds a code and an id, and draws nothing. The packages are devDependencies of the demo, bundled into demo.js.
 */
const TROPHIES: Record<string, { svg: (options?: { size?: number; title?: string | false }) => string }> = {
  "trophy:stanley-cup": TROPHY_STANLEY_CUP,
  "trophy:hart-trophy": TROPHY_HART_TROPHY,
  "trophy:vezina-trophy": TROPHY_VEZINA_TROPHY,
  "trophy:norris-trophy": TROPHY_NORRIS_TROPHY,
  "trophy:calder-trophy": TROPHY_CALDER_TROPHY,
  "trophy:art-ross-trophy": TROPHY_ART_ROSS_TROPHY,
  "trophy:conn-smythe-trophy": TROPHY_CONN_SMYTHE_TROPHY,
  "trophy:lady-byng-trophy": TROPHY_LADY_BYNG_TROPHY,
  "trophy:selke-trophy": TROPHY_SELKE_TROPHY,
  "trophy:jennings-trophy": TROPHY_JENNINGS_TROPHY,
  "trophy:masterton-trophy": TROPHY_MASTERTON_TROPHY,
  "trophy:king-clancy-trophy": TROPHY_KING_CLANCY_TROPHY,
  "trophy:jack-adams-trophy": TROPHY_JACK_ADAMS_TROPHY,
  "trophy:rocket-richard-trophy": TROPHY_ROCKET_RICHARD_TROPHY,
  "trophy:ted-lindsay-award": TROPHY_TED_LINDSAY_AWARD,
  "trophy:lombardi-trophy": TROPHY_LOMBARDI_TROPHY,
  "trophy:larry-obrien-trophy": TROPHY_LARRY_OBRIEN_TROPHY,
  "trophy:commissioners-trophy": TROPHY_COMMISSIONERS_TROPHY,
  "trophy:grey-cup": TROPHY_GREY_CUP,
  "trophy:cy-young-award": TROPHY_CY_YOUNG_AWARD,
  "trophy:mlb-mvp-award": TROPHY_MLB_MVP_AWARD,
  "trophy:silver-slugger-award": TROPHY_SILVER_SLUGGER_AWARD,
  "trophy:world-series-mvp-trophy": TROPHY_WORLD_SERIES_MVP_TROPHY,
  "trophy:obrien-cup": TROPHY_OBRIEN_CUP,
  "trophy:gold-glove-award": TROPHY_GOLD_GLOVE_AWARD,
  "trophy:cup": TROPHY_CUP,
};

export interface FlagMark { readonly code: string; readonly src: string; readonly name: string }

/** The flag of a fact, a file under `flags/` (copied from Hata by scripts/site.ts), or null when the fact has no unambiguous flag or Hata has none for it. */
export function flagMark(fact: OnThisDayRecord, lang: "en" | "ja"): FlagMark | null {
  const wanted = flagOf(fact);
  const code = wanted ? flagCode(wanted) : null;
  if (!code) return null;
  return { code, src: `flags/${code.toLowerCase()}.svg`, name: flagName(code, lang) ?? code };
}

/** The trophy of a fact as SVG, or null when it has none; `exact` says whether it is that trophy's own likeness (false: the plain cup). */
export function trophyMark(fact: OnThisDayRecord, size = 34): { svg: string; exact: boolean } | null {
  const id = fact.trophy;
  const emblem = id ? TROPHIES[id] : undefined;
  if (!id || !emblem) return null;
  return { svg: emblem.svg({ size }), exact: id !== "trophy:cup" };
}
