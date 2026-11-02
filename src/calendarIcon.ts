// Original calendar-page drawings as SVG. Seventeen named themes, each in light and dark.
// Every drawing is our own: shapes, gradients and a stroke-drawn digit set. No image, font file or product art is used,
// and theme names are generic: never a company or product name.

export const CALENDAR_THEMES = ["pins", "loops", "shadow", "heavy", "cartoon", "flip", "stack", "line", "curl", "soft", "desk", "thin", "frame", "badge", "sun", "roll", "plain"] as const;

export type CalendarTheme = (typeof CALENDAR_THEMES)[number];

export const CALENDAR_THEME_LABELS: Record<CalendarTheme, { en: string; ja: string }> = {
  pins: { en: "Pins", ja: "ピン留め" },
  loops: { en: "Loops", ja: "輪綴じ" },
  shadow: { en: "Long shadow", ja: "長い影" },
  heavy: { en: "Heavy", ja: "極太" },
  cartoon: { en: "Cartoon", ja: "マンガ風" },
  flip: { en: "Flip", ja: "卓上" },
  stack: { en: "Stack", ja: "重ね" },
  line: { en: "Line", ja: "線画" },
  curl: { en: "Curl", ja: "めくり" },
  soft: { en: "Soft", ja: "やわらか" },
  desk: { en: "Desk", ja: "立体" },
  thin: { en: "Thin", ja: "細字" },
  frame: { en: "Frame", ja: "四色枠" },
  badge: { en: "Badge", ja: "バッジ" },
  sun: { en: "Sun disc", ja: "日の丸" },
  roll: { en: "Wall roll", ja: "壁掛け" },
  plain: { en: "Plain", ja: "無地" },
};

/** The ten names of 0.12 and 0.13, still accepted: each reads as the theme that replaced it. */
export const CALENDAR_THEME_ALIASES: Readonly<Record<string, CalendarTheme>> = {
  classic: "pins",
  outline: "line",
  spiral: "loops",
  bold: "heavy",
  tent: "flip",
  curl: "curl",
  pad: "stack",
  minimal: "thin",
  fold: "frame",
  tile: "badge",
};

export interface CalendarIconOptions {
  /** Month 1–12. */
  month: number;
  /** Day of the month 1–31. */
  day: number;
  /** Four-digit year. Names the weekday (and a small year) where a theme draws them; omit it to leave both off. */
  year?: number;
  theme?: CalendarTheme;
  /** `en` (the default) or any locale `Intl` accepts. */
  locale?: string;
  scheme?: "light" | "dark";
  /** Width in CSS pixels. Height follows the theme's shape. Default 96. */
  size?: number;
  /** `"split"` draws a Saturday and the Sunday after it on one page, cut by a diagonal (themes `sun` and `roll`, and only when a year is given and the day is a Saturday or a Sunday). Any other day keeps its own page. */
  weekend?: "split";
  /** Holiday names for the side columns, by date (`"2027-01-01"`) or by day of every year (`"01-01"`): one string, or one per language. The library knows none itself; a date with no name leaves its cell empty. */
  holidays?: Readonly<Record<string, string | { readonly en?: string; readonly ja?: string }>>;
  /** SVG shapes that replace the sun's red disc: drawn in a box from -100,-100 to 100,100 centred behind the day. Your own markup, written as given: no scripts, styles, event attributes or foreign objects. */
  mark?: string;
  /** The side columns of `sun` and `roll` (weekday, month, holiday). Default true. */
  columns?: boolean;
  /** The moon phase on `plain`, drawn when a year is given. Default true. */
  moon?: boolean;
}

interface Parts {
  month: string;
  monthUp: string;
  monthShort: string;
  monthShortUp: string;
  weekday: string;
  day: string;
  year: string;
  label: string;
}

/** x, y, width, height, in the drawing's own units. */
type Rect = readonly [x: number, y: number, width: number, height: number];

/** Where a theme puts the day and the year; a theme's `layout` says it once and the drawing and the tests both read it. */
export interface CalendarLayout {
  /** The page the day is centred in, across and (as one block with the month word and the year, when the page shares them) down. */
  page: Rect;
  /** The room the year chip sits in: it keeps the minimum size and the margin from the bottom of this. `null` for a look with no year chip. */
  yearZone: Rect | null;
  /** Only on a weekend page: where the two numerals sit (their centres), how tall they are, and the diagonal that cuts the page (from top right to bottom left). */
  split?: { saturday: readonly [number, number]; sunday: readonly [number, number]; height: number; line: readonly [number, number, number, number] };
}

/** The data a tear-off theme draws beside the date itself. */
interface Extras {
  ja: boolean;
  day: DayInfo;
  /** The Saturday and the Sunday of a weekend page. */
  split: { saturday: DayInfo; sunday: DayInfo } | null;
  mark: string | undefined;
  columns: boolean;
  moon: boolean;
}

interface Ctx {
  p: Parts;
  dark: boolean;
  uid: string;
  month: number;
  dayNo: number;
  yearNo: number | undefined;
  l: CalendarLayout;
  x: Extras;
}

interface Def {
  /** The drawing's own coordinate box: x, y, width, height. */
  box: Rect;
  /** Where the day sits in its page. Every theme centres it; a look that places it otherwise says so here, for 1, 9, 30 and 31 alike. */
  numeral: "centre";
  /** The layout with a year and without one (the drawing is re-centred when the year is absent), and, for a theme with a weekend page, as that page. */
  layout: (year: boolean, weekend?: boolean) => CalendarLayout;
  draw: (c: Ctx) => string;
}

/** The year is never smaller than this share of the drawing's width (its font size), and keeps this share clear of the bottom of its zone. */
export const CALENDAR_YEAR_MIN = 0.07;
export const CALENDAR_YEAR_CLEAR = 0.03;

/** The box, the page and the year's room of a theme, with and without a year. A weekend page places its numerals on the diagonal, on purpose, the same for every weekend. */
export function calendarLayout(theme: CalendarTheme, withYear: boolean, weekend = false): CalendarLayout & { box: Rect; numeral: "centre" | "diagonal" } {
  const def = THEMES[theme];
  const layout = def.layout(withYear, weekend && WEEKEND_THEMES.has(theme));
  return { ...layout, box: def.box, numeral: layout.split ? "diagonal" : def.numeral };
}

