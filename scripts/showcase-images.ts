// Makes the README's and the docs' still pictures of the calendar icons, the four layouts, today cards, banners, facts by sport and the
// gallery of every theme, and two moving ones (the centre of a row ticks through days, or through the themes) into docs/images.
// Every drawing is the package's own (`calendarIcon`, `displayMarkup`, `renderRun` over the real fact files in `site/data/`), the page
// rules are the shipped `styles.css`, and each picture is a light and a dark twin (the gallery sheets show both on one picture).
// Playwright takes a png of each sheet; `cwebp` and `img2webp` (libwebp's tools: `brew install webp`) write the webp files. Nothing is
// served: the pages are written straight into the browser, so no port is used.
//
//   node scripts/showcase-images.ts                    all of them (needs the site built, for its fact files: `pnpm images:showcase` builds it first)
//   ONLY=hero-icons,themes node scripts/showcase-images.ts   some of them (hero-icons, themes, tearoff, layouts, today, banners, sports, gallery, centre)
//   THEMES=sun,roll                                    the gallery sheets of these themes only
//   IMAGES_OUT=dir                                     writes somewhere else than docs/images
//   SLOW=2                                             how many times longer than a scene says each step of a moving picture stays (2: half the speed)
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import type { Page } from "@playwright/test";
import { CALENDAR_THEME_LABELS, CALENDAR_THEMES, calendarIcon, calendarWeekend, displayMarkup, rankFeed, renderRun } from "../src/index.ts";
import type { CalendarTheme, OnThisDayRecord } from "../src/index.ts";

const root = new URL("..", import.meta.url).pathname;
const facts = join(root, "site", "data", "v1", "0.1.0", "facts");
const out = process.env.IMAGES_OUT ?? join(root, "docs", "images");
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const slow = Number(process.env.SLOW ?? 2);
const MAX_BYTES = 1.5 * 1024 * 1024;
const WIDTH = 760;
type Scheme = "light" | "dark";
type Locale = "en" | "ja";

for (const tool of ["cwebp", "img2webp"]) if (spawnSync(tool, ["-version"], { stdio: "ignore" }).status === null) throw new Error(`${tool} is not installed: brew install webp`);
mkdirSync(out, { recursive: true });

const read = <T>(path: string): T => JSON.parse(readFileSync(join(facts, path), "utf8")) as T;
const dayOf = (monthDay: string): OnThisDayRecord[] => read<{ records: OnThisDayRecord[] }>(`days/${monthDay}.json`).records;
const worded = (records: readonly OnThisDayRecord[], asOf: string, locale: Locale = "en"): Map<string, string> =>
  new Map(renderRun(records, { seed: "readme", locale, asOf }).map((row) => [row.recordId, row.text]));
/** The fact of a day that names someone or something, worded for that day. */
function pick(monthDay: string, mention: string, locale: Locale = "en"): { record: OnThisDayRecord; text: string } {
  const records = rankFeed(dayOf(monthDay), 12);
  const record = records.find((one) => JSON.stringify(one).includes(mention));
  if (!record) throw new Error(`${monthDay}: no fact mentions ${mention}`);
  return { record, text: worded(records, `2026-${monthDay}`, locale).get(record.recordId) ?? "" };
}
/** The best fact of a sport that is short enough to read in a card, worded for the day the pictures are made. */
function bestOfSport(sport: string): { record: OnThisDayRecord; text: string } {
  const records = rankFeed(read<{ records: OnThisDayRecord[] }>(`feeds/sports/${sport}.json`).records, 12);
  const text = worded(records, "2026-10-30");
  const record = records.find((one) => (text.get(one.recordId) ?? "").length > 40 && (text.get(one.recordId) ?? "").length <= 150 && one.eventDate);
  if (!record) throw new Error(`${sport}: no short fact`);
  return { record, text: text.get(record.recordId) ?? "" };
}
const escape = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const credit = (record: OnThisDayRecord): string => {
  const who = record.source.attribution || record.source.sourceId;
  const licence = record.source.licence;
  return escape(licence && !who.includes(licence.split(" ")[0]!) ? `${who} · ${licence}` : who);
};
const dateOf = (record: OnThisDayRecord): { month: number; day: number; year: number } => {
  const [year, month, day] = (record.eventDate ?? "2026-01-01").split("-").map(Number) as [number, number, number];
  return { month, day, year };
};

