// Writes docs/images/calendar-<theme>.svg: each calendar theme, 20 March 2026, light.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { CALENDAR_THEMES, calendarIcon } from "../src/calendarIcon.ts";

const out = new URL("../docs/images/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) if (/^calendar-.*\.svg$/.test(name)) rmSync(new URL(name, out));
for (const theme of CALENDAR_THEMES) {
  writeFileSync(new URL(`calendar-${theme}.svg`, out), `${calendarIcon({ theme, month: 3, day: 20, year: 2026, locale: "en", scheme: "light", size: 160 })}\n`);
}
console.log(`${CALENDAR_THEMES.length} calendar pictures in docs/images`);
