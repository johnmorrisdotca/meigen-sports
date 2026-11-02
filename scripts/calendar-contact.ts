// A contact sheet of every calendar theme at 1, 9, 30 and 31, light and dark, with and without a year: node scripts/calendar-contact.ts <out.png> [size]
import { writeFileSync } from "node:fs";
import process from "node:process";
import { chromium } from "@playwright/test";
import { CALENDAR_THEMES, calendarIcon } from "../src/calendarIcon.ts";

const out = process.argv[2];
if (!out) throw new Error("usage: node scripts/calendar-contact.ts <out.png> [size]");
const size = Number(process.argv[3] ?? 84);
const DAYS = [1, 9, 30, 31];
const groups = [
  { scheme: "light", year: 2026 },
  { scheme: "light", year: undefined },
  { scheme: "dark", year: 2026 },
  { scheme: "dark", year: undefined },
] as const;
const cell = (theme: (typeof CALENDAR_THEMES)[number], day: number, g: (typeof groups)[number]) =>
  `<div class="c">${calendarIcon({ theme, month: day === 9 ? 9 : 10, day, year: g.year, scheme: g.scheme, size })}</div>`;
const half = (scheme: string) => groups.filter((g) => g.scheme === scheme);
const row = (theme: (typeof CALENDAR_THEMES)[number]) =>
  `<div class="r"><b>${theme}</b>${(["light", "dark"] as const).map((s) => `<div class="h ${s}">${half(s).map((g) => `<div class="g">${DAYS.map((d) => cell(theme, d, g)).join("")}</div>`).join("")}</div>`).join("")}</div>`;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;font:12px system-ui;background:#ccc}
.r{display:flex;align-items:center;gap:6px;padding:2px 4px}
b{width:52px;font-weight:600}
.h{display:flex;gap:10px;padding:4px 6px}
.light{background:#f1efe9}.dark{background:#16181a}
.g{display:flex;gap:2px;padding:0 4px;border-right:1px solid #8884}
.c{width:${size}px;height:${size + 4}px;display:flex;align-items:center;justify-content:center}
</style><div id="s">${CALENDAR_THEMES.map(row).join("")}</div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1900, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html);
writeFileSync(out, await page.locator("#s").screenshot({ type: "png" }));
await browser.close();