/** One drawing inside the package's own `.meigen-cal` box, `size` pixels wide. */
function icon(theme: CalendarTheme, month: number, day: number, options: { year?: number; locale?: Locale; scheme: Scheme; size: number }): string {
  const svg = calendarIcon({ theme, month, day, year: options.year, locale: options.locale ?? "en", scheme: options.scheme, size: options.size });
  return `<span class="meigen-cal" style="width:${options.size}px">${svg}</span>`;
}

const slot = (inner: string, height: number): string => `<div style="height:${height}px;display:flex;align-items:center;justify-content:center">${inner}</div>`;
const STYLE = `
:root{--page:#f4efe4;--ink:#1f2320;--muted:#6b6f68;--rule:#ddd6c6;--surface:#fbf8f1;--accent:#b5452c;--font:system-ui,-apple-system,"Hiragino Sans","Segoe UI",sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
@media(prefers-color-scheme:dark){:root{--page:#141614;--ink:#ece8dc;--muted:#a09d93;--rule:#3a3d38;--surface:#1d201e}}
*{box-sizing:border-box}html,body{margin:0;background:var(--page);color:var(--ink);font-family:var(--font)}
#sheet{width:${WIDTH}px;padding:18px;background:var(--page)}
h3{margin:0 0 12px;font-size:20px;letter-spacing:-.01em}
.kind{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
.src{font-size:12px;color:var(--muted)}
.panel{background:var(--surface);border:1px solid var(--rule);border-radius:16px;padding:16px 18px}
.row{display:flex;justify-content:space-between;align-items:flex-end}
.cell{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:13px;color:var(--muted);text-align:center}
.cell b{color:var(--ink);font-size:14px}
.grid7{display:grid;grid-template-columns:repeat(7,1fr);gap:16px 6px;align-items:end}
.grid6{display:grid;grid-template-columns:repeat(6,1fr);gap:16px 6px;align-items:end}
.card{display:grid;grid-template-columns:auto 1fr;gap:0 22px;align-items:center}
.card p.s{font-size:22px;line-height:1.4;margin:6px 0 8px}
.small .card p.s{font-size:17px}
.dark-band{background:#161816;color:#ece8dc;--ink:#ece8dc;--muted:#a09d93;--rule:#3a3d38;--surface:#1d201e;border-radius:16px;padding:16px 18px}
.light-band{background:#fbf8f1;color:#1f2320;--ink:#1f2320;--muted:#6b6f68;--rule:#ddd6c6;--surface:#fbf8f1;border-radius:16px;padding:16px 18px;border:1px solid #ddd6c6}
`;
const CSS = readFileSync(join(root, "styles.css"), "utf8");

