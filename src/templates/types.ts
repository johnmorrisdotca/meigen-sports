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
  /** Explicit calendar day `YYYY-MM-DD`. Never read from the clock. Required for “years ago today” / “turns N”. */
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
