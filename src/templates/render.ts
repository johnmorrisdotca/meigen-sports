import type { OnThisDayRecord, TeamRef } from "../schema.ts";
import type { MeigenRecord } from "../types.ts";
import { TEMPLATES } from "./catalog.ts";
import { cleanLabel, hasPlaceholder } from "./labels.ts";
import type { FragmentId } from "./phrases.ts";
import type {
  RenderedSentence, RenderOptions, SentenceTemplate, TemplateLocale, TemplateType, Wording,
} from "./types.ts";
import { hash32 } from "./render-dates.ts";
import type { Subject } from "./render-fields.ts";
import { subjectOfHistory, subjectOfFact } from "./render-subject.ts";


export { factDate, dateNote, dayContext, hash32 } from "./render-dates.ts";
export type { When } from "./render-dates.ts";
export type { Subject } from "./render-fields.ts";


/**
 * The name a sentence gives a league: the code in capitals (`NHL`) or the full name (`National Association`).
 * @example
 * ```ts
 * import { LEAGUE_LABEL } from "@johnmorrisdotca/meigen-sports";
 * console.log(LEAGUE_LABEL["nhl"]);
 * ```
 */
export const LEAGUE_LABEL: Readonly<Record<string, string>> = {
  nhl: "NHL", nba: "NBA", mlb: "MLB", nfl: "NFL", cfl: "CFL", mls: "MLS",
  wc: "World Cup", wwc: "Women's World Cup", afl: "AFL", aafc: "AAFC",
  nha: "NHA", pcha: "PCHA", wchl: "WCHL", wha: "WHA",
  na: "National Association", aa: "American Association", ua: "Union Association", pl: "Players' League", fl: "Federal League",
};

/** A record's `event` is a closed list; only the four that read as a verb are rendered. */
export const RECORD_VERB: Record<string, FragmentId> = {
  set: "recordSet", held: "recordHeld", equalled: "recordEqualled", surpassed: "recordSurpassed",
};
export const RECORD_BY: Record<string, FragmentId> = {
  set: "recordSetBy", held: "recordHeldBy", equalled: "recordEqualledBy", surpassed: "recordBrokenBy",
};

/** A place that is a venue, not a town: it is "at" it ("at Wembley Stadium"), where a city or a country is "in" it. */
export const VENUE_WORDS = /\b(?:Stadium|Stadion|Stadio|Arena|Circuit|Park|Field|Grounds?|Centre|Center|Gardens?|Dome|Hall|Course|Raceway|Speedway|Velodrome|Coliseum|Pavilion|Gymnasium|Gimnasio|Palacio|Hippodrome|Bowl|Oval|Complex|Autodromo|Autódromo|Ring|Lake|Piste|Pool|Aquatics|Club|Links|Court|Courts|Theatre|Theater|Road|Casino|Hotel|Auditorium|Fairgrounds?|Racecourse|Showgrounds?)\b/i;

export function leagueLabel(record: OnThisDayRecord): string {
  const code = record.league ?? record.competition;
  if (!code) return "";
  return LEAGUE_LABEL[code] ?? code.toUpperCase();
}

export function teamName(team: TeamRef | undefined): string {
  return cleanLabel(team?.name);
}

export function factType(record: OnThisDayRecord): TemplateType | null {
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
    case "retired-number": return "retired";
    case "all-star": return "all-star";
    case "game-feat": return "feat";
    case "player-feat": return "player-feat";
    case "first": return "first";
    default: return null;
  }
}

/** Picks an alternate for each fragment. `fixed` always takes the first, so a published default sentence never moves. */
export type Chooser = (id: FragmentId) => (count: number) => number;

function chooserFor(wording: Wording, seed: string, recordId: string, locale: TemplateLocale): Chooser {
  if (wording === "fixed") return () => () => 0;
  return (id) => (count) => hash32(`${seed}:${recordId}:${locale}:fragment:${id}`) % count;
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

/**
 * Render a sentence from committed templates and the fact's fields. Never guesses a missing field.
 * @param record - A fact.
 * @param options - The language, wording, seed and the day being shown.
 * @returns A sentence with the template that made it, or `null` when no template fits the fields the fact holds.
 * @example
 * ```ts
 * import { render } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(render(offline[0]!, { locale: "en", seed: "card" })?.text);
 * ```
 */
export function render(record: OnThisDayRecord, options: RenderOptions = {}): RenderedSentence | null {
  guard(options);
  const locale: TemplateLocale = options.locale ?? "en";
  const wording = options.wording ?? "fixed";
  const seed = options.seed ?? record.recordId;
  const prepared = prepare(record, locale, wording, seed, options.asOf);
  return prepared ? finish(prepared, record.recordId, locale, wording, seed, options.templateId) : null;
}

/**
 * Render a bundled history row (a World Cup match, a competition's start or end, a dated event) in prose. `null` for quotations and lines it does not know.
 * @param record - A bundled history row.
 * @param options - The language, wording, seed and the day being shown.
 * @returns A sentence, or `null` for a quotation or a line the templates do not know.
 * @example
 * ```ts
 * import { renderHistory } from "@johnmorrisdotca/meigen-sports";
 * import history from "@johnmorrisdotca/meigen-sports/history";
 * console.log(renderHistory(history[0]!, { locale: "en", seed: "card" })?.text);
 * ```
 */
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

/**
 * The committed sentence templates of one statement type in one language.
 * @param type - A statement type such as `birthday`.
 * @param locale - `en` or `ja`.
 * @returns The templates, in their committed order.
 * @example
 * ```ts
 * import { templatesFor } from "@johnmorrisdotca/meigen-sports";
 * console.log(templatesFor("birthday", "en").length > 0);
 * ```
 */
export function templatesFor(type: TemplateType, locale: TemplateLocale = "en"): readonly SentenceTemplate[] {
  return TEMPLATES.filter((row) => row.type === type && row.locale === locale);
}