async function shoot(page: Page, name: string, scheme: Scheme | null, html: string): Promise<string> {
  await page.emulateMedia({ colorScheme: scheme ?? "light" });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${STYLE}${CSS}</style><div id="sheet">${html}</div>`);
  const file = join(work, `${name}.png`);
  writeFileSync(file, await page.locator("#sheet").screenshot({ type: "png" }));
  return file;
}
function still(png: string, name: string): void {
  const target = join(out, `${name}.webp`);
  const run = spawnSync("cwebp", ["-quiet", "-q", "90", "-m", "6", png, "-o", target], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`cwebp failed: ${run.stderr}`);
  console.log(`ok   ${name}.webp  ${Math.round(statSync(target).size / 1024)} kB`);
}
/** A still picture, in its light and dark twin. */
async function twin(name: string, html: (scheme: Scheme) => string): Promise<void> {
  for (const scheme of ["light", "dark"] as const) still(await shoot(await newPage(scheme), `${name}-${scheme}`, scheme, html(scheme)), `${name}-${scheme}`);
}
const browser = await chromium.launch();
const pages = new Map<Scheme, Page>();
async function newPage(scheme: Scheme): Promise<Page> {
  let page = pages.get(scheme);
  if (!page) {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: 700 }, colorScheme: scheme, deviceScaleFactor: 2, reducedMotion: "reduce" });
    page = await context.newPage();
    pages.set(scheme, page);
  }
  return page;
}

const wanted = (name: string): boolean => !only || only.includes(name);
const label = (theme: CalendarTheme, locale: Locale): string => CALENDAR_THEME_LABELS[theme][locale];

// ----- The hero: a today card and all the themes under it.
async function heroIcons(): Promise<void> {
  const fact = pick("10-20", "Mickey Mantle");
  await twin("hero-icons", (scheme) => `<div class="panel card" style="margin-bottom:14px">${icon("pins", 10, 20, { year: 2026, scheme, size: 150 })}<div><span class="kind">Today in sports history</span><p class="s">${escape(fact.text)}</p><div class="src">${credit(fact.record)}</div></div></div>
<div class="panel"><div class="grid6">${CALENDAR_THEMES.map((theme) => `<div class="cell">${slot(icon(theme, 10, 20, { year: 2026, scheme, size: 84 }), 108)}<b>${label(theme, "en")}</b></div>`).join("")}</div></div>`);
}

// ----- Every theme, in rows of six, with its name.
async function themes(): Promise<void> {
  await twin("themes", (scheme) => `<div class="grid6">${CALENDAR_THEMES.map((theme) => `<div class="cell">${slot(icon(theme, 3, 20, { year: 2026, scheme, size: 96 }), 124)}<b>${label(theme, "en")}</b><code style="font:12px var(--mono)">${theme}</code></div>`).join("")}</div>`);
  await twin("themes-ja", (scheme) => `<div class="grid6">${CALENDAR_THEMES.map((theme) => `<div class="cell">${slot(icon(theme, 3, 20, { year: 2026, locale: "ja", scheme, size: 96 }), 124)}<b>${label(theme, "ja")}</b></div>`).join("")}</div>`);
}

// ----- The tear-off pages: the three themes, then the weekend page of the two that have one, over a fixed-date holiday of Japan.
async function tearoff(): Promise<void> {
  const HOLIDAY = { "01-01": { en: "New Year's Day", ja: "元日" } };
  await twin("tearoff", (scheme) => {
    const one = (theme: CalendarTheme, month: number, day: number, year: number, locale: Locale, extra: { weekend?: "split" } = {}, size = 150) => {
      const svg = calendarIcon({ theme, month, day, year, locale, scheme, size, holidays: HOLIDAY, ...extra });
      return `<div class="cell">${slot(`<span class="meigen-cal" style="width:${size}px">${svg}</span>`, 190)}</div>`;
    };
    const cell = (inner: string, name: string) => `<div class="cell">${inner}<b>${name}</b></div>`;
    return `<div class="panel" style="margin-bottom:12px"><div class="row" style="align-items:flex-start;gap:8px">
${cell(one("sun", 1, 1, 2027, "ja"), "Sun disc · 1 Jan 2027")}${cell(one("roll", 2, 24, 2027, "en"), "Wall roll · 24 Feb 2027")}${cell(one("plain", 1, 1, 2027, "en"), "Plain · 1 Jan 2027")}
</div></div><div class="panel"><div class="row" style="align-items:flex-start;gap:8px">
${cell(one("sun", 10, 31, 2026, "en", { weekend: "split" }), "Sun disc · weekend, 31 Oct and 1 Nov")}${cell(one("roll", 12, 31, 2022, "ja", { weekend: "split" }), "Wall roll · weekend, 31 Dec and 1 Jan")}
</div></div>`;
  });
}

// ----- The four day layouts, each over real facts.
async function layouts(): Promise<void> {
  const day = rankFeed(dayOf("11-20"), 12).slice(0, 6);
  const text = worded(day, "2026-11-20");
  const items = day.map((record) => ({ text: text.get(record.recordId) ?? "", year: (record.eventDate ?? "").slice(0, 4), kind: record.category === "player-birthday" ? ("birth" as const) : record.category === "player-death" ? ("death" as const) : ("event" as const) }));
  const shortest = [...items].sort((a, b) => a.text.length - b.text.length);
  await twin("layouts", (scheme) => {
    const box = (name: string, id: string, body: string) => `<div class="panel"><div class="kind" style="margin-bottom:10px">${name} · <code style="font:12px var(--mono);text-transform:none">${id}</code></div>${body}</div>`;
    const calendar = displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month: 11, day: 20, year: 2026, scheme, size: 96 }), items: shortest.slice(0, 3) });
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px;align-items:start"><div style="display:grid;gap:12px">
${box("Calendar card", "calendar", calendar)}
${box("Compact", "compact", displayMarkup({ layout: "compact", items: shortest.slice(0, 4) }))}
</div><div style="display:grid;gap:12px">
${box("Year list", "years", displayMarkup({ layout: "years", name: `y-${scheme}`, items: shortest.slice(0, 4) }))}
${box("Featured", "featured", displayMarkup({ layout: "featured", items: shortest.slice(1, 2) }))}
</div></div>`;
  });
}

