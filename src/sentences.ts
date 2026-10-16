import type { OnThisDayRecord } from "./schema.ts";
import { render } from "./templates/render.ts";
import type { TemplateLocale } from "./templates/types.ts";

/** Default rendered sentence (`wording: "fixed"`). Static feeds store this beside the fields. */
export function captionFromFact(record: OnThisDayRecord, language: "en" | "ja" = "en"): string | null {
  return render(record, { wording: "fixed", locale: language as TemplateLocale })?.text ?? null;
}

/** True when a default template can run from the structured fields. */
export function isRichFact(record: OnThisDayRecord): boolean {
  if (record.datePrecision === "day" && record.eventDate && /-01-01$/.test(record.eventDate) && (record.category === "franchise-event" || record.category === "award")) {
    return false;
  }
  return captionFromFact(record, "en") != null;
}