/** The themes that have a weekend page. */
const WEEKEND_THEMES: ReadonlySet<CalendarTheme> = new Set(["sun", "roll"]);

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/** The Saturday and the Sunday of the weekend a date is in, or null for a weekday, a day the month does not have, or a weekend that runs outside years 1 to 9999. The Sunday may be in the next month or year. */
export function calendarWeekend(year: number, month: number, day: number): { saturday: CalendarDate; sunday: CalendarDate } | null {
  const at = utc(year, month, day);
  if (at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return null;
  const weekday = at.getUTCDay();
  if (weekday !== 6 && weekday !== 0) return null;
  const other = new Date(at.getTime() + (weekday === 6 ? 1 : -1) * 86400000);
  const [saturday, sunday] = weekday === 6 ? [at, other] : [other, at];
  const out = { saturday: dateOf(saturday), sunday: dateOf(sunday) };
  return out.saturday.year < 1 || out.sunday.year > 9999 ? null : out;
}

function utc(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return date;
}

function dateOf(date: Date): CalendarDate {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

const MOON_MONTH = 29.530588853;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** The phase of the moon at noon UTC on a date, in eighths of a lunation: 0 new, 2 first quarter, 4 full, 6 last quarter. A mean lunation from a known new moon, so it can be a day out near the turn of a phase. */
export function calendarMoon(year: number, month: number, day: number): number {
  const age = (((utc(year, month, day).getTime() + 12 * 3600000 - NEW_MOON) / 86400000) % MOON_MONTH + MOON_MONTH) % MOON_MONTH;
  return Math.round((age / MOON_MONTH) * 8) % 8;
}

const SANS = "ui-sans-serif,system-ui,Roboto,Helvetica,Arial,sans-serif";
const BLACK = "'Arial Black','Helvetica Neue',Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

/** The named theme (or an older name for one), or null when the word is not one of ours. */
export function calendarThemeOf(name: string | null | undefined): CalendarTheme | null {
  const id = name?.trim().toLowerCase();
  if (!id) return null;
  if ((CALENDAR_THEMES as readonly string[]).includes(id)) return id as CalendarTheme;
  return Object.hasOwn(CALENDAR_THEME_ALIASES, id) ? CALENDAR_THEME_ALIASES[id]! : null;
}

/** An original calendar-page SVG for a month, day and optional year. The library does not read the clock. */
export function calendarIcon(options: CalendarIconOptions): string {
  const month = options.month;
  const day = options.day;
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError("month must be an integer 1–12");
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new RangeError("day must be an integer 1–31");
  if (options.year !== undefined && (!Number.isInteger(options.year) || options.year < 1 || options.year > 9999)) {
    throw new RangeError("year must be an integer 1–9999");
  }
  const theme = options.theme === undefined ? "pins" : calendarThemeOf(options.theme);
  if (!theme) throw new RangeError(`unknown calendar theme: ${options.theme}`);
  const locale = localeOf(options.locale);
  const dark = options.scheme === "dark";
  const size = options.size ?? 96;
  if (!Number.isFinite(size) || size < 16 || size > 1024) throw new RangeError("size must be 16–1024");
  if (options.weekend !== undefined && options.weekend !== "split") throw new RangeError(`unknown weekend page: ${String(options.weekend)}`);
  if (options.mark !== undefined && UNSAFE_MARK.test(options.mark)) throw new RangeError("mark must be plain SVG shapes: no script, style, event attribute or foreign object");
  const parts = dateParts(month, day, options.year, locale);
  const ja = new Intl.Locale(locale).language === "ja";
  const dayInfo = (year: number | undefined, m: number, d: number): DayInfo => dayInfoOf(year, m, d, locale, ja, options.holidays);
  const pair = options.weekend === "split" && WEEKEND_THEMES.has(theme) && options.year !== undefined ? calendarWeekend(options.year, month, day) : null;
  const split = pair ? { saturday: dayInfo(pair.saturday.year, pair.saturday.month, pair.saturday.day), sunday: dayInfo(pair.sunday.year, pair.sunday.month, pair.sunday.day) } : null;
  const label = split ? `${split.saturday.label}${ja ? "と" : " and "}${split.sunday.label}` : parts.label;
  const uid = split ? `cal-${theme}-${pair!.saturday.month}-${pair!.saturday.day}-${pair!.saturday.year}-${dark ? "d" : "l"}-w` : `cal-${theme}-${month}-${day}-${options.year ?? "x"}-${dark ? "d" : "l"}`;
  const def = THEMES[theme];
  const [x, y, w, h] = def.box;
  const extras: Extras = { ja, day: dayInfo(options.year, month, day), split, mark: options.mark, columns: options.columns !== false, moon: options.moon !== false };
  const body = def.draw({ p: parts, dark, uid, month, dayNo: day, yearNo: options.year, l: def.layout(parts.year !== "", split !== null), x: extras });
  const height = Math.round((size * h) / w);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${r1(size)}" height="${height}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${body}</svg>`;
}

/** What a tear-off page says about one day. */
interface DayInfo {
  year: number | undefined;
  month: number;
  day: number;
  /** 0 Sunday to 6 Saturday; undefined without a year or for a day the month does not have. */
  weekdayNo: number | undefined;
  weekday: string;
  monthShortUp: string;
  holiday: string;
  /** The ink the day is written in: Saturday blue, Sunday and a holiday red, any other day black. */
  ink: "black" | "blue" | "red";
  label: string;
}

const UNSAFE_MARK = /<\s*(script|style|foreignObject|iframe|object|embed)|\son[a-z]+\s*=|javascript:/i;

function dayInfoOf(year: number | undefined, month: number, day: number, locale: string, ja: boolean, holidays: CalendarIconOptions["holidays"]): DayInfo {
  const p = dateParts(month, day, year, locale);
  const real = year !== undefined && p.weekday !== "";
  const weekdayNo = real ? utc(year, month, day).getUTCDay() : undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  const named = (key: string) => (holidays && Object.hasOwn(holidays, key) ? holidays[key] : undefined);
  const found = (year === undefined ? undefined : named(`${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`)) ?? named(`${pad(month)}-${pad(day)}`);
  const holiday = (typeof found === "string" ? found : (ja ? found?.ja : found?.en) ?? found?.en ?? found?.ja ?? "").trim();
  const ink = holiday || weekdayNo === 0 ? "red" : weekdayNo === 6 ? "blue" : "black";
  return { year, month, day, weekdayNo, weekday: p.weekday, monthShortUp: p.monthShortUp, holiday, ink, label: p.label };
}

function localeOf(value: string | undefined): string {
  const wanted = value?.trim() || "en";
  try {
    return Intl.DateTimeFormat.supportedLocalesOf(wanted).length ? wanted : "en";
  } catch {
    return "en";
  }
}

function dateParts(month: number, day: number, year: number | undefined, locale: string): Parts {
  const first = new Date(Date.UTC(year ?? 2000, month - 1, 1));
  const date = new Date(Date.UTC(year ?? 2000, month - 1, day));
  if (year !== undefined && year < 100) {
    first.setUTCFullYear(year);
    date.setUTCFullYear(year);
  }
  const fmt = (when: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" }).format(when);
  const monthLong = fmt(first, { month: "long" });
  const monthShort = fmt(first, { month: "short" });
  // A day the month does not have (30 February) has no weekday.
  const weekday = year === undefined || date.getUTCMonth() !== month - 1 ? "" : fmt(date, { weekday: "long" });
  const yearText = year === undefined ? "" : String(year);
  const up = (s: string) => s.toLocaleUpperCase(locale);
  const label = new Intl.Locale(locale).language === "ja"
    ? `${year === undefined ? "" : `${year}年`}${month}月${day}日${weekday ? `（${weekday}）` : ""}`
    : [weekday, monthShort, String(day), yearText].filter(Boolean).join(" ");
  return { month: monthLong, monthUp: up(monthLong), monthShort, monthShortUp: up(monthShort), weekday, day: String(day), year: yearText, label };
}

// ---------- helpers ----------

const CJK = /[⺀-鿿豈-﫿＀-￯가-힯]/u;

/** The font size that keeps a string inside `maxWidth`, given the average glyph width `f` (in em). */
function fit(s: string, size: number, maxWidth: number, f: number): number {
  let em = 0;
  for (const ch of s) em += CJK.test(ch) ? 1 : f;
  return em * size > maxWidth ? (maxWidth / em) : size;
}

interface TextOptions {
  family?: string;
  anchor?: "start" | "middle" | "end";
  spacing?: number;
  italic?: boolean;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

function tx(x: number, y: number, value: string, size: number, fill: string, weight: number, o: TextOptions = {}): string {
  if (!value) return "";
  const attrs = [
    `x="${r2(x)}"`,
    `y="${r2(y)}"`,
    `text-anchor="${o.anchor ?? "middle"}"`,
    `font-size="${r2(size)}"`,
    `font-family="${o.family ?? SANS}"`,
    `font-weight="${weight}"`,
    `fill="${fill}"`,
  ];
  if (o.italic) attrs.push('font-style="italic"');
  if (o.spacing) attrs.push(`letter-spacing="${r2(o.spacing)}"`);
  if (o.stroke) attrs.push(`stroke="${o.stroke}" stroke-width="${r2(o.strokeWidth ?? 1)}" paint-order="stroke" stroke-linejoin="round"`);
  if (o.opacity !== undefined) attrs.push(`opacity="${o.opacity}"`);
  return `<text ${attrs.join(" ")}>${esc(value)}</text>`;
}

/** The day as text, moved right where its last digit is a 1. */
function dayText(x: number, y: number, day: string, size: number, fill: string, weight: number, o: TextOptions = {}): string {
  return tx(x + optical(day, size), y, day, size, fill, weight, o);
}

/** A single-line string of text fitted to a width. */
function fitted(x: number, y: number, value: string, size: number, maxWidth: number, f: number, fill: string, weight: number, o: TextOptions = {}): string {
  return tx(x, y, value, fit(value, size, maxWidth, f), fill, weight, o);
}

// Stroke-drawn digits in a 10 x 16 box. They look the same on every device and any weight.
const SK: Record<string, string> = {
  "0": "M5 .5C1.8 .5 1 4 1 8s.8 7.5 4 7.5S9 12 9 8 8.2 .5 5 .5Z",
  "1": "M.6 4.2 3.8 .5v15",
  "2": "M1.4 4.4C1.4 2 3 .5 5 .5s3.6 1.5 3.6 3.7C8.6 7.2 5 9.2 1.4 15.5h7.5",
  "3": "M1.3 2.6C2.4 1.1 3.7.5 5 .5c2.2 0 3.4 1.3 3.4 3.3 0 2.3-1.7 3.5-3.9 3.5 2.5.1 4.2 1.5 4.2 4.3 0 2.4-1.7 3.9-3.9 3.9-1.8 0-3-.7-3.6-2.3",
  "4": "M7 15.5V.5L1 11h8.6",
  "5": "M8.3 .5H2.6l-.7 6.6c1-.7 2-1 3-1 2.3 0 3.8 1.6 3.8 4.4 0 3-1.7 5-4 5-1.7 0-3-.7-3.6-2.2",
  "6": "M8 2C7 1 6 .5 5 .5 2.5 .5 1.3 3.5 1.3 9c0 4.5 1.2 6.5 3.7 6.5 2.4 0 3.7-1.8 3.7-4.5 0-2.7-1.5-4.5-3.7-4.5-1.8 0-3.4 1.2-3.7 3",
  "7": "M1.2 .5h7.6L3.8 15.5",
  "8": "M5 7.5C2.8 7.5 1.6 6.2 1.6 4S3 .5 5 .5s3.4 1.3 3.4 3.5S7.2 7.5 5 7.5c-2.6 0-3.9 1.7-3.9 4.2s1.7 3.8 3.9 3.8 3.9-1.3 3.9-3.8S7.6 7.5 5 7.5Z",
  "9": "M8 2C7 1 6 .5 5 .5 2.5 .5 1.3 3.5 1.3 9c0 4.5 1.2 6.5 3.7 6.5 2.4 0 3.7-1.8 3.7-4.5 0-2.7-1.5-4.5-3.7-4.5-1.8 0-3.4 1.2-3.7 3",
};
// Where each digit's ink lies across its 10-unit box (from its path's own outline), so a number is centred by its ink, not by its box.
const INK: Record<string, readonly [number, number]> = {
  "0": [1, 9],
  "1": [0.6, 3.8],
  "2": [1.4, 8.9],
  "3": [1.2, 8.7],
  "4": [1, 9.6],
  "5": [1.1, 8.7],
  "6": [1.3, 8.7],
  "7": [1.2, 8.8],
  "8": [1.1, 8.9],
  "9": [1.3, 8.7],
};

// The same extents once a digit is leaned 12 degrees about its middle (the leaned ink, so a leaned number is centred by what is seen).
const INK_LEAN: Record<string, readonly [number, number]> = {
  "0": [0.5, 9.5],
  "1": [1.4, 5.4],
  "2": [-0.2, 9.6],
  "3": [0, 9.4],
  "4": [0.3, 9],
  "5": [0, 9.9],
  "6": [0.7, 9.3],
  "7": [2.2, 10.5],
  "8": [0.2, 9.4],
  "9": [0.7, 9.4],
  "1b": [-2.4, 5.6],
};

interface DigitOptions {
  slant?: number;
  /** The space between one digit's ink and the next, in digit units (a digit is 16 tall). */
  gap?: number;
  cap?: "round" | "butt" | "square";
  base?: boolean;
  /** Narrows every digit to this share of its width (a condensed face): the strokes keep their thickness. */
  condense?: number;
  /** Centre the number by the ink it really draws, stroke included, not by the middle of the strokes (for a heavy face). */
  inked?: boolean;
}

const squeezed = new Map<string, string>();
/** A path with every x coordinate multiplied by `xs` (its strokes are drawn afterwards, so they keep their thickness). */
function squeeze(d: string, xs: number): string {
  if (xs === 1) return d;
  const key = `${xs}|${d}`;
  const known = squeezed.get(key);
  if (known) return known;
  const out = d.replace(/([a-zA-Z])([^a-zA-Z]*)/g, (_, cmd: string, args: string) => {
    const n = (args.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const low = cmd.toLowerCase();
    const moved = n.map((v, i) => (low === "h" || (low !== "v" && i % 2 === 0) ? v * xs : v));
    return `${cmd}${moved.map(r3).join(" ")}`;
  });
  squeezed.set(key, out);
  return out;
}

/** The number drawn as strokes: its ink centred on `cx` and `cy`, `h` tall, `sw` thick. One size for every number. */
function digits(value: string, cx: number, cy: number, h: number, sw: number, color: string, o: DigitOptions = {}): string {
  const gap = o.gap ?? 5;
  const lean = (o.slant ?? 0) / 12;
  const xs = o.condense ?? 1;
  const k = h / 16;
  const half = o.inked ? sw / (2 * k) : 0;
  const ink = [...value].map((d) => {
    const flat = o.base && d === "1" ? ([-0.8, 7.2] as const) : INK[d]!;
    const leaned = INK_LEAN[o.base && d === "1" ? "1b" : d]!;
    const pad = o.base && d === "1" ? 0 : half;
    return [(flat[0] + (leaned[0] - flat[0]) * lean) * xs - pad, (flat[1] + (leaned[1] - flat[1]) * lean) * xs + pad] as const;
  });
  const top = cy - h / 2;
  const total = ink.reduce((a, [l, r]) => a + r - l, 0) + gap * (ink.length - 1);
  let at = cx - (total * k) / 2;
  let out = "";
  [...value].forEach((d, i) => {
    const [l, r] = ink[i]!;
    const path = d === "9" ? `<path d="${squeeze(SK["6"]!, xs)}" transform="rotate(180 ${r2(5 * xs)} 8)"/>` : `<path d="${squeeze(SK[d]!, xs)}"/>`;
    const serif = o.base && d === "1" ? `<path d="${squeeze("M-.8 15.5h8", xs)}"/>` : "";
    out += `<g transform="translate(${r2(at - l * k)} ${r2(top)}) scale(${r3(k)})" stroke-width="${r3(sw / k)}">${path}${serif}</g>`;
    at += (r - l + gap) * k;
  });
  const cap = o.cap ?? "round";
  const inner = `<g fill="none" stroke="${color}" stroke-linecap="${cap}" stroke-linejoin="${cap === "butt" ? "miter" : "round"}">${out}</g>`;
  if (!o.slant) return inner;
  return `<g transform="translate(${r2(cx)} ${r2(cy)}) skewX(${-o.slant}) translate(${r2(-cx)} ${r2(-cy)})">${inner}</g>`;
}

/** The height of a digit or capital as a share of the font size. */
const CAP = 0.716;

/** A 1 is drawn narrow and to the left of its box in the fonts a page falls back to, so a day that ends in one is moved right by this share of its size. */
const ONE = 0.035;
const optical = (day: string, size: number): number => (day.endsWith("1") ? ONE * size : 0);

/** The baselines of lines stacked top to bottom (each with its cap height and the gap above it), centred between `top` and `bottom`. */
function stack(top: number, bottom: number, rows: ReadonlyArray<readonly [cap: number, gap: number]>): number[] {
  const total = rows.reduce((sum, [cap, gap], i) => sum + cap + (i ? gap : 0), 0);
  let y = top + (bottom - top - total) / 2;
  return rows.map(([cap, gap], i) => {
    y += (i ? gap : 0) + cap;
    return y;
  });
}

/** Marks a part of the drawing (`day`, `month`, `year`) so a test, or a page's own style, can find it. */
function part(name: "day" | "month" | "year" | "weekday" | "monthno" | "saturday" | "sunday", markup: string): string {
  return markup ? `<g data-part="${name}">${markup}</g>` : "";
}

function rect(x: number, y: number, w: number, h: number, r: number, fill: string, extra = ""): string {
  return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(r)}" fill="${fill}"${extra ? ` ${extra}` : ""}/>`;
}

function circle(x: number, y: number, radius: number, fill: string, extra = ""): string {
  return `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(radius)}" fill="${fill}"${extra ? ` ${extra}` : ""}/>`;
}

/** A rectangle with only the top corners rounded. */
function topRound(x: number, y: number, w: number, h: number, r: number, fill: string, extra = ""): string {
  return `<path d="M${r2(x)} ${r2(y + h)}V${r2(y + r)}a${r2(r)} ${r2(r)} 0 0 1 ${r2(r)} ${r2(-r)}h${r2(w - 2 * r)}a${r2(r)} ${r2(r)} 0 0 1 ${r2(r)} ${r2(r)}V${r2(y + h)}Z" fill="${fill}"${extra ? ` ${extra}` : ""}/>`;
}

// ---------- the tear-off pages (sun, roll, plain) ----------

const tearColours = (dark: boolean) =>
  dark
    ? { paper: "#1f2023", back: "#2c2e33", edge: "#44464c", ink: "#f2f1ec", muted: "#8f9198", red: "#ff6f55", blue: "#7ba7ff", disc: "#c4301d", strip: "#4b4e57", stripHi: "#5d616b", dot: "#4d5057", kraft: "#7d6445", kraftEdge: "#68533a", hole: "#2a2a2c" }
    : { paper: "#fdfdfa", back: "#e9e9e4", edge: "#d3d4cf", ink: "#111111", muted: "#85868c", red: "#d8321c", blue: "#1f4ea6", disc: "#e2371f", strip: "#cdd1da", stripHi: "#e3e6ec", dot: "#c9cac6", kraft: "#c9a574", kraftEdge: "#b48e5d", hole: "#efe9de" };
type TearColours = ReturnType<typeof tearColours>;
const inkOf = (k: TearColours, ink: DayInfo["ink"]): string => (ink === "red" ? k.red : ink === "blue" ? k.blue : k.ink);

/** The condensed, very heavy numerals of the sun and roll pages. */
const BIG = { condense: 0.62, cap: "butt", base: true, inked: true, gap: 1 } as const;
const bigInk = (h: number, sw: number): number => (h * 15) / 16 + sw;

/** Characters one under another, centred on `cx`: the end is where the next thing may start. */
function stacked(cx: number, top: number, chars: readonly string[], size: number, fill: string, weight: number): { markup: string; end: number } {
  const pitch = size * 1.1;
  const markup = chars.map((ch, i) => tx(cx, top + i * pitch + size * 0.86, ch, size, fill, weight)).join("");
  return { markup, end: top + chars.length * pitch };
}

/** A word turned a quarter turn, reading downwards, centred across `cx` and starting at `top`: its length (the next start) is what it occupies. */
function spine(cx: number, top: number, value: string, size: number, fill: string, weight: number, spacing = 0): { markup: string; end: number } {
  if (!value) return { markup: "", end: top };
  const length = [...value].reduce((a, ch) => a + (CJK.test(ch) ? 1 : 0.7), 0) * size + spacing * value.length;
  return { markup: `<g transform="translate(${r2(cx - (size * CAP) / 2)} ${r2(top)}) rotate(90)">${tx(0, 0, value, size, fill, weight, { anchor: "start", spacing })}</g>`, end: top + length };
}

/** The weekday of a side column: the kanji one under another in Japanese, a word reading downwards in any other language. */
function weekdayCell(box: Rect, d: DayInfo, ja: boolean, k: TearColours, size: number, top = box[1]): { markup: string; end: number } {
  if (!d.weekday) return { markup: "", end: top };
  const fill = inkOf(k, d.ink);
  const cx = box[0] + box[2] / 2;
  if (ja) return stacked(cx, top, [...d.weekday], Math.min(size, box[2] * 0.84), fill, 900);
  const word = d.weekday.toLocaleUpperCase();
  return spine(cx, top, word, fit(word, Math.min(size, box[2] * 0.62), Math.max(20, box[3] - (top - box[1]) - 4), 0.72), fill, 900);
}

/** The month of a side column: the number and 月 in Japanese, the short month name reading downwards in any other language. */
function monthCell(box: Rect, d: DayInfo, ja: boolean, k: TearColours, size: number, top = box[1]): { markup: string; end: number } {
  const fill = inkOf(k, d.ink);
  const cx = box[0] + box[2] / 2;
  if (!ja) return spine(cx, top, d.monthShortUp, Math.min(size, box[2] * 0.62), fill, 900, 1);
  const num = fit(String(d.month), size, box[2] * 0.9, 0.62);
  const unit = stacked(cx, top + num * 1.05, ["月"], Math.min(size, box[2] * 0.76), fill, 900);
  return { markup: tx(cx, top + num * 0.86, String(d.month), num, fill, 900) + unit.markup, end: unit.end };
}

/** The holiday of a side column, in red, in whatever room is left (a day with none leaves it empty). */
function holidayCell(box: Rect, d: DayInfo, ja: boolean, k: TearColours, size: number, top: number): string {
  if (!d.holiday) return "";
  const room = box[1] + box[3] - top;
  const cx = box[0] + box[2] / 2;
  if (ja) {
    const chars = [...d.holiday];
    const fs = Math.min(size, box[2] * 0.62, room / (chars.length * 1.1));
    return stacked(cx, top, chars, fs, k.red, 900).markup;
  }
  return spine(cx, top, d.holiday, fit(d.holiday, Math.min(size, box[2] * 0.4), room, 0.62), k.red, 800).markup;
}

/** The corners of a polygon that covers one side of the diagonal `line` (far past the page): `up` is the upper left, otherwise the lower right. */
function halfPlane(line: readonly [number, number, number, number], up: boolean): string {
  const [x1, y1, x2, y2] = line;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const far = 4;
  const nx = (up ? -dy : dy) * far;
  const ny = (up ? dx : -dx) * far;
  const [ax, ay, bx, by] = [x1 - dx * far, y1 - dy * far, x2 + dx * far, y2 + dy * far];
  return [ax, ay, bx, by, bx + nx, by + ny, ax + nx, ay + ny].map(r1).join(" ").replace(/(\S+) (\S+)/g, "$1,$2");
}

/** The numerals of a weekend page: the Saturday upper left, the Sunday lower right, each over a faint ghost of the other, cut by the diagonal. */
function weekendNumerals(c: Ctx, k: TearColours, uid: string, inks: { saturday: string; sunday: string }, ghostSize: number): string {
  const s = c.l.split!;
  const days = c.x.split!;
  const [h, sw] = [s.height, s.height * 0.125];
  const big = (value: number, at: readonly [number, number], color: string, size = h, weight = sw) =>
    digits(String(value), at[0], at[1], size, weight, color, BIG);
  const ghost = (value: number, at: readonly [number, number]) => `<g opacity=".06">${big(value, at, k.ink, ghostSize, ghostSize * 0.125)}</g>`;
  const [cx, cy] = [(s.saturday[0] + s.sunday[0]) / 2, (s.saturday[1] + s.sunday[1]) / 2];
  return (
    `<defs><clipPath id="${uid}-u"><polygon points="${halfPlane(s.line, true)}"/></clipPath><clipPath id="${uid}-d"><polygon points="${halfPlane(s.line, false)}"/></clipPath>` +
    `<clipPath id="${uid}-p"><rect x="${c.l.page[0]}" y="${c.l.page[1]}" width="${c.l.page[2]}" height="${c.l.page[3]}"/></clipPath></defs>` +
    `<g clip-path="url(#${uid}-p)"><g clip-path="url(#${uid}-u)">${ghost(days.sunday.day, [cx - 14, cy - ghostSize * 0.16])}</g>` +
    `<g clip-path="url(#${uid}-d)">${ghost(days.saturday.day, [cx + 14, cy + ghostSize * 0.16])}</g></g>` +
    `<path d="M${s.line.slice(0, 2).map(r2).join(" ")}L${s.line.slice(2).map(r2).join(" ")}" stroke="${k.muted}" stroke-width="1.6"/>` +
    part("day", part("saturday", big(days.saturday.day, s.saturday, inks.saturday)) + part("sunday", big(days.sunday.day, s.sunday, inks.sunday)))
  );
}

/** The corner pieces both tear-off pages put in a page's two side columns: the weekday and month (and for a weekend page, one column each for the Saturday and the Sunday). */
function sideColumns(c: Ctx, k: TearColours, left: Rect, right: Rect, date: boolean): string {
  if (!c.x.columns) return "";
  const { ja, day } = c.x;
  const size = 38;
  if (c.x.split) {
    const side = (box: Rect, d: DayInfo, ink: DayInfo["ink"]) => {
      const e = { ...d, ink };
      const w = weekdayCell(box, e, ja, k, 32);
      const m = monthCell(box, e, ja, k, 28, w.end + 14);
      return w.markup + m.markup + holidayCell(box, e, ja, k, 20, m.end + 14);
    };
    return `<g data-part="side">${side(left, c.x.split.saturday, "blue")}${side(right, c.x.split.sunday, "red")}</g>`;
  }
  const w = weekdayCell(left, day, ja, k, size);
  const m = monthCell(right, day, ja, k, 36);
  let end = m.end;
  let dateText = "";
  if (date) {
    const text = [day.year, String(day.month).padStart(2, "0"), String(day.day).padStart(2, "0")].filter((one) => one !== undefined).join(".");
    const at = spine(right[0] + right[2] / 2, end + 14, text, Math.min(14, right[2] * 0.3), inkOf(k, day.ink), 700);
    dateText = at.markup;
    end = at.end;
  }
  return `<g data-part="side">${w.markup}${m.markup}${dateText}${holidayCell(right, day, ja, k, 22, end + 14)}</g>`;
}

// ---------- the themes ----------

// Each theme's layout is data: the `page` its day is centred in (x, y, width, height, in the drawing's own units, at the day's
// height) and the `yearZone` its year sits in. The day is centred in its page, horizontally always, and vertically as one block
// with the month word and the year it shares the page with. A theme that wants its numerals elsewhere says so in `numeral`.

const PINS: Rect = [35, 105, 243, 180];
const LOOPS: Rect = [59.5, 158.5, 210, 134];
const HEAVY: Rect = [66, 183.5, 296, 167.5];
const CARTOON: Rect = [77, 147, 196, 148.5];
const STACK: Rect = [119, 226, 438, 287];
const LINE: Rect = [83, 120.5, 206, 146.5];
const CURL: Rect = [48.5, 157.5, 287, 208.5];
const SOFT: Rect = [90, 149, 230, 204];
const DESK: Rect = [52.5, 55.9, 123.2, 69.4];
const THIN: Rect = [0, 0, 412, 385];
const FRAME: Rect = [52, 53, 90, 79];
const BADGE: Rect = [29.5, 34, 58.7, 63];

/** Where the shadow theme's page stands: centred in its tile, with the year's room under it when there is a year. */
const SHADOW_YEAR = 24;
const shadowTop = (year: boolean): number => 10 + (326 - 175 - (year ? 14 + SHADOW_YEAR * CAP : 0)) / 2;

/** The flip page's two slanted edges: the page is wider at the top and leans left going down. */
const flipLeft = (y: number): number => 120 - 0.2857 * (y - 122) + 3.5;
const flipRight = (y: number): number => 318 - 0.2474 * (y - 116) - 3.5;
const flipPage = (top: number, bottom: number): Rect => {
  const mid = (top + bottom) / 2;
  return [flipLeft(mid), top, flipRight(mid) - flipLeft(mid), bottom - top];
};

// The tear-off pages share one rule: the page is the centre zone between two side columns, and the numeral sits in it. `sun` and `roll`
// have a weekend page too, which puts the Saturday upper left and the Sunday lower right on a diagonal, on purpose and the same for every weekend.
const SUN: Rect = [86, 46, 188, 274];
const SUN_NUMERAL = { h: 186, sw: 20, year: 30, gap: 16, split: { h: 98, dx: 48, dy: 50 } } as const;
const SUN_LEFT: Rect = [18, 52, 58, 262];
const SUN_RIGHT: Rect = [284, 52, 58, 262];
const ROLL: Rect = [66, 70, 188, 268];
const ROLL_NUMERAL = { h: 190, sw: 20, year: 23, gap: 14, split: { h: 98, dx: 48, dy: 50 } } as const;
const ROLL_LEFT: Rect = [16, 82, 44, 248];
const ROLL_RIGHT: Rect = [260, 82, 44, 248];
const PLAIN_PAGE: Rect = [60, 108, 180, 184];
const PLAIN_NUMERAL = { h: 100, sw: 12, word: 20, gap: 20 } as const;

/** The block of a sun or roll page: the year, then the day, centred in the page; for a weekend page the diagonal and the two numerals' centres. */
function tearBlock(page: Rect, n: { h: number; sw: number; year: number; gap: number; split: { h: number; dx: number; dy: number } }, withYear: boolean, weekend: boolean): { rows: number[]; centre: number; layout: CalendarLayout } {
  const ink = bigInk(n.h, n.sw);
  const rows = stack(page[1], page[1] + page[3], [...(withYear ? [[n.year * CAP, 0] as const] : []), [ink, withYear ? n.gap : 0]]);
  const day = rows[rows.length - 1]!;
  const centre = day - ink / 2;
  const cx = page[0] + page[2] / 2;
  const zone: Rect | null = withYear ? [page[0], rows[0]! - n.year * CAP - 6, page[2], n.year * CAP + 6 + n.gap] : page;
  const layout: CalendarLayout = { page, yearZone: zone };
  if (weekend) {
    const s = n.split;
    layout.split = {
      saturday: [cx - s.dx, centre - s.dy],
      sunday: [cx + s.dx, centre + s.dy],
      height: s.h,
      line: [page[0] + page[2], centre - ink / 2, page[0], centre + ink / 2],
    };
  }
  return { rows, centre, layout };
}

const THEMES: Record<CalendarTheme, Def> = {
  // 01: flat page, red header, two slate pins through white holes.
  pins: {
    box: [20, 15, 273, 280],
    numeral: "centre",
    layout: () => ({ page: PINS, yearZone: PINS }),
    draw: ({ p, dark, l }) => {
      const k = dark
        ? { head: "#d4442f", body: "#2c3539", ink: "#e9eff1", muted: "#9aaab0", hole: "#2c3539", pin: "#e9eff1" }
        : { head: "#ee4338", body: "#ffffff", ink: "#3a4a4f", muted: "#7c8c91", hole: "#ffffff", pin: "#3a4a4f" };
      const pin = (cx: number) => circle(cx, 72, 14.5, k.hole) + rect(cx - 9.5, 25, 19, 57, 9.5, k.pin);
      const [x, y, w, h] = l.page;
      const ms = fit(p.monthUp, 37, 160, 0.68);
      const [mb, db, yb] = stack(y, y + h, [[ms * CAP, 0], [111 * CAP, 14], ...(p.year ? [[20 * CAP, 12] as const] : [])]);
      return (
        rect(35, 40, 243, 245, 28, k.body, `stroke="${dark ? "none" : "#e4e9eb"}" stroke-width="1.6"`) +
        topRound(35, 40, 243, 65, 28, k.head) +
        pin(93) + pin(221) +
        part("month", tx(x + w / 2, mb!, p.monthUp, ms, k.ink, 600, { spacing: 1 })) +
        part("day", dayText(x + w / 2, db!, p.day, 111, k.ink, 700)) +
        part("year", tx(x + w / 2, yb!, p.year, 20, k.muted, 600))
      );
    },
  },

  // 02: grey outline, grey header, three ring pins.
  loops: {
    box: [29.5, 33, 270, 285],
    numeral: "centre",
    layout: () => ({ page: LOOPS, yearZone: [59.5, 119.5, 210, 32] }),
    draw: ({ p, dark, l }) => {
      const k = dark
        ? { line: "#c3c3c3", head: "#6e6e6e", body: "#262626", ink: "#e6e6e6", hole: "#262626", pin: "#c3c3c3", yr: "#ffffff" }
        : { line: "#5b5b5b", head: "#828282", body: "#ffffff", ink: "#555555", hole: "#ffffff", pin: "#5b5b5b", yr: "#ffffff" };
      const ring = (cx: number) => circle(cx, 100, 16.5, k.hole, `stroke="${k.line}" stroke-width="6"`) + rect(cx - 7, 52, 14, 46, 7, k.pin);
      const [x, y, w, h] = l.page;
      const [zx, zy, zw, zh] = l.yearZone!;
      const ms = fit(p.month, 36, 180, 0.6);
      const [mb, db] = stack(y, y + h, [[ms * CAP, 0], [70 * CAP, 14]]);
      return (
        rect(56, 67, 217, 229, 26, k.body) +
        `<path d="M56 155V93a26 26 0 0 1 26-26H247a26 26 0 0 1 26 26V155Z" fill="${k.head}"/>` +
        rect(56, 67, 217, 229, 26, "none", `stroke="${k.line}" stroke-width="7"`) +
        `<path d="M56 155H273" stroke="${k.line}" stroke-width="7"/>` +
        ring(100) + ring(164.5) + ring(229) +
        part("year", tx(zx + zw / 2, zy + zh / 2 + 19 * CAP / 2, p.year, 19, k.yr, 700, { opacity: 0.9 })) +
        part("month", tx(x + w / 2, mb!, p.month, ms, k.ink, 700)) +
        part("day", dayText(x + w / 2, db!, p.day, 70, k.ink, 700))
      );
    },
  },

  // 03: blue header with black coils, a circled day, a long shadow on a lavender tile.
  shadow: {
    box: [8, 6, 334, 336],
    numeral: "centre",
    layout: (year) => {
      const top = shadowTop(year);
      return { page: [86, top + 51, 178, 124], yearZone: [12, top + 175, 326, 336 - top - 175] };
    },
    draw: ({ p, dark, uid, l }) => {
      const k = dark
        ? { tile: "#2c2e4f", shade: "#202241", head: "#3a78b8", body: "#20222b", ink: "#f5f6fb", ring: "#7fb2e8", coil: "#0b0b10", monthStroke: "#13304f" }
        : { tile: "#d8d9fa", shade: "#b3b5e6", head: "#2b5f95", body: "#ffffff", ink: "#000000", ring: "#2b5f95", coil: "#0a0a0a", monthStroke: "#173a5e" };
      const top = shadowTop(p.year !== "");
      const cx = 175;
      const cy = l.page[1] + l.page[3] / 2;
      const coil = (x: number) => rect(x - 4.5, top - 11, 9, 30, 4.5, k.coil) + circle(x, top + 19, 3, k.body, `stroke="${k.coil}" stroke-width="2"`);
      return (
        `<defs><clipPath id="${uid}-t"><rect x="12" y="10" width="326" height="326" rx="22"/></clipPath></defs>` +
        rect(12, 10, 326, 326, 22, k.tile) +
        `<g clip-path="url(#${uid}-t)"><polygon points="86,${r2(top)} 264,${r2(top)} 586,${r2(top + 322)} 408,${r2(top + 322)} 86,${r2(top + 175)}" fill="${k.shade}"/></g>` +
        rect(86, top, 178, 175, 7, k.body) +
        topRound(86, top, 178, 51, 7, k.head) +
        coil(107) + coil(141) + coil(175) + coil(209) + coil(243) +
        fitted(cx, top + 44, p.monthUp, 30, 146, 0.76, "#ffffff", 700, { family: SERIF, spacing: 1, stroke: k.monthStroke, strokeWidth: 1.4 }) +
        circle(cx, cy, 48, "none", `stroke="${k.ring}" stroke-width="2.2"`) +
        circle(cx, cy, 42.5, "none", `stroke="${k.ring}" stroke-width="3.6"`) +
        part("day", dayText(cx, cy + (54 * CAP) / 2, p.day, 54, k.ink, 900, { family: BLACK })) +
        part("year", tx(cx, top + 175 + 14 + SHADOW_YEAR * CAP, p.year, SHADOW_YEAR, k.ring, 700))
      );
    },
  },

  // 04: heavy black outline, ring slots over the top edge, black header rule.
  heavy: {
    box: [38, 60, 352, 320],
    numeral: "centre",
    layout: () => ({ page: HEAVY, yearZone: HEAVY }),
    draw: ({ p, dark, l }) => {
      const k = dark ? { line: "#f2f2f2", body: "#161616", ink: "#f2f2f2" } : { line: "#000000", body: "#ffffff", ink: "#000000" };
      const ring = (cx: number) => rect(cx - 23.5, 69, 47, 63, 23.5, k.line) + rect(cx - 10.5, 82, 21, 40, 10.5, k.body);
      const [x, y, w, h] = l.page;
      const ms = fit(p.monthUp, 44, 220, 0.84);
      const [mb, db, yb] = stack(y, y + h, [[ms * CAP, 0], [90 * CAP, 12], ...(p.year ? [[25 * CAP, 12] as const] : [])]);
      return (
        rect(55.5, 104.5, 317, 257, 14, k.body, `stroke="${k.line}" stroke-width="21"`) +
        `<path d="M46 174h336" stroke="${k.line}" stroke-width="19"/>` +
        ring(106.75) + ring(178.25) + ring(249.75) + ring(321.25) +
        part("month", tx(x + w / 2, mb!, p.monthUp, ms, k.ink, 900, { family: BLACK })) +
        part("day", dayText(x + w / 2, db!, p.day, 90, k.ink, 900, { family: BLACK })) +
        part("year", tx(x + w / 2, yb!, p.year, 25, k.ink, 900, { family: BLACK, opacity: 0.55 }))
      );
    },
  },

  // 05: black cartoon outline, pink header, white ring loops, bold glossy word and number.
  cartoon: {
    box: [56, 56, 238, 262],
    numeral: "centre",
    layout: () => ({ page: CARTOON, yearZone: CARTOON }),
    draw: ({ p, dark, uid, l }) => {
      const k = dark
        ? { line: "#f4f4f4", body: "#1a1a1a", head: "#c45b86", ink: "#f4f4f4", hl: "#ffffff" }
        : { line: "#0a0a0a", body: "#ffffff", head: "#f9a8cb", ink: "#0a0a0a", hl: "#ffffff" };
      const loop = (cx: number) =>
        rect(cx - 9, 74, 18, 56, 9, k.body, `stroke="${k.line}" stroke-width="6"`) +
        rect(cx - 2.5, 84, 5, 30, 2.5, k.line);
      const [x, y, w, h] = l.page;
      const ms = fit(p.monthUp, 40, 160, 0.84);
      const [mb, db, yb] = stack(y, y + h, [[ms * CAP, 0], [82 * CAP, 10], ...(p.year ? [[17 * CAP, 10] as const] : [])]);
      return (
        rect(72.5, 103, 205, 197, 30, k.body, `stroke="${k.line}" stroke-width="9"`) +
        `<clipPath id="${uid}-h"><rect x="72.5" y="103" width="205" height="197" rx="30"/></clipPath>` +
        `<g clip-path="url(#${uid}-h)">${rect(60, 90, 230, 54, 0, k.head)}<path d="M60 144h230" stroke="${k.line}" stroke-width="6"/></g>` +
        loop(108) + loop(175) + loop(242) +
        part("month", tx(x + w / 2, mb!, p.monthUp, ms, k.ink, 900, { family: BLACK, spacing: 1 })) +
        part("day", dayText(x + w / 2, db!, p.day, 82, k.ink, 900, { family: BLACK })) +
        part("year", tx(x + w / 2, yb!, p.year, 17, k.ink, 900, { family: BLACK, opacity: 0.45 }))
      );
    },
  },

  // 06: a flip calendar in perspective: coils, a pale header, a slanted number, a fan of pages.
  flip: {
    box: [52, 78, 340, 262],
    numeral: "centre",
    layout: (year) => {
      const page = flipPage(168, year ? 272 : 312);
      return { page, yearZone: flipPage(168, 314.5) };
    },
    draw: ({ p, dark, l }) => {
      const k = dark
        ? { line: "#9fb7c4", page: "#222c33", head: "#3c5f73", headTop: "#2f4b5b", bar: "#3a464d", ink: "#dcebf2", stack: "#2b363d", edge: "#4c6270" }
        : { line: "#2f4858", page: "#ffffff", head: "#a8dbe9", headTop: "#7fafc0", bar: "#dde1e4", ink: "#2d4858", stack: "#8ea6b3", edge: "#d8e3e9" };
      const coil = (cx: number) =>
        `<path d="M${cx - 7} 126C${cx - 7} 96 ${cx - 5} 90 ${cx} 90s7 6 7 36" fill="none" stroke="${k.line}" stroke-width="6" stroke-linecap="round"/>`;
      const [x, y, w, h] = l.page;
      const bx = (flipLeft(289) + flipRight(289)) / 2;
      const bar = p.year ? `<path d="M${r2(bx - 80)} 276L${r2(bx + 80)} 272 ${r2(bx + 76)} 302 ${r2(bx - 84)} 306Z" fill="${k.bar}"/>` : "";
      return (
        `<path d="M318 116L336 124 376 312 352 322 268 318Z" fill="${k.stack}" stroke="${k.line}" stroke-width="6" stroke-linejoin="round"/>` +
        `<path d="M326 130L346 316M336 134L356 316M346 142L363 314M318 126L332 318" stroke="${k.edge}" stroke-width="3" fill="none"/>` +
        `<path d="M120 122L318 116 270 310Q268 318 258 318H78Q64 318 68 304Z" fill="${k.page}" stroke="${k.line}" stroke-width="7" stroke-linejoin="round"/>` +
        `<path d="M120 122L318 116 306 164 108 168Z" fill="${k.head}" stroke="${k.line}" stroke-width="7" stroke-linejoin="round"/>` +
        `<path d="M118 126L316 120 312 138 114 144Z" fill="${k.headTop}"/>` +
        bar +
        coil(134) + coil(168) + coil(202) + coil(236) + coil(270) + coil(304) +
        part("day", digits(p.day, x + w / 2, y + h / 2, 72, 11, k.ink, { slant: 12, cap: "square", base: true, gap: 5 })) +
        part("year", tx(bx - 2, 289 + (24 * CAP) / 2, p.year, 24, k.ink, 700, { opacity: 0.6 }))
      );
    },
  },

  // 07: solid black glyph with a tilted white page, a curled corner and a sheet underneath.
  stack: {
    box: [44, 37, 620, 570],
    numeral: "centre",
    layout: () => ({ page: STACK, yearZone: STACK }),
    draw: ({ p, dark, l }) => {
      const k = dark ? { base: "#ececec", page: "#161616", ink: "#f2f2f2" } : { base: "#050505", page: "#ffffff", ink: "#050505" };
      const hook = (cx: number) =>
        rect(cx - 31, 122, 62, 64, 31, k.page) +
        `<path d="M${cx - 20} 112V98Q${cx - 20} 72 ${cx + 4} 72Q${cx + 28} 72 ${cx + 28} 98V165" fill="none" stroke="${k.base}" stroke-width="20" stroke-linecap="round"/>`;
      const [x, y, w, h] = l.page;
      const cx = x + w / 2;
      const [db, yb] = stack(y, y + h, [[235 * CAP, 0], ...(p.year ? [[44 * CAP, 18] as const] : [])]);
      const slanted = (size: number, base: number, value: string, weight: number, o: TextOptions) =>
        `<g transform="translate(${cx} ${r2(base - (size * CAP) / 2)}) skewX(-14)">${tx(optical(value, size), (size * CAP) / 2, value, size, k.ink, weight, o)}</g>`;
      return (
        `<path d="M110 105H640V582H135V560Z" fill="${k.base}"/>` +
        `<path d="M110 105V215H620V105Z" fill="${k.base}"/>` +
        `<path d="M150 546H606" stroke="${k.page}" stroke-width="12"/>` +
        `<path d="M135 215L596 215 612 285C600 420 556 510 466 524H106Q74 524 80 488Z" fill="${k.page}" stroke="${k.base}" stroke-width="22" stroke-linejoin="round"/>` +
        `<path d="M466 524C476 486 496 454 520 446L610 288C602 420 556 510 466 524Z" fill="${k.base}"/>` +
        hook(235) + hook(492) +
        part("day", slanted(235, db!, p.day, 900, { family: BLACK })) +
        part("year", p.year ? slanted(44, yb!, p.year, 900, { family: BLACK, opacity: 0.55 }) : "")
      );
    },
  },

  // 08: black line art, a header rule, four tick marks and a big blue number.
  line: {
    box: [56, 40, 260, 255],
    numeral: "centre",
    layout: () => ({ page: LINE, yearZone: LINE }),
    draw: ({ p, dark, l }) => {
      const k = dark ? { line: "#f1f1f1", body: "#141414", num: "#5aa0e6" } : { line: "#080808", body: "#ffffff", num: "#2f78bd" };
      const tick = (cx: number) => `<path d="M${cx} 57.5V84.5" stroke="${k.line}" stroke-width="11" stroke-linecap="round"/>`;
      const [x, y, w, h] = l.page;
      const cx = x + w / 2;
      const size = fit([p.monthShortUp, p.year].filter(Boolean).join(" "), 20, 190, 0.72);
      const [db, lb] = stack(y, y + h, [[109 * CAP, 0], [size * CAP, 18]]);
      const label =
        `<text x="${r2(cx)}" y="${r2(lb!)}" text-anchor="middle" font-size="${r2(size)}" font-family="${BLACK}" font-weight="800" fill="${k.num}">` +
        `<tspan data-part="month">${esc(p.monthShortUp)}</tspan>${p.year ? `<tspan data-part="year" dx="${r2(size * 0.35)}">${esc(p.year)}</tspan>` : ""}</text>`;
      return (
        rect(76.5, 73.5, 219, 200, 18, k.body, `stroke="${k.line}" stroke-width="13"`) +
        `<path d="M72 115h228" stroke="${k.line}" stroke-width="11"/>` +
        tick(120) + tick(164) + tick(208) + tick(252) +
        part("day", dayText(cx, db!, p.day, 109, k.num, 900, { family: BLACK })) +
        label
      );
    },
  },

  // 09: line art with an orange header, two hooks, thin rounded digits and a curled lower corner.
  curl: {
    box: [28, 46, 330, 360],
    numeral: "centre",
    layout: () => ({ page: CURL, yearZone: CURL }),
    draw: ({ p, dark, l }) => {
      const k = dark
        ? { line: "#f1ede8", body: "#2a2623", head: "#c98a2c", dhead: "#a56a16", foot: "#443d38", fold: "#5a5049", ink: "#f4efe9" }
        : { line: "#0b0b0b", body: "#f6f0ed", head: "#f7c978", dhead: "#f1a94c", foot: "#cdc1ba", fold: "#cdc1ba", ink: "#0d0d0d" };
      const hook = (cx: number) =>
        rect(cx - 12, 82, 24, 46, 8, k.dhead) +
        `<path d="M${cx - 11} 132V76a11.5 11.5 0 0 1 23 0V132" fill="none" stroke="${k.line}" stroke-width="9" stroke-linecap="round"/>`;
      const [x, y, w, h] = l.page;
      const cx = x + w / 2;
      const ink = (88 * 15) / 16 + 9;
      const [db, yb] = stack(y, y + h, [[ink, 0], ...(p.year ? [[24 * CAP, 20] as const] : [])]);
      return (
        `<path d="M340.5 300V116a30 30 0 0 0-30-30.5H74a30 30 0 0 0-30.5 30.5V356a30 30 0 0 0 30 31.5H252Z" fill="${k.body}"/>` +
        `<path d="M43.5 150V116a30 30 0 0 1 30-30.5h237a30 30 0 0 1 30 30.5v34Z" fill="${k.head}"/>` +
        `<path d="M43.5 366h208l-13 21.5H73a30 30 0 0 1-29.5-30Z" fill="${k.foot}"/>` +
        `<path d="M340.5 300V116a30 30 0 0 0-30-30.5H74a30 30 0 0 0-30.5 30.5V356a30 30 0 0 0 30 31.5H252" fill="none" stroke="${k.line}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M44 153H340" stroke="${k.line}" stroke-width="9"/>` +
        `<path d="M276 310Q268 306 262 316L254 384 338 300Q340 296 332 298Z" fill="${k.fold}" stroke="${k.line}" stroke-width="9" stroke-linejoin="round"/>` +
        hook(101) + hook(283) +
        fitted(cx, 134, p.month, 40, 120, 0.55, k.ink, 700) +
        part("day", digits(p.day, cx, db! - ink / 2, 88, 9, k.ink)) +
        part("year", tx(cx, yb!, p.year, 24, k.ink, 700, { opacity: 0.55 }))
      );
    },
  },

  // 10: flat red-orange header, three amber rings, a cream page with a side shade and a rounded coral number.
  soft: {
    box: [40, 48, 292, 312],
    numeral: "centre",
    layout: () => ({ page: SOFT, yearZone: SOFT }),
    draw: ({ p, dark, l }) => {
      const k = dark
        ? { head: "#d0553c", headHi: "#e2694f", body: "#352c27", side: "#2a221e", ring: "#e9a73a", ringDark: "#cf8d22", num: "#f08a6f", hi: "#ffffff" }
        : { head: "#ee5a3a", headHi: "#ef6f4f", body: "#fbe8cb", side: "#f8d08f", ring: "#f7b844", ringDark: "#f0a130", num: "#ee6a4c", hi: "#ffffff" };
      const ring = (cx: number) => rect(cx - 12, 62, 24, 52, 12, k.ring) + rect(cx - 12, 88, 24, 26, 12, k.ringDark, 'opacity=".65"');
      const [x, y, w, h] = l.page;
      const cx = x + w / 2;
      const ink = (100 * 15) / 16 + 24;
      const [db, yb] = stack(y, y + h, [[ink, 0], ...(p.year ? [[21 * CAP, 16] as const] : [])]);
      return (
        rect(52, 132, 76, 218, 28, k.side) +
        topRound(52, 88, 266, 60, 28, k.head) +
        rect(90, 95, 230, 258, 30, k.body) +
        topRound(90, 95, 230, 54, 30, k.headHi) +
        ring(137) + ring(205) + ring(273) +
        fitted(cx, 134, p.monthShort, 34, 160, 0.6, "#ffffff", 700) +
        part("day", digits(p.day, cx, db! - ink / 2, 100, 24, k.num, { gap: 6 })) +
        rect(306, 163, 7, 28, 3.5, k.hi, 'opacity=".75"') + rect(306, 205, 7, 56, 3.5, k.hi, 'opacity=".75"') +
        part("year", tx(cx, yb!, p.year, 21, k.num, 700, { opacity: 0.8 }))
      );
    },
  },

  // 11: a desk pad seen from an angle: coils, a red banner with a white number, a month of small dates.
  desk: {
    box: [27, 14.6, 187, 233],
    numeral: "centre",
    layout: () => ({ page: DESK, yearZone: null }),
    draw: ({ p, dark, uid, month, dayNo, yearNo }) => {
      const k = dark
        ? { paper: "#2d343b", paperEdge: "#46515b", head1: "#a8321f", head2: "#d44a30", grid: "#7fa3d6", gridLine: "#4a6a95", wk: "#e86a56", num: "#ffffff", stack: "#242a30", stack2: "#1b2025", shadow: "#000000" }
        : { paper: "#fbfcfd", paperEdge: "#c9d0d6", head1: "#b83a24", head2: "#e55a3c", grid: "#3d6bab", gridLine: "#7db7ec", wk: "#d6402d", num: "#ffffff", stack: "#cfd7de", stack2: "#8a99a6", shadow: "#33414d" };
      const first = new Date(Date.UTC(yearNo ?? 2000, month - 1, 1)).getUTCDay();
      const count = new Date(Date.UTC(yearNo ?? 2000, month, 0)).getUTCDate();
      let cells = "";
      for (let n = 1; n <= count; n += 1) {
        const slot = first + n - 1;
        const cx = 10 + (slot % 7) * 15.7 + 7.8;
        const cy = 84 + Math.floor(slot / 7) * 11 + 8;
        const hot = n === dayNo;
        if (hot) cells += rect(cx - 6.8, cy - 7.6, 13.6, 10.4, 1.6, k.wk);
        cells += tx(cx, cy, String(n), 7.2, hot ? "#ffffff" : slot % 7 === 0 ? k.wk : k.grid, 700);
      }
      let lines = "";
      for (let i = 0; i <= 7; i += 1) lines += `M${r2(10 + i * 15.7)} 80V146`;
      for (let i = 0; i <= 6; i += 1) lines += `M10 ${80 + i * 11}H120`;
      let rings = "";
      for (let i = 0; i < 10; i += 1) {
        const cx = 8 + i * 12.4;
        rings += `<path d="M${r2(cx - 1.5)} 4C${r2(cx - 1.5)} -9 ${r2(cx + 3.5)} -9 ${r2(cx + 3.5)} 4" fill="none" stroke="#7d848b" stroke-width="3" stroke-linecap="round"/>` +
          `<path d="M${r2(cx - 1.5)} 4C${r2(cx - 1.5)} -9 ${r2(cx + 3.5)} -9 ${r2(cx + 3.5)} 4" fill="none" stroke="#e6eaee" stroke-width="1.2" stroke-linecap="round"/>`;
      }
      return (
        `<defs><linearGradient id="${uid}-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.head2}"/><stop offset="1" stop-color="${k.head1}"/></linearGradient>` +
        `<filter id="${uid}-b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter></defs>` +
        `<ellipse cx="118" cy="208" rx="82" ry="7" fill="${k.shadow}" opacity=".3" filter="url(#${uid}-b)"/>` +
        `<g transform="matrix(1.12 .13 .03 1.12 40 34)">` +
        rect(10, 7, 130, 156, 3, k.stack2) +
        rect(6, 5, 130, 156, 3, k.stack, `stroke="${k.paperEdge}" stroke-width=".6"`) +
        rect(3, 2.5, 130, 156, 3, k.stack, `stroke="${k.paperEdge}" stroke-width=".6"`) +
        rect(0, 0, 130, 156, 3, k.paper, `stroke="${k.paperEdge}" stroke-width=".8"`) +
        rect(10, 12, 110, 62, 1.5, `url(#${uid}-h)`) +
        `<path d="M10 12H120V28Q60 44 10 34Z" fill="#fff" opacity=".13"/>` +
        dayText(66, 43 + 1 + (56 * CAP) / 2, p.day, 56, "#000000", 800, { opacity: 0.28 }) +
        part("day", dayText(65, 43 + (56 * CAP) / 2, p.day, 56, k.num, 800)) +
        `<path d="${lines}" stroke="${k.gridLine}" stroke-width=".6" fill="none"/>` +
        cells +
        rings +
        `</g>`
      );
    },
  },

  // 12: a plain white page, the weekday in red and a very thin number.
  thin: {
    box: [0, 0, 412, 385],
    numeral: "centre",
    layout: () => ({ page: THIN, yearZone: THIN }),
    draw: ({ p, dark, l }) => {
      const k = dark ? { body: "#1c1c1e", head: "#ff5a48", ink: "#f4f4f6", muted: "#8e8e93" } : { body: "#ffffff", head: "#e8412c", ink: "#0a0a0a", muted: "#9a9a9e" };
      const word = p.weekday || p.month;
      const [x, y, w, h] = l.page;
      const cx = x + w / 2;
      const ws = fit(word, 76, 296, 0.52);
      const ink = (176 * 15) / 16 + 7;
      const [wb, db, yb] = stack(y, y + h, [[ws * CAP, 0], [ink, 24], ...(p.year ? [[29 * CAP, 20] as const] : [])]);
      return (
        rect(0, 0, 412, 385, 88, k.body) +
        part("month", tx(cx, wb!, word, ws, k.head, 300)) +
        part("day", digits(p.day, cx, db! - ink / 2, 176, 7, k.ink, { cap: "butt", gap: 4.5 })) +
        part("year", tx(cx, yb!, p.year, 29, k.muted, 300))
      );
    },
  },

  // 13: four coloured sides round a pale square with a blue number, a folded corner at the bottom right.
  frame: {
    box: [0, -1.4, 195, 181],
    numeral: "centre",
    layout: () => ({ page: FRAME, yearZone: FRAME }),
    draw: ({ p, dark, l }) => {
      const k = dark
        ? { blue: "#4a74e0", blue2: "#2f55c4", yellow: "#e0a424", green: "#2f9244", green2: "#236a33", red: "#cf4237", inner: "#20232b", num: "#7da1f6" }
        : { blue: "#4285f4", blue2: "#0066d9", yellow: "#f9b600", green: "#00a845", green2: "#188038", red: "#ea4335", inner: "#f8f8f8", num: "#4285f4" };
      const [x, y, w, h] = l.page;
      const [db, yb] = stack(y, y + h, [[56 * CAP, 0], ...(p.year ? [[14 * CAP, 9] as const] : [])]);
      return (
        `<path d="M8 20A15 15 0 0 1 23 5H172a15 15 0 0 1 15 15V132L142 173H23A15 15 0 0 1 8 158Z" fill="${k.blue}"/>` +
        `<path d="M142 5H172a15 15 0 0 1 15 15V53H142Z" fill="${k.blue2}"/>` +
        `<path d="M142 53H187V132H142Z" fill="${k.yellow}"/>` +
        `<path d="M52 132H142V173H52Z" fill="${k.green}"/>` +
        `<path d="M8 132H52V173H23A15 15 0 0 1 8 158Z" fill="${k.green2}"/>` +
        `<path d="M142 132H187L142 173Z" fill="${k.red}"/>` +
        `<rect x="52" y="53" width="90" height="79" fill="${k.inner}"/>` +
        part("day", dayText(x + w / 2, db!, p.day, 56, k.num, 700)) +
        part("year", tx(x + w / 2, yb!, p.year, 14, k.num, 700, { opacity: 0.8 }))
      );
    },
  },

  // 14: a white tile and a soft blue page with a light top lip and a white number.
  badge: {
    box: [3.4, 7.8, 110.9, 110.9],
    numeral: "centre",
    layout: () => ({ page: BADGE, yearZone: BADGE }),
    draw: ({ p, dark, uid, l }) => {
      const k = dark ? { tile: "#2a303c", a: "#6f95f7", b: "#4d79e6", lip: "#c1d8fb", tint: "#a09cf7" } : { tile: "#fdfdfb", a: "#6a92f7", b: "#4b78e6", lip: "#cfe3fb", tint: "#9d99f5" };
      const [x, y, w, h] = l.page;
      const [db, yb] = stack(y, y + h, [[41 * CAP, 0], ...(p.year ? [[8.5 * CAP, 5] as const] : [])]);
      return (
        `<defs><linearGradient id="${uid}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.tint}"/><stop offset=".22" stop-color="${k.a}"/><stop offset="1" stop-color="${k.b}"/></linearGradient></defs>` +
        rect(5.6, 10, 106.5, 106.5, 9, k.tile, `stroke="${dark ? "#3a4150" : "#dde1e6"}" stroke-width="1.4"`) +
        `<g transform="translate(-1.65 0)">` +
        `<path d="M38 29Q60 25 82 29Q87 30 88 36H32Q33 30 38 29Z" fill="${k.lip}"/>` +
        `<path d="M38 34H82Q90 34 91 42C92 52 89 60 91 70C92 80 93 86 90 90Q88 97 80 97H40Q32 97 30 90C28 86 30 80 31 70C32 60 28 52 30 42Q31 34 38 34Z" fill="url(#${uid}-g)"/>` +
        `</g>` +
        part("day", dayText(x + w / 2, db!, p.day, 41, "#ffffff", 400)) +
        part("year", tx(x + w / 2, yb!, p.year, 8.5, "#ffffff", 600, { opacity: 0.85 }))
      );
    },
  },

  // 15: a square tear-off page: a grey strip to tear off by, a huge black day over a red disc (a slot for any mark), side columns for the weekday, month and holiday.
  sun: {
    box: [0, 0, 360, 350],
    numeral: "centre",
    layout: (year, weekend) => tearBlock(SUN, SUN_NUMERAL, year, weekend === true).layout,
    draw: (c) => {
      const { p, dark, uid, l, x } = c;
      const k = tearColours(dark);
      const n = SUN_NUMERAL;
      const cx = SUN[0] + SUN[2] / 2;
      const { rows, centre } = tearBlock(SUN, n, p.year !== "", x.split !== null);
      const disc = x.mark === undefined
        ? circle(cx, centre, 94, k.disc)
        : `<g transform="translate(${r2(cx)} ${r2(centre)}) scale(.94)">${x.mark}</g>`;
      const split = l.split;
      const halves = split && x.mark === undefined
        ? `<defs><clipPath id="${uid}-hu"><polygon points="${halfPlane(split.line, true)}"/></clipPath><clipPath id="${uid}-hd"><polygon points="${halfPlane(split.line, false)}"/></clipPath></defs>` +
          `<g clip-path="url(#${uid}-hu)">${circle(cx, centre, 94, dark ? "#3c5fb0" : "#7aa2e6")}</g><g clip-path="url(#${uid}-hd)">${circle(cx, centre, 94, k.disc)}</g>`
        : disc;
      return (
        rect(9, 12, 342, 336, 6, k.back) +
        rect(6, 6, 348, 336, 6, k.paper, `stroke="${k.edge}" stroke-width="1.4"`) +
        `<path d="M6 36V12a6 6 0 0 1 6-6H348a6 6 0 0 1 6 6V36Z" fill="${k.strip}"/>` +
        `<path d="M6 36H354" stroke="${k.muted}" stroke-width="1.2" stroke-dasharray="2.5 3"/>` +
        halves +
        sideColumns(c, k, SUN_LEFT, SUN_RIGHT, false) +
        (split
          ? weekendNumerals(c, k, uid, { saturday: k.ink, sunday: k.ink }, 150)
          : part("day", digits(p.day, cx, centre, n.h, n.sw, k.ink, BIG))) +
        part("year", tx(cx, rows[0]!, p.year, n.year, k.ink, 900, { family: BLACK, spacing: 3 }))
      );
    },
  },

  // 16: a tall wall tear-off page: the pages already torn off curl above, a huge condensed day in the ink of its weekday, side columns, a dotted memo area.
  roll: {
    box: [0, 0, 320, 450],
    numeral: "centre",
    layout: (year, weekend) => tearBlock(ROLL, ROLL_NUMERAL, year, weekend === true).layout,
    draw: (c) => {
      const { p, dark, uid, x } = c;
      const k = tearColours(dark);
      const n = ROLL_NUMERAL;
      const cx = ROLL[0] + ROLL[2] / 2;
      const { rows, centre } = tearBlock(ROLL, n, p.year !== "", x.split !== null);
      let dots = "";
      for (let row = 0; row < 5; row += 1) for (let col = 0; col < 17; col += 1) dots += `<circle cx="${28 + col * 16}" cy="${352 + row * 16}" r="1.5"/>`;
      return (
        `<defs><linearGradient id="${uid}-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.paper}"/><stop offset=".45" stop-color="${k.back}"/><stop offset="1" stop-color="${k.edge}"/></linearGradient>` +
        `<linearGradient id="${uid}-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.ink}" stop-opacity=".22"/><stop offset="1" stop-color="${k.ink}" stop-opacity="0"/></linearGradient></defs>` +
        rect(14, 438, 292, 8, 3, k.edge) +
        rect(10, 432, 300, 8, 3, k.back, `stroke="${k.edge}" stroke-width="1"`) +
        rect(8, 40, 304, 394, 3, k.paper, `stroke="${k.edge}" stroke-width="1.4"`) +
        `<path d="M8 52H312V74H8Z" fill="url(#${uid}-s)"/>` +
        rect(6, 6, 308, 46, 23, `url(#${uid}-r)`, `stroke="${k.edge}" stroke-width="1.4"`) +
        `<path d="M30 20H290M30 33H290" stroke="${k.edge}" stroke-width="1.2" opacity=".8"/>` +
        `<g fill="${k.dot}">${dots}</g>` +
        sideColumns(c, k, ROLL_LEFT, ROLL_RIGHT, true) +
        (c.l.split
          ? weekendNumerals(c, k, uid, { saturday: k.blue, sunday: k.red }, 150)
          : part("day", digits(p.day, cx, centre, n.h, n.sw, inkOf(k, x.day.ink), BIG))) +
        part("year", tx(cx, rows[0]!, p.year, n.year, k.ink, 900, { family: BLACK, spacing: 2 }))
      );
    },
  },

  // 17: a plain, unbranded tear-off pad on a kraft stand: a small month, a big day, the weekday in capitals, the month and year, the moon.
  plain: {
    box: [0, 0, 300, 380],
    numeral: "centre",
    layout: () => ({ page: PLAIN_PAGE, yearZone: [60, 300, 190, 46] }),
    draw: ({ p, dark, uid, month, dayNo, yearNo, l, x }) => {
      const k = tearColours(dark);
      const n = PLAIN_NUMERAL;
      const [px, py, pw, ph] = l.page;
      const cx = px + pw / 2;
      const ink = bigInk(n.h, n.sw);
      const word = x.ja ? p.weekday : p.weekday.toLocaleUpperCase();
      const wordSize = fit(word, n.word, pw, x.ja ? 1.3 : 0.74);
      const [db, wb] = stack(py, py + ph, [[ink, 0], ...(word ? [[wordSize * CAP, n.gap] as const] : [])]);
      const colour = inkOf(k, x.day.ink === "blue" ? "black" : x.day.ink);
      const size = x.ja ? 22 : fit([p.monthShort, p.year].filter(Boolean).join(" "), 22, 150, 0.58);
      const label = x.ja
        ? `<text x="60" y="326" font-size="${size}" font-family="${SANS}" font-weight="500" fill="${k.ink}">${p.year ? `<tspan data-part="year">${p.year}</tspan><tspan font-size="${size - 4}">年</tspan>` : ""}<tspan data-part="month" font-size="${p.year ? size - 4 : size}">${month}月</tspan></text>`
        : `<text x="60" y="326" font-size="${r2(size)}" font-family="${SANS}" font-weight="500" fill="${k.ink}"><tspan data-part="month">${esc(p.monthShort)}</tspan>${p.year ? `<tspan data-part="year" dx="${r2(size * 0.3)}">${esc(p.year)}</tspan>` : ""}</text>`;
      const holiday = x.day.holiday ? tx(cx, wb! + 6 + 14 * CAP + 8, x.day.holiday, fit(x.day.holiday, 14, pw, x.ja ? 1 : 0.6), k.red, 600) : "";
      const moon = x.moon && yearNo !== undefined && p.weekday !== "" ? moonGlyph(236, 316, 12, calendarMoon(yearNo, month, dayNo), k.ink, k.paper) : "";
      return (
        `<defs><linearGradient id="${uid}-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.stripHi}"/><stop offset="1" stop-color="${k.strip}"/></linearGradient></defs>` +
        rect(0, 0, 300, 380, 8, k.kraft) +
        circle(150, 30, 9, k.hole, `stroke="${k.kraftEdge}" stroke-width="1.2"`) +
        rect(48, 356, 204, 6, 2, k.back, `stroke="${k.edge}" stroke-width=".8"`) +
        rect(46, 352, 208, 6, 2, k.paper, `stroke="${k.edge}" stroke-width=".8"`) +
        rect(44, 84, 212, 266, 3, k.paper, `stroke="${k.edge}" stroke-width="1"`) +
        rect(40, 70, 220, 32, 4, `url(#${uid}-m)`, `stroke="${k.edge}" stroke-width="1"`) +
        `<path d="M44 102H256" stroke="${k.ink}" stroke-width="1" opacity=".12"/>` +
        part("monthno", tx(60, 132, String(month), 24, k.ink, 500)) +
        part("day", digits(p.day, cx, db! - ink / 2, n.h, n.sw, colour, { gap: 4.5 })) +
        part("weekday", tx(cx, wb ?? 0, word, wordSize, k.ink, 500, { spacing: x.ja ? 3 : 2.5 })) +
        holiday +
        label +
        moon
      );
    },
  },
};

/** A moon phase (0 new to 7, see `calendarMoon`) as a small disc: the lit part filled, the rest left as an outline. */
function moonGlyph(cx: number, cy: number, r: number, phase: number, ink: string, paper: string): string {
  const outline = `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${phase === 4 ? ink : paper}" stroke="${ink}" stroke-width="1.8"/>`;
  if (phase === 0 || phase === 4) return outline;
  const i = phase < 4 ? phase : 8 - phase;
  const rx = r * Math.abs(Math.cos((Math.PI * 2 * i) / 8));
  const lit = `<path d="M${r2(cx)} ${r2(cy - r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(cx)} ${r2(cy + r)}A${r2(rx)} ${r2(r)} 0 0 ${i < 2 ? 0 : 1} ${r2(cx)} ${r2(cy - r)}Z" fill="${ink}"/>`;
  return outline + (phase < 4 ? lit : `<g transform="translate(${r2(cx)} 0) scale(-1 1) translate(${r2(-cx)} 0)">${lit}</g>`);
}

// ---------- small utilities ----------

function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