// ----- Today cards: three themes, three days, one of them in Japanese.
async function today(): Promise<void> {
  const cards: { theme: CalendarTheme; monthDay: string; mention: string; locale: Locale; head: string }[] = [
    { theme: "pins", monthDay: "10-20", mention: "Mickey Mantle", locale: "en", head: "Today in sports history" },
    { theme: "desk", monthDay: "11-20", mention: "Grey Cup", locale: "en", head: "Today in sports history" },
    { theme: "line", monthDay: "07-04", mention: "1954 World Cup", locale: "ja", head: "今日のスポーツ史" },
  ];
  const picked = cards.map((card) => ({ card, fact: pick(card.monthDay, card.mention, card.locale) }));
  await twin("today", (scheme) => picked.map(({ card, fact }) => {
    const [month, day] = card.monthDay.split("-").map(Number) as [number, number];
    return `<div class="panel card" style="margin-bottom:12px">${icon(card.theme, month, day, { year: 2026, locale: card.locale, scheme, size: 120 })}<div><span class="kind">${card.head}</span><p class="s" style="font-size:19px">${escape(fact.text)}</p><div class="src">${credit(fact.record)}</div></div></div>`;
  }).join(""));
}

// ----- Banners: an icon beside the featured fact, wide.
async function banners(): Promise<void> {
  const list: { theme: CalendarTheme; monthDay: string; mention: string }[] = [
    { theme: "shadow", monthDay: "03-17", mention: "Ledecky" },
    { theme: "heavy", monthDay: "07-04", mention: "1954 World Cup" },
    { theme: "soft", monthDay: "12-25", mention: "Rickey Henderson" },
  ];
  const picked = list.map((one) => ({ one, fact: pick(one.monthDay, one.mention) }));
  await twin("banners", (scheme) => picked.map(({ one, fact }, at) => {
    const [month, day] = one.monthDay.split("-").map(Number) as [number, number];
    const when = dateOf(fact.record);
    const svg = calendarIcon({ theme: one.theme, month, day, year: 2026, scheme, size: 100 });
    const featured = displayMarkup({ layout: "featured", items: [{ text: fact.text, year: String(when.year) }] });
    return `<div class="panel" style="display:flex;gap:22px;align-items:center;margin-bottom:${at === picked.length - 1 ? 0 : 12}px"><div class="meigen-cal" style="width:100px;flex:none">${svg}</div>${featured}</div>`;
  }).join(""));
}

