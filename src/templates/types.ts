export type TemplateLocale = "en" | "ja";
export type TemplateGate = "neutral" | "living" | "deceased";
export type TemplateRole = "default" | "variant";
export type TemplateType =
  | "birthday" | "death" | "game" | "final" | "record" | "award"
  | "first" | "draft" | "venue" | "franchise";
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
  readonly when?: "tie" | "decisive";
}

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
