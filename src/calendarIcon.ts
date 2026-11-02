// The calendar-page drawings live in their own package now, @johnmorrisdotca/koyomi-calendars (the same code, the same bytes: its test compares 2,704 drawings with the ones
// this file used to make). This file keeps meigen-sports' own names and its seventeen themes: koyomi's eighteenth design, `squircle`, is not offered here yet.

import { CALENDAR_THEMES as KOYOMI_THEMES, CALENDAR_THEME_LABELS as KOYOMI_LABELS, calendarIcon as koyomiIcon, calendarThemeOf as koyomiThemeOf } from "@johnmorrisdotca/koyomi-calendars";
import type { CalendarIconOptions, CalendarTheme as KoyomiTheme } from "@johnmorrisdotca/koyomi-calendars";

export { CALENDAR_THEME_ALIASES, CALENDAR_YEAR_CLEAR, CALENDAR_YEAR_MIN, calendarLayout, calendarMoon, calendarWeekend } from "@johnmorrisdotca/koyomi-calendars";
export type { CalendarDate, CalendarIconOptions, CalendarLayout } from "@johnmorrisdotca/koyomi-calendars";

/** The themes of this package: the seventeen it has always had. */
export type CalendarTheme = Exclude<KoyomiTheme, "squircle">;
export const CALENDAR_THEMES = KOYOMI_THEMES.filter((theme): theme is CalendarTheme => theme !== "squircle");
export const CALENDAR_THEME_LABELS = Object.fromEntries(CALENDAR_THEMES.map((theme) => [theme, KOYOMI_LABELS[theme]])) as Record<CalendarTheme, { en: string; ja: string }>;

/** The named theme (or an older name for one), or null when the word is not one of ours. */
export function calendarThemeOf(name: string | null | undefined): CalendarTheme | null {
  const theme = koyomiThemeOf(name);
  return theme === "squircle" ? null : theme;
}

/** An original calendar-page SVG for a month, day and optional year. The library does not read the clock. */
export function calendarIcon(options: CalendarIconOptions): string {
  if (options.theme !== undefined && calendarThemeOf(options.theme) === null && koyomiThemeOf(options.theme) !== null) throw new RangeError(`unknown calendar theme: ${options.theme}`);
  return koyomiIcon(options);
}