// ----- Facts by sport: six sports, each with the best short fact of its feed and the page of its own day.
async function sports(): Promise<void> {
  const list: { sport: string; label: string; theme: CalendarTheme }[] = [
    { sport: "ice-hockey", label: "Hockey", theme: "loops" },
    { sport: "baseball", label: "Baseball", theme: "cartoon" },
    { sport: "basketball", label: "Basketball", theme: "flip" },
    { sport: "soccer", label: "Soccer", theme: "frame" },
    { sport: "american-football", label: "Football", theme: "curl" },
    { sport: "tennis", label: "Tennis", theme: "badge" },
  ];
  const picked = list.map((one) => ({ one, fact: bestOfSport(one.sport) }));
  await twin("sports", (scheme) => `<div class="small" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${picked.map(({ one, fact }) => {
    const when = dateOf(fact.record);
    return `<div class="panel card" style="grid-template-columns:auto 1fr;gap:0 14px;align-items:start">${icon(one.theme, when.month, when.day, { year: when.year, scheme, size: 74 })}<div><span class="kind">${one.label}</span><p class="s">${escape(fact.text)}</p><div class="src">${credit(fact.record)}</div></div></div>`;
  }).join("")}</div>`);
}

// ----- The gallery: one sheet for each theme and language: five dates, light and dark, then sizes with and without a year.
const GALLERY_DATES: [number, number][] = [[1, 1], [2, 9], [9, 9], [11, 30], [12, 31]];
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateLabel = (month: number, day: number, locale: Locale): string => (locale === "ja" ? `${month}月${day}日` : `${day} ${MONTH_EN[month - 1]}`);
const GALLERY_SIZES = [16, 24, 32, 48, 64, 96];
/** The weekend pages of the gallery, by their Saturday: 6 and 7 June, 31 October and 1 November, 30 and 31 May, 31 December and 1 January. */
const GALLERY_WEEKENDS: [number, number, number][] = [[2026, 6, 6], [2026, 10, 31], [2026, 5, 30], [2022, 12, 31]];
const weekendIcon = (theme: CalendarTheme, year: number, month: number, day: number, locale: Locale, scheme: Scheme): string =>
  `<span class="meigen-cal" style="width:112px">${calendarIcon({ theme, month, day, year, locale, scheme, size: 112, weekend: "split" })}</span>`;
const weekendLabel = (year: number, month: number, day: number, locale: Locale): string => {
  const sunday = calendarWeekend(year, month, day)!.sunday;
  return locale === "ja" ? `${month}月${day}日・${sunday.month}月${sunday.day}日` : `${day} ${MONTH_EN[month - 1]} · ${sunday.day} ${MONTH_EN[sunday.month - 1]}`;
};
async function gallery(): Promise<void> {
  for (const locale of ["en", "ja"] as const) {
    for (const theme of CALENDAR_THEMES.filter((one) => !process.env.THEMES || process.env.THEMES.split(",").includes(one))) {
      const band = (scheme: Scheme, body: string) => `<div class="${scheme === "light" ? "light-band" : "dark-band"}">${body}</div>`;
      const dates = (scheme: Scheme) => band(scheme, `<div class="row">${GALLERY_DATES.map(([month, day]) => `<div class="cell">${icon(theme, month, day, { year: 2026, locale, scheme, size: 112 })}<b>${dateLabel(month, day, locale)}</b></div>`).join("")}</div>`);
      const weekends = (scheme: Scheme) => (theme === "sun" || theme === "roll" ? band(scheme, `<div class="row">${GALLERY_WEEKENDS.map(([year, month, day]) => `<div class="cell">${weekendIcon(theme, year, month, day, locale, scheme)}<b>${weekendLabel(year, month, day, locale)}</b></div>`).join("")}</div>`) : "");
      const sizes = (scheme: Scheme) => band(scheme, `<div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:6px">${locale === "ja" ? "ピクセル · 年なし" : "pixels · no year"}</div><div class="row" style="justify-content:space-around">${GALLERY_SIZES.map((size) => `<div class="cell">${icon(theme, 12, 31, { locale, scheme, size })}<span>${size}</span></div>`).join("")}</div>`);
      const html = `<h3 style="display:flex;justify-content:space-between;align-items:baseline">${label(theme, locale)}<code style="font:14px var(--mono);color:var(--muted)">${theme}</code></h3>
<div style="display:grid;gap:10px">${dates("light")}${dates("dark")}${weekends("light")}${weekends("dark")}<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${sizes("light")}${sizes("dark")}</div></div>`;
      still(await shoot(await newPage("light"), `gallery-${theme}-${locale}`, "light", html), `gallery-${theme}-${locale}`);
    }
  }
}

