export type TemplateLocale = "en" | "ja";
export type TemplateGate = "neutral" | "living" | "deceased";
export type TemplateRole = "default" | "variant";
export type TemplateType =
  | "birthday" | "death" | "game" | "final" | "record" | "award"
  | "first" | "draft" | "venue" | "franchise"
  | "world-cup-match" | "world-cup-final" | "competition-start" | "competition-end" | "event-date";
export type Wording = "fixed" | "varied" | "seeded";

/** One committed sentence shape. Tokens in `pattern` are `{field}`. `needs` must all be present or the template is skipped. */
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

/** Every statement type the package says, in one list. A test holds each type to at least three patterns per language. */
export const TEMPLATE_TYPES: readonly TemplateType[] = [
  "birthday", "death", "game", "final", "record", "award", "first", "draft", "venue", "franchise",
  "world-cup-match", "world-cup-final", "competition-start", "competition-end", "event-date",
];

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

export interface RenderedSentence {
  readonly text: string;
  readonly templateId: string;
  readonly locale: TemplateLocale;
}

/** One sentence of a run, tied to the record it came from. */
export interface RunSentence extends RenderedSentence {
  readonly recordId: string;
  readonly type: TemplateType;
}

export interface RunOptions {
  /** Required. The same seed and the same records always give the same sentences. */
  readonly seed: string;
  readonly locale?: TemplateLocale;
  readonly asOf?: string;
}
