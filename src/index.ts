import type { FeedContext, MeigenRecord } from "./types.ts";
export type { Citation, EntityRef, FeedContext, FeedManifest, FeedShard, MeigenRecord, SourceSnapshot } from "./types.ts";
export type {
  DatePrecision, ExtractCategory, ExtractSource, OnThisDayRecord, PersonRef, TeamRef,
} from "./schema.ts";
export { EXTRACT_CATEGORIES } from "./schema.ts";
export { SCHEMA_VERSION, VERSION } from "./version.ts";

/** Whether a date is an exact Gregorian calendar day (years 1–9999).
 * @example
 * ```ts
 * import { isDate } from "@johnmorrisdotca/meigen-sports";
 * console.log(isDate("2024-02-29"));
 * // → true
 * ```
 */
export function isDate(value: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return false;
  const [, y, m, d] = parts;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

/** Extract a month/day from an explicit full date or an existing month/day. Leap day stays February 29.
 * @param date - YYYY-MM-DD or MM-DD; invalid dates throw RangeError.
 * @returns MM-DD, without reading the clock or shifting timezones.
 * @example
 * ```ts
 * import { monthDayOf } from "@johnmorrisdotca/meigen-sports";
 * console.log(monthDayOf("2026-10-14"));
 * // → 10-14
 * ```
 */
export function monthDayOf(date: string): string {
  if (isDate(date)) return date.slice(5);
  if (/^\d{2}-\d{2}$/.test(date) && isDate(`2000-${date}`)) return date;
  throw new RangeError("Expected a valid YYYY-MM-DD or MM-DD Gregorian date");
}

/** Filter records by explicit context. Multiple filters intersect; values inside a filter match any.
 * Names are never used as identity matches. Returned arrays are new; input records are unchanged.
 * @param records - Caller-owned records or a bundled data entry.
 * @param context - Sport slugs, verified entity IDs, kinds, language or a plain text query.
 * @returns Matching records in their original order.
 * @example
 * ```ts
 * import { selectRecords } from "@johnmorrisdotca/meigen-sports";
 * console.log(selectRecords([], { sports: ["boxing"] }).length);
 * // → 0
 * ```
 */
export function selectRecords(records: readonly MeigenRecord[], context: FeedContext = {}): MeigenRecord[] {
  const query = context.query?.trim().normalize("NFKC").toLocaleLowerCase("en");
  return records.filter((record) =>
    (!context.includeSources?.length || context.includeSources.includes(record.source.sourceId)) &&
    (!context.excludeSources?.includes(record.source.sourceId)) &&
    (!context.types?.length || context.types.some((type) => record.types.includes(type))) &&
    (!context.excludeTypes?.some((type) => record.types.includes(type))) &&
    (!context.sports?.length || context.sports.some((sport) => record.sports.includes(sport))) &&
    (!context.entityIds?.length || record.entities.some((entity) => context.entityIds?.includes(entity.id))) &&
    (!context.kinds?.length || context.kinds.includes(record.kind)) &&
    (!context.language || record.language === context.language) &&
    (!query || `${record.text} ${record.speaker ?? ""} ${record.source.title}`.normalize("NFKC").toLocaleLowerCase("en").includes(query)));
}

/** Historical facts whose actual source date matches the requested day.
 * @param records - Facts and/or quotations; undated quotations are never turned into anniversaries.
 * @param date - An explicit YYYY-MM-DD (future facts excluded) or MM-DD (all recorded years).
 * @param context - Optional sport/entity/language filters.
 * @returns Matching facts sorted by source date and stable ID.
 * @example
 * ```ts
 * import { historyOnDate } from "@johnmorrisdotca/meigen-sports";
 * console.log(historyOnDate([], "02-29").length);
 * // → 0
 * ```
 */
export function historyOnDate(records: readonly MeigenRecord[], date: string, context: FeedContext = {}): MeigenRecord[] {
  const day = monthDayOf(date), ceiling = isDate(date) ? date : null;
  return selectRecords(records, context).filter((record) => record.kind === "history" && record.monthDay === day && record.date !== null && (!ceiling || record.date <= ceiling))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id));
}

/** Pick a repeatable quotation for an explicit date and context; this does not claim it was said that day.
 * @param records - Source-verified quotations, optionally mixed with history facts.
 * @param date - YYYY-MM-DD or MM-DD; the same date/context/input gives the same choice.
 * @param context - Optional sport/entity/language filters, with no hidden fallback.
 * @returns A quotation or null when the requested context has none.
 * @example
 * ```ts
 * import { quoteForDate } from "@johnmorrisdotca/meigen-sports";
 * console.log(quoteForDate([], "2026-10-14"));
 * // → null
 * ```
 */
export function quoteForDate(records: readonly MeigenRecord[], date: string, context: FeedContext = {}): MeigenRecord | null {
  monthDayOf(date);
  const quotes = selectRecords(records, context).filter((record) => record.kind === "quote").sort((a, b) => a.id.localeCompare(b.id));
  if (!quotes.length) return null;
  let hash = 2166136261;
  for (const char of date) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return quotes[hash % quotes.length];
}
