// The calendar-page drawings live in their own package now, @johnmorrisdotca/koyomi-calendars (the same code, the same bytes: its test compares 2,704 drawings with the ones
// this file used to make). This file keeps meigen-sports' own names and its seventeen themes: koyomi's eighteenth design, `squircle`, is not offered here yet.

import {
  CALENDAR_THEME_ALIASES as KOYOMI_ALIASES, CALENDAR_THEMES as KOYOMI_THEMES, CALENDAR_THEME_LABELS as KOYOMI_LABELS, calendarIcon as koyomiIcon, calendarMoon as koyomiMoon,
  calendarThemeOf as koyomiThemeOf, calendarWeekend as koyomiWeekend,
} from "@johnmorrisdotca/koyomi-calendars";
import type { CalendarDate as KoyomiDate, CalendarIconOptions as KoyomiOptions, CalendarTheme as KoyomiTheme } from "@johnmorrisdotca/koyomi-calendars";

export { CALENDAR_YEAR_CLEAR, CALENDAR_YEAR_MIN, calendarLayout } from "@johnmorrisdotca/koyomi-calendars";
export type { CalendarLayout } from "@johnmorrisdotca/koyomi-calendars";

/**
 * A day of the Gregorian calendar as three numbers.
 * @example
 * ```ts
 * import type { CalendarDate } from "@johnmorrisdotca/meigen-sports";
 * const day: CalendarDate = { year: 2026, month: 10, day: 20 };
 * console.log(day.month, day.day);
 * ```
 */
export type CalendarDate = KoyomiDate;
/**
 * What `calendarIcon` draws: the month and day, and the theme, size, language and colour scheme.
 * @example
 * ```ts
 * import type { CalendarIconOptions } from "@johnmorrisdotca/meigen-sports";
 * const options: CalendarIconOptions = { month: 10, day: 20, year: 2026, theme: "pins", scheme: "dark", size: 96 };
 * console.log(options.theme);
 * ```
 */
export type CalendarIconOptions = KoyomiOptions;
/**
 * The ten names of 0.12 and 0.13, still accepted: each reads as the theme that replaced it.
 * @example
 * ```ts
 * import { CALENDAR_THEME_ALIASES } from "@johnmorrisdotca/meigen-sports";
 * console.log(Object.keys(CALENDAR_THEME_ALIASES).length);
 * ```
 */
export const CALENDAR_THEME_ALIASES = KOYOMI_ALIASES;
/**
 * The phase of the moon at noon UTC on a date, in eighths of a lunation: 0 new, 2 first quarter, 4 full, 6 last quarter.
 * @param year - The year.
 * @param month - The month, 1 to 12.
 * @param day - The day of the month.
 * @returns A whole number from 0 to 7.
 * @example
 * ```ts
 * import { calendarMoon } from "@johnmorrisdotca/meigen-sports";
 * console.log(calendarMoon(2026, 11, 1));
 * ```
 */
export const calendarMoon: typeof koyomiMoon = koyomiMoon;
/**
 * The Saturday and the Sunday of the weekend a date is in.
 * @param year - The year.
 * @param month - The month, 1 to 12.
 * @param day - The day of the month.
 * @returns The Saturday and the Sunday, or `null` for a weekday.
 * @example
 * ```ts
 * import { calendarWeekend } from "@johnmorrisdotca/meigen-sports";
 * console.log(calendarWeekend(2026, 10, 31)?.sunday.day, calendarWeekend(2026, 10, 30));
 * ```
 */
export const calendarWeekend: typeof koyomiWeekend = koyomiWeekend;

/**
 * The themes of this package: the seventeen it has always had.
 * @example
 * ```ts
 * import type { CalendarTheme } from "@johnmorrisdotca/meigen-sports";
 * const theme: CalendarTheme = "pins";
 * console.log(theme);
 * ```
 */
export type CalendarTheme = Exclude<KoyomiTheme, "squircle">;
/**
 * The seventeen calendar-page themes, in the order the package has always listed them.
 * @example
 * ```ts
 * import { CALENDAR_THEMES } from "@johnmorrisdotca/meigen-sports";
 * console.log(CALENDAR_THEMES.length, CALENDAR_THEMES.slice(0, 4).join(" "));
 * ```
 */
export const CALENDAR_THEMES = KOYOMI_THEMES.filter((theme): theme is CalendarTheme => theme !== "squircle");
/**
 * The name of each theme in English and in Japanese, for a menu.
 * @example
 * ```ts
 * import { CALENDAR_THEME_LABELS } from "@johnmorrisdotca/meigen-sports";
 * console.log(CALENDAR_THEME_LABELS.pins.en, CALENDAR_THEME_LABELS.pins.ja);
 * ```
 */
export const CALENDAR_THEME_LABELS = Object.fromEntries(CALENDAR_THEMES.map((theme) => [theme, KOYOMI_LABELS[theme]])) as Record<CalendarTheme, { en: string; ja: string }>;

/**
 * The named theme (or an older name for one), or null when the word is not one of ours.
 * @param name - A theme's name, or an older name for one.
 * @returns The theme, or `null` when the word is not one of the package's themes.
 * @example
 * ```ts
 * import { calendarThemeOf } from "@johnmorrisdotca/meigen-sports";
 * console.log(calendarThemeOf("pins"), calendarThemeOf("nonsense"));
 * ```
 */
export function calendarThemeOf(name: string | null | undefined): CalendarTheme | null {
  const theme = koyomiThemeOf(name);
  return theme === "squircle" ? null : theme;
}

/**
 * An original calendar-page SVG for a month, day and optional year. The library does not read the clock.
 * @param options - The month and day, and the theme, size, language, colour scheme and the rest of what a page can show.
 * @returns The calendar page as an SVG string.
 * @example
 * ```ts
 * import { calendarIcon } from "@johnmorrisdotca/meigen-sports";
 * const svg = calendarIcon({ theme: "pins", month: 10, day: 20, year: 2026 });
 * console.log(svg.startsWith("<svg"));
 * ```
 */
export function calendarIcon(options: CalendarIconOptions): string {
  if (options.theme !== undefined && calendarThemeOf(options.theme) === null && koyomiThemeOf(options.theme) !== null) throw new RangeError(`unknown calendar theme: ${options.theme}`);
  return koyomiIcon(options);
}
