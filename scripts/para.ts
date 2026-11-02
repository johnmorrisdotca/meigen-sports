import { readFileSync } from "node:fs";

/** The para sports the package publishes (data-sources/para-sports.json), by sport code, and `paralympics`, the Games themselves. */
interface ParaSports {
  readonly sports: readonly { readonly qid: string; readonly slug: string; readonly label: string; readonly who: string; readonly en: string; readonly ja: string }[];
  readonly gamesSlug: string;
  readonly gamesName: { readonly en: string; readonly ja: string };
}
export const PARA: ParaSports = JSON.parse(readFileSync(new URL("../data-sources/para-sports.json", import.meta.url), "utf8")) as ParaSports;
export const PARA_SLUGS: ReadonlySet<string> = new Set([...PARA.sports.map((s) => s.slug), PARA.gamesSlug]);
/** The name of each para sport in the demo's two languages (sport code to words). */
export const paraWords = (language: "en" | "ja"): Record<string, string> => ({ ...Object.fromEntries(PARA.sports.map((s) => [s.slug, s[language]])), [PARA.gamesSlug]: PARA.gamesName[language] });
export const isParaSport = (sport: string | null | undefined): boolean => PARA_SLUGS.has(sport ?? "");

/** A class code (T54, S9, SB5, BC1, SH6, PR2, WH1 ...) or the word for one. Never in a fact. */
export const CLASS_CODE = /\b(?:[TF]\d{2}(?:[-–/]\d{2})*|S\d{1,2}|SB\d{1,2}|SM\d{1,2}|BC\s?[1-4]|B[1-3]|WH[12]|SH\d|SL[34]|SU5|LW\s?\d{1,2}|PR\d|H[1-5]|C[1-5]|PTWC|RP\d)\b|\bclass(?:es|ification)?\b|\bcategory\b/;
/** A word for the body. Never in a fact about a para sport. */
export const HEALTH = /\b(?:impair\w*|disab\w*|handicap\w*|blind\w*|deaf\w*|visual\w*|intellectual\w*|amput\w*|cerebral|palsy|paraplegi\w*|quadriplegi\w*|tetraplegi\w*|spinal|dwarf\w*|polio\w*|autis\w*|syndrome|diagnos\w*|condition|illness|disease|cancer|limb|vision|mobility|stroke|injur\w*|quads?|ambulant)\b/i;
