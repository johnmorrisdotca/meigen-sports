import type { OnThisDayRecord } from "./schema.ts";
import { render } from "./templates/render.ts";
import type { TemplateLocale } from "./templates/types.ts";

/**
 * Default rendered sentence (`wording: "fixed"`). Static feeds store this beside the fields.
 * @param record - A fact.
 * @param language - `en` or `ja`.
 * @returns The sentence, or `null` when the templates cannot say the fact from the fields it holds.
 * @example
 * ```ts
 * import { captionFromFact } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(captionFromFact(offline[0]!, "en"));
 * ```
 */
export function captionFromFact(record: OnThisDayRecord, language: "en" | "ja" = "en"): string | null {
  return render(record, { wording: "fixed", locale: language as TemplateLocale })?.text ?? null;
}

/**
 * True when a default template can name more than a name and a year.
 * @param record - A fact.
 * @returns `true` when a default sentence can say more than a name and a year.
 * @example
 * ```ts
 * import { isRichFact } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(isRichFact(offline[0]!));
 * ```
 */
export function isRichFact(record: OnThisDayRecord): boolean {
  if (record.datePrecision === "day" && record.eventDate && /-01-01$/.test(record.eventDate) && (record.category === "franchise-event" || record.category === "award")) {
    return false;
  }
  if (record.person?.qid === "Q704476") return false;
  const year = record.eventDate?.slice(0, 4);
  if (year && Number(year) < 1850 && (record.category === "player-birthday" || record.category === "player-death")) {
    return false;
  }
  return captionFromFact(record, "en") != null;
}
