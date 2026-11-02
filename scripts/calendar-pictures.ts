import { CALENDAR_THEMES, calendarIcon } from "../src/calendarIcon.ts";

/** The SVG pictures of docs/images that `calendarIcon` draws: each theme on 20 March 2026 (light), and the Japanese calendar facts in the side columns of `sun` and `roll`. A test holds the committed files to these. */
export function calendarPictures(): Map<string, string> {
  const pictures = new Map<string, string>();
  for (const theme of CALENDAR_THEMES) pictures.set(`calendar-${theme}.svg`, `${calendarIcon({ theme, month: 3, day: 20, year: 2026, locale: "en", scheme: "light", size: 160 })}\n`);
  pictures.set("calendar-sun-japanese.svg", `${calendarIcon({ theme: "sun", month: 2, day: 11, year: 2026, locale: "ja", scheme: "light", size: 240, japanese: true })}\n`);
  pictures.set("calendar-roll-japanese.svg", `${calendarIcon({ theme: "roll", month: 7, day: 25, year: 2025, locale: "en", scheme: "light", size: 200, japanese: true })}\n`);
  return pictures;
}
