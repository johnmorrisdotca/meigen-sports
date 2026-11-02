/**
 * A language the sentences are written in: English or Japanese.
 * @example
 * ```ts
 * import type { TemplateLocale } from "@johnmorrisdotca/meigen-sports";
 * const locale: TemplateLocale = "ja";
 * console.log(locale);
 * ```
 */
export type TemplateLocale = "en" | "ja";
/**
 * Who a template may speak of: anyone, a living person or a dead one.
 * @example
 * ```ts
 * import type { TemplateGate } from "@johnmorrisdotca/meigen-sports";
 * const gate: TemplateGate = "neutral";
 * console.log(gate);
 * ```
 */
export type TemplateGate = "neutral" | "living" | "deceased";
/**
 * Whether a template is the default wording or a variant of it.
 * @example
 * ```ts
 * import type { TemplateRole } from "@johnmorrisdotca/meigen-sports";
 * const role: TemplateRole = "default";
 * console.log(role);
 * ```
 */
export type TemplateRole = "default" | "variant";
/**
 * The kind of statement a template makes: a birthday, a final, a record and the rest.
 * @example
 * ```ts
 * import type { TemplateType } from "@johnmorrisdotca/meigen-sports";
 * const type: TemplateType = "birthday";
 * console.log(type);
 * ```
 */
export type TemplateType =
  | "birthday" | "death" | "game" | "final" | "record" | "award"
  | "first" | "draft" | "venue" | "franchise" | "retired" | "all-star" | "feat"
  | "world-cup-match" | "world-cup-final" | "competition-start" | "competition-end" | "event-date";
/**
 * How a sentence is chosen from the templates: always the same, varied, or by the seed.
 * @example
 * ```ts
 * import type { Wording } from "@johnmorrisdotca/meigen-sports";
 * const wording: Wording = "seeded";
 * console.log(wording);
 * ```
 */
export type Wording = "fixed" | "varied" | "seeded";

/**
 * One committed sentence shape. Tokens in `pattern` are `{field}`. `needs` must all be present or the template is skipped.
 * @example
 * ```ts
 * import type { SentenceTemplate } from "@johnmorrisdotca/meigen-sports";
 * const template: SentenceTemplate = { id: "t1", type: "birthday", locale: "en", gate: "neutral", role: "default", needs: [], pattern: "{name} was born." };
 * console.log(template.pattern);
 * ```
 */
export interface SentenceTemplate {
  readonly id: string;
  readonly type: TemplateType;
  readonly locale: TemplateLocale;
  readonly gate: TemplateGate;
  readonly role: TemplateRole;
  readonly needs: readonly string[];
  readonly pattern: string;
  readonly when?: "tie" | "decisive" | "lopsided" | "series";
  /**
   * Says "today", "on this day", "turns 65" or "N years ago today". Eligible only when the day of the fact is the day being shown
   * (`asOf`). Every other template is true anywhere and carries the fact's date, at its precision, through `{dateLead}`, `{leadIn}`,
   * `{dateOn}` or `{date}`.
   */
  readonly day?: boolean;
}

/**
 * Every statement type the package says, in one list. A test holds each type to at least three patterns per language.
 * @example
 * ```ts
 * import { TEMPLATE_TYPES } from "@johnmorrisdotca/meigen-sports";
 * console.log(TEMPLATE_TYPES.length, TEMPLATE_TYPES[0]);
 * ```
 */
export const TEMPLATE_TYPES: readonly TemplateType[] = [
  "birthday", "death", "game", "final", "record", "award", "first", "draft", "venue", "franchise", "retired", "all-star", "feat",
  "world-cup-match", "world-cup-final", "competition-start", "competition-end", "event-date",
];

/**
 * How a sentence is worded: the style, the seed, the language and the day being shown.
 * @example
 * ```ts
 * import type { RenderOptions } from "@johnmorrisdotca/meigen-sports";
 * const options: RenderOptions = { locale: "en", wording: "seeded", seed: "card", asOf: "2026-10-20" };
 * console.log(options.locale);
 * ```
 */
export interface RenderOptions {
  readonly wording?: Wording;
  readonly seed?: string;
  readonly templateId?: string;
  readonly locale?: TemplateLocale;
  /**
   * The calendar day being shown, `YYYY-MM-DD`. Never read from the clock. The context of a sentence follows from it: when the fact's
   * day (month and day) is this day, "today" and "on this day" wording is allowed ("years ago today", "turns N"); in every other case,
   * and when `asOf` is absent, the sentence is true anywhere and says the full date of the fact at its precision
   * ("On July 4, 1945, ...", "born on July 7, 1960", "in July 1945", "in 1945").
   */
  readonly asOf?: string;
}

/**
 * A sentence, the template that made it and its language.
 * @example
 * ```ts
 * import type { RenderedSentence } from "@johnmorrisdotca/meigen-sports";
 * const sentence: RenderedSentence = { text: "A fact.", templateId: "t1", locale: "en" };
 * console.log(sentence.text);
 * ```
 */
export interface RenderedSentence {
  readonly text: string;
  readonly templateId: string;
  readonly locale: TemplateLocale;
}

/**
 * One sentence of a run, tied to the record it came from.
 * @example
 * ```ts
 * import type { RunSentence } from "@johnmorrisdotca/meigen-sports";
 * const sentence: RunSentence = { text: "A fact.", templateId: "t1", locale: "en", recordId: "r1", type: "birthday" };
 * console.log(sentence.recordId);
 * ```
 */
export interface RunSentence extends RenderedSentence {
  readonly recordId: string;
  readonly type: TemplateType;
}

/**
 * How `renderRun` words a list: a required seed, the language and the day being shown.
 * @example
 * ```ts
 * import type { RunOptions } from "@johnmorrisdotca/meigen-sports";
 * const options: RunOptions = { seed: "card", locale: "ja" };
 * console.log(options.seed);
 * ```
 */
export interface RunOptions {
  /** Required. The same seed and the same records always give the same sentences. */
  readonly seed: string;
  readonly locale?: TemplateLocale;
  readonly asOf?: string;
}
