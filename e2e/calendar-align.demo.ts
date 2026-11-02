// Every calendar theme is measured in a real browser: its day is centred in its page (the same for 1, 9, 30 and 31), the day is one
// size, the year keeps its minimum size and its margin, a header runs edge to edge, and the drawing is centred in its box.
// Light and dark, with a year and without. The fonts of the machine draw the text numerals, so the text is held to a looser rule.
import { expect, test } from "@playwright/test";
import { CALENDAR_THEMES, CALENDAR_YEAR_CLEAR, CALENDAR_YEAR_MIN, calendarIcon, calendarLayout } from "../src/calendarIcon.ts";
import type { CalendarTheme } from "../src/calendarIcon.ts";
import { look } from "./calendarInk.ts";

const DATES = [[1, 1], [9, 9], [11, 30], [12, 31]] as const;
const SIZE = 240;
const CAP = 0.716;
/** Seen at an angle: a wider number measures taller, so the one-size rule is held to a looser height. */
const ANGLED: ReadonlySet<CalendarTheme> = new Set(["desk"]);
/** Themes whose day is stroke-drawn are centred to the pixel; a day drawn as text is held to a looser rule (3% of the page, or 6% of the font size), because each font draws its 1 narrow and a little left of its box by its own amount. */
const STROKED: ReadonlySet<CalendarTheme> = new Set(["flip", "curl", "soft", "thin"]);
/** Where a header must run edge to edge (a flat colour block that meets the frame): x, y, width, height. */
const HEADERS: Partial<Record<CalendarTheme, readonly [number, number, number, number]>> = {
  pins: [35, 70, 243, 30],
  loops: [59.5, 96, 210, 54],
  cartoon: [78, 134, 194, 7],
  soft: [92, 128, 226, 19],
};

for (const theme of CALENDAR_THEMES) {
  for (const scheme of ["light", "dark"] as const) {
    for (const year of [2026, undefined]) {
      test(`${theme} ${scheme} ${year ? "with" : "without"} a year: the day is centred, one size, and the year keeps its room`, async ({ page, browserName }) => {
        test.skip(browserName !== "chromium", "the measuring reads Chromium's own rendering");
        const layout = calendarLayout(theme, year !== undefined);
        const [px, py, pw, ph] = layout.page;
        const [bx, by, bw, bh] = layout.box;
        const boxes = [];
        for (const [month, day] of DATES) {
          const svg = calendarIcon({ theme, month, day, year, scheme, size: SIZE });
          const seen = await look(page, svg, ["day", "month", "year"], []);
          const d = seen.ink.day!;
          expect(d, `${day} is drawn`).not.toBeNull();
          const across = (d.x0 + d.x1) / 2 - (px + pw / 2);
          const at = `${theme} ${scheme} ${year ?? "-"} day ${day}`;
          expect(Math.abs(across), `${at}: the day's ink is ${across.toFixed(1)} units off the centre of its page`).toBeLessThanOrEqual(STROKED.has(theme) ? Math.max(1 / (SIZE / bw), 0.02 * pw) : Math.max(0.03 * pw, (0.06 * (d.y1 - d.y0)) / CAP));
          const block = [d, seen.ink.month, seen.ink.year].filter((one) => one !== null && one !== undefined && one.y0 >= py - 0.5 && one.y1 <= py + ph + 0.5);
          const top = Math.min(...block.map((one) => one!.y0));
          const bottom = Math.max(...block.map((one) => one!.y1));
          const down = (top + bottom) / 2 - (py + ph / 2);
          expect(Math.abs(down), `${at}: the block is ${down.toFixed(1)} units off the centre of its page`).toBeLessThanOrEqual(0.05 * ph);
          boxes.push({ day, height: d.y1 - d.y0, view: seen.view, all: seen.ink.all!, year: seen.ink.year });
          if (year !== undefined && layout.yearZone) {
            const y = seen.ink.year;
            expect(y, `${at}: the year is drawn`).not.toBeNull();
            const [zx, zy, zw, zh] = layout.yearZone;
            expect(y!.y1 - y!.y0, `${at}: the year is too small`).toBeGreaterThanOrEqual(CAP * CALENDAR_YEAR_MIN * bw * 0.9);
            expect(zy + zh - y!.y1, `${at}: the year is too near the bottom`).toBeGreaterThanOrEqual(CALENDAR_YEAR_CLEAR * bw);
            expect(y!.x0 >= zx - 0.5 && y!.x1 <= zx + zw + 0.5, `${at}: the year is outside its room`).toBe(true);
          }
        }
        const heights = boxes.map((b) => b.height);
        const tall = Math.max(...heights);
        const short = Math.min(...heights);
        expect(short / tall, `${theme} ${scheme} ${year ?? "-"}: the day is not one size (${heights.map((h) => h.toFixed(1)).join(", ")})`).toBeGreaterThanOrEqual(ANGLED.has(theme) ? 0.88 : 0.94);
        const { view, all } = boxes[0]!;
        const left = all.x0 - bx;
        const right = bx + bw - all.x1;
        expect(Math.abs(left - right), `${theme}: the drawing sits ${left.toFixed(1)} from the left and ${right.toFixed(1)} from the right of its box`).toBeLessThanOrEqual(0.025 * bw);
        const up = all.y0 - by;
        const down = by + bh - all.y1;
        expect(Math.abs(up - down), `${theme}: the drawing sits ${up.toFixed(1)} from the top and ${down.toFixed(1)} from the bottom of its box`).toBeLessThanOrEqual(0.04 * bh);
        expect(view.w).toBe(bw);
      });
    }

    const header = HEADERS[theme];
    if (header) {
      test(`${theme} ${scheme}: the header runs edge to edge`, async ({ page, browserName }) => {
        test.skip(browserName !== "chromium", "the measuring reads Chromium's own rendering");
        const [x, y, w, h] = header;
        const svg = calendarIcon({ theme, month: 11, day: 30, year: 2026, scheme, size: SIZE });
        const rows = [y + h * 0.25, y + h * 0.5, y + h * 0.75];
        const points = rows.flatMap((row) => [[x + 1.5, row], [x + w - 1.5, row]] as const);
        const { colours } = await look(page, svg, [], points);
        for (let i = 0; i < colours.length; i += 2) {
          const [l, r] = [colours[i]!, colours[i + 1]!];
          expect(l[3], `${theme}: left of the header is see-through`).toBe(255);
          expect(r[3], `${theme}: right of the header is see-through`).toBe(255);
          const apart = Math.max(...[0, 1, 2].map((c) => Math.abs(l[c]! - r[c]!)));
          expect(apart, `${theme} ${scheme}: the header's left and right edges are different colours (${l.slice(0, 3)} and ${r.slice(0, 3)})`).toBeLessThanOrEqual(24);
        }
      });
    }
  }
}
