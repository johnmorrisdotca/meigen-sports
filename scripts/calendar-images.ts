// Writes docs/images/calendar-*.svg (scripts/calendar-pictures.ts): each calendar theme, 20 March 2026, light, and the Japanese calendar pages.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { calendarPictures } from "./calendar-pictures.ts";

const out = new URL("../docs/images/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) if (/^calendar-.*\.svg$/.test(name)) rmSync(new URL(name, out));
const pictures = calendarPictures();
for (const [name, svg] of pictures) writeFileSync(new URL(name, out), svg);
console.log(`${pictures.size} calendar pictures in docs/images`);
