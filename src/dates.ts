/**
 * Whether a date is an exact Gregorian calendar day (years 1–9999).
 * @param value - Text to test.
 * @returns `true` for an exact `YYYY-MM-DD` Gregorian date, else `false`.
 * @example
 * ```ts
 * import { isDate } from "@johnmorrisdotca/meigen-sports";
 * console.log(isDate("2024-02-29"), isDate("2023-02-29"));
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

/**
 * Extract a month/day from an explicit full date or an existing month/day. Leap day stays February 29.
 * @param date - `YYYY-MM-DD` or `MM-DD`.
 * @returns The month and day as `MM-DD`; throws a `RangeError` for anything that is not a date.
 * @example
 * ```ts
 * import { monthDayOf } from "@johnmorrisdotca/meigen-sports";
 * console.log(monthDayOf("2026-10-20"), monthDayOf("02-29"));
 * ```
 */
export function monthDayOf(date: string): string {
  if (isDate(date)) return date.slice(5);
  if (/^\d{2}-\d{2}$/.test(date) && isDate(`2000-${date}`)) return date;
  throw new RangeError("Expected a valid YYYY-MM-DD or MM-DD Gregorian date");
}
