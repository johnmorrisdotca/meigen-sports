// The Japanese calendar facts a date page can show (public holidays, the old calendar, the six-day cycle) live in @johnmorrisdotca/koyomi-calendars now, unchanged.
import {
  JAPANESE_HOLIDAY_YEARS as KOYOMI_HOLIDAY_YEARS, OLD_CALENDAR_YEARS as KOYOMI_OLD_YEARS, ROKUYO as KOYOMI_ROKUYO, japaneseHoliday as koyomiHoliday, japaneseHolidaysOf as koyomiHolidaysOf,
  oldCalendarDate as koyomiOldDate, rokuyoOf as koyomiRokuyoOf,
} from "@johnmorrisdotca/koyomi-calendars";
import type { JapaneseHoliday as KoyomiHoliday, OldDate as KoyomiOldDate, Rokuyo as KoyomiRokuyo } from "@johnmorrisdotca/koyomi-calendars";

/**
 * A Japanese public holiday named in Japanese and in English.
 * @example
 * ```ts
 * import type { JapaneseHoliday } from "@johnmorrisdotca/meigen-sports";
 * const holiday: JapaneseHoliday = { ja: "元日", en: "New Year's Day" };
 * console.log(holiday.en);
 * ```
 */
export type JapaneseHoliday = KoyomiHoliday;
/**
 * A date of the old lunisolar calendar: the month, the day and whether the month is a leap month.
 * @example
 * ```ts
 * import type { OldDate } from "@johnmorrisdotca/meigen-sports";
 * const date: OldDate = { month: 9, day: 1, leap: false };
 * console.log(date.month, date.day);
 * ```
 */
export type OldDate = KoyomiOldDate;
/**
 * One day of the six-day cycle, with its Japanese name, its reading and an English gloss.
 * @example
 * ```ts
 * import type { Rokuyo } from "@johnmorrisdotca/meigen-sports";
 * const day: Rokuyo = { ja: "大安", reading: "taian", en: "great peace" };
 * console.log(day.en);
 * ```
 */
export type Rokuyo = KoyomiRokuyo;
/**
 * The years whose public holidays are known: 2000 to 2099.
 * @example
 * ```ts
 * import { JAPANESE_HOLIDAY_YEARS } from "@johnmorrisdotca/meigen-sports";
 * console.log(JAPANESE_HOLIDAY_YEARS.join(" to "));
 * ```
 */
export const JAPANESE_HOLIDAY_YEARS = KOYOMI_HOLIDAY_YEARS;
/**
 * The years the old calendar's astronomy is held to: 1900 to 2100.
 * @example
 * ```ts
 * import { OLD_CALENDAR_YEARS } from "@johnmorrisdotca/meigen-sports";
 * console.log(OLD_CALENDAR_YEARS.join(" to "));
 * ```
 */
export const OLD_CALENDAR_YEARS = KOYOMI_OLD_YEARS;
/**
 * The six days of the rokuyo cycle, in order, with the reading and an English gloss.
 * @example
 * ```ts
 * import { ROKUYO } from "@johnmorrisdotca/meigen-sports";
 * console.log(ROKUYO.map((day) => day.en).join(", "));
 * ```
 */
export const ROKUYO = KOYOMI_ROKUYO;
/**
 * The public holiday of a day, in both languages.
 * @param year - The year, 2000 to 2099.
 * @param month - The month, 1 to 12.
 * @param dayOfMonth - The day of the month.
 * @returns The holiday, or `null` for a day with none or a year the rules do not cover.
 * @example
 * ```ts
 * import { japaneseHoliday } from "@johnmorrisdotca/meigen-sports";
 * console.log(japaneseHoliday(2027, 1, 1)?.en, japaneseHoliday(2027, 1, 2));
 * ```
 */
export const japaneseHoliday: typeof koyomiHoliday = koyomiHoliday;
/**
 * Every public holiday of a year, by `YYYY-MM-DD`.
 * @param year - The year, 2000 to 2099.
 * @returns A map from date to holiday, or `null` outside those years.
 * @example
 * ```ts
 * import { japaneseHolidaysOf } from "@johnmorrisdotca/meigen-sports";
 * console.log(japaneseHolidaysOf(2027)?.size, japaneseHolidaysOf(1990));
 * ```
 */
export const japaneseHolidaysOf: typeof koyomiHolidaysOf = koyomiHolidaysOf;
/**
 * The old-calendar date of a Gregorian date.
 * @param year - The year, 1900 to 2100.
 * @param month - The month, 1 to 12.
 * @param dayOfMonth - The day of the month.
 * @returns The old date, or `null` when the date is outside 1900 to 2100 or a new moon falls too near midnight in Japan to be sure.
 * @example
 * ```ts
 * import { oldCalendarDate } from "@johnmorrisdotca/meigen-sports";
 * console.log(oldCalendarDate(2026, 10, 20));
 * ```
 */
export const oldCalendarDate: typeof koyomiOldDate = koyomiOldDate;
/**
 * The rokuyo of a Gregorian date.
 * @param year - The year, 1900 to 2100.
 * @param month - The month, 1 to 12.
 * @param dayOfMonth - The day of the month.
 * @returns The day of the cycle, or `null` where the old-calendar date is not sure.
 * @example
 * ```ts
 * import { rokuyoOf } from "@johnmorrisdotca/meigen-sports";
 * console.log(rokuyoOf(2026, 10, 20)?.en);
 * ```
 */
export const rokuyoOf: typeof koyomiRokuyoOf = koyomiRokuyoOf;