// ----- Moving pictures: a row of seven, where only the centre one moves.
type Step = { html: string; delay: number };
const SIDES: CalendarTheme[] = ["pins", "shadow", "cartoon", "curl", "desk", "badge"];
const row = (scheme: Scheme, middle: string, caption: string): string => {
  const cells = SIDES.map((theme) => `<div class="cell">${slot(icon(theme, 3, 20, { year: 2026, scheme, size: 96 }), 112)}<b>${label(theme, "en")}</b></div>`);
  cells.splice(3, 0, `<div class="cell">${slot(middle, 112)}<b>${caption}</b></div>`);
  return `<div class="row" style="align-items:flex-start">${cells.join("")}</div>`;
};
async function centre(): Promise<void> {
  const days: [number, number, number][] = [[2, 26, 2026], [2, 27, 2026], [2, 28, 2026], [3, 1, 2026], [3, 2, 2026], [3, 3, 2026]];
  const dayFrames = (scheme: Scheme): Step[] => days.map(([month, day, year], at) => ({
    html: `<h3>The centre page turns from day to day</h3>${row(scheme, icon("flip", month, day, { year, scheme, size: 96 }), `Flip · ${dateLabel(month, day, "en")}`)}`,
    delay: at === days.length - 1 ? 1600 : 1100,
  }));
  const themeFrames = (scheme: Scheme): Step[] => CALENDAR_THEMES.map((theme, at) => ({
    html: `<h3>The centre page changes theme, the others stay</h3>${row(scheme, icon(theme, 3, 20, { year: 2026, scheme, size: 96 }), `${label(theme, "en")}`)}`,
    delay: at === CALENDAR_THEMES.length - 1 ? 1600 : 1000,
  }));
  for (const [name, frames] of [["centre-days", dayFrames], ["centre-themes", themeFrames]] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const page = await newPage(scheme);
      const args: string[] = [];
      for (const [at, step] of frames(scheme).entries()) {
        const file = await shoot(page, `${name}-${scheme}-${String(at).padStart(3, "0")}`, scheme, step.html);
        args.push("-d", String(Math.round(step.delay * slow)), file);
      }
      const target = join(out, `${name}-${scheme}.webp`);
      const run = spawnSync("img2webp", ["-loop", "0", "-lossy", "-q", "80", "-m", "6", ...args, "-o", target], { encoding: "utf8" });
      if (run.status !== 0) throw new Error(`img2webp failed: ${run.stderr}`);
      const size = statSync(target).size;
      if (size > MAX_BYTES) throw new Error(`${target} is ${size} bytes, over 1.5 MB`);
      console.log(`ok   ${name}-${scheme}.webp  ${Math.round(size / 1024)} kB, ${args.length / 3} frames`);
    }
  }
}

const work = mkdtempSync(join(tmpdir(), "meigen-showcase-"));
try {
  if (wanted("hero-icons")) await heroIcons();
  if (wanted("themes")) await themes();
  if (wanted("tearoff")) await tearoff();
  if (wanted("layouts")) await layouts();
  if (wanted("today")) await today();
  if (wanted("banners")) await banners();
  if (wanted("sports")) await sports();
  if (wanted("gallery")) await gallery();
  if (wanted("centre")) await centre();
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
