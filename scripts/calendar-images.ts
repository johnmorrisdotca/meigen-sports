// Writes docs/images/calendar-<theme>.svg: each calendar theme, 20 March 2026, light.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { CALENDAR_THEMES, calendarIcon } from "../src/calendarIcon.ts";

const out = new URL("../docs/images/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) if (/^calendar-.*\.svg$/.test(name)) rmSync(new URL(name, out));
for (const theme of CALENDAR_THEMES) {
  writeFileSync(new URL(`calendar-${theme}.svg`, out), `${calendarIcon({ theme, month: 3, day: 20, year: 2026, locale: "en", scheme: "light", size: 160 })}\n`);
}
// The Japanese calendar facts in the side columns (docs/japanese-calendar.md): a holiday, the old calendar date and the rokuyō.
writeFileSync(new URL("calendar-sun-japanese.svg", out), `${calendarIcon({ theme: "sun", month: 2, day: 11, year: 2026, locale: "ja", scheme: "light", size: 240, japanese: true })}\n`);
writeFileSync(new URL("calendar-roll-japanese.svg", out), `${calendarIcon({ theme: "roll", month: 7, day: 25, year: 2025, locale: "en", scheme: "light", size: 200, japanese: true })}\n`);
console.log(`${CALENDAR_THEMES.length} calendar pictures and 2 Japanese-calendar pictures in docs/images`);
