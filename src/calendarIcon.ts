// Original calendar-page drawings as SVG. Fourteen named themes, each in light and dark.
// Every drawing is our own: shapes, gradients and a stroke-drawn digit set. No image, font file or product art is used,
// and theme names are generic: never a company or product name.

export const CALENDAR_THEMES = ["pins", "loops", "shadow", "heavy", "cartoon", "flip", "stack", "line", "curl", "soft", "desk", "thin", "frame", "badge"] as const;

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

interface Ctx {
  p: Parts;
  dark: boolean;
  uid: string;
  month: number;
  dayNo: number;
  yearNo: number | undefined;
}

interface Def {
  /** The drawing's own coordinate box: x, y, width, height. */
  box: readonly [number, number, number, number];
  draw: (c: Ctx) => string;
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
  const parts = dateParts(month, day, options.year, locale);
  const uid = `cal-${theme}-${month}-${day}-${options.year ?? "x"}-${dark ? "d" : "l"}`;
  const def = THEMES[theme];
  const [x, y, w, h] = def.box;
  const body = def.draw({ p: parts, dark, uid, month, dayNo: day, yearNo: options.year });
  const height = Math.round((size * h) / w);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${r1(size)}" height="${height}" role="img" aria-label="${esc(parts.label)}"><title>${esc(parts.label)}</title>${body}</svg>`;
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
const ADVANCE: Record<string, number> = { "1": 4.4 };

interface DigitOptions {
  slant?: number;
  gap?: number;
  cap?: "round" | "butt" | "square";
  base?: boolean;
  /** Shrink the digits, keeping their baseline, until they and their stroke fit this width. */
  maxWidth?: number;
}

/** The number drawn as strokes: centred on `cx`, `top` to `top + h` tall, `sw` thick. */
function digits(value: string, cx: number, top: number, h: number, sw: number, color: string, o: DigitOptions = {}): string {
  const gap = o.gap ?? 2.6;
  const widths = [...value].map((d) => ADVANCE[d] ?? 10);
  const units = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  if (o.maxWidth !== undefined && (units * h) / 16 + sw > o.maxWidth) {
    const f = o.maxWidth / ((units * h) / 16 + sw);
    top += h * (1 - f);
    h *= f;
    sw *= f;
  }
  const k = h / 16;
  const total = units * k;
  let x = cx - total / 2;
  let out = "";
  [...value].forEach((d, i) => {
    const path = d === "9" ? `<path d="${SK["6"]}" transform="rotate(180 5 8)"/>` : `<path d="${SK[d]}"/>`;
    const serif = o.base && d === "1" ? '<path d="M-.8 15.5h8"/>' : "";
    out += `<g transform="translate(${r2(x)} ${r2(top)}) scale(${r3(k)})" stroke-width="${r3(sw / k)}">${path}${serif}</g>`;
    x += (widths[i]! + gap) * k;
  });
  const cap = o.cap ?? "round";
  const inner = `<g fill="none" stroke="${color}" stroke-linecap="${cap}" stroke-linejoin="${cap === "butt" ? "miter" : "round"}">${out}</g>`;
  if (!o.slant) return inner;
  const by = top + h;
  return `<g transform="translate(${r2(cx)} ${r2(by)}) skewX(${-o.slant}) translate(${r2(-cx)} ${r2(-by)})">${inner}</g>`;
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

// ---------- the fourteen themes ----------

const THEMES: Record<CalendarTheme, Def> = {
  // 01: flat page, red header, two slate pins through white holes.
  pins: {
    box: [20, 15, 273, 280],
    draw: ({ p, dark }) => {
      const k = dark
        ? { head: "#d4442f", body: "#2c3539", ink: "#e9eff1", muted: "#9aaab0", hole: "#2c3539", pin: "#e9eff1" }
        : { head: "#ee4338", body: "#ffffff", ink: "#3a4a4f", muted: "#7c8c91", hole: "#ffffff", pin: "#3a4a4f" };
      const pin = (cx: number) => circle(cx, 72, 14.5, k.hole) + rect(cx - 9.5, 25, 19, 57, 9.5, k.pin);
      return (
        rect(35, 40, 243, 245, 28, k.body, `stroke="${dark ? "none" : "#e4e9eb"}" stroke-width="1.6"`) +
        topRound(35, 40, 243, 65, 28, k.head) +
        pin(93) + pin(221) +
        fitted(156.5, 147, p.monthUp, 37, 160, 0.68, k.ink, 600, { spacing: 1 }) +
        tx(156.5, 255, p.day, 111, k.ink, 700) +
        tx(156.5, 277, p.year, 15, k.muted, 600)
      );
    },
  },

  // 02: grey outline, grey header, three ring pins.
  loops: {
    box: [30, 36, 270, 285],
    draw: ({ p, dark }) => {
      const k = dark
        ? { line: "#c3c3c3", head: "#6e6e6e", body: "#262626", ink: "#e6e6e6", hole: "#262626", pin: "#c3c3c3", yr: "#ffffff" }
        : { line: "#5b5b5b", head: "#828282", body: "#ffffff", ink: "#555555", hole: "#ffffff", pin: "#5b5b5b", yr: "#ffffff" };
      const ring = (cx: number) => circle(cx, 100, 16.5, k.hole, `stroke="${k.line}" stroke-width="6"`) + rect(cx - 7, 52, 14, 46, 7, k.pin);
      return (
        rect(56, 67, 217, 229, 26, k.body, `stroke="${k.line}" stroke-width="7"`) +
        `<path d="M60.5 155V90a22 22 0 0 1 22-22h162a22 22 0 0 1 22 22v65Z" fill="${k.head}"/>` +
        `<path d="M56 155h217" stroke="${k.line}" stroke-width="7"/>` +
        ring(99) + ring(164) + ring(228) +
        tx(164.5, 138, p.year, 22, k.yr, 700, { opacity: 0.9 }) +
        fitted(164.5, 214, p.month, 36, 180, 0.6, k.ink, 700) +
        tx(164.5, 281, p.day, 62, k.ink, 700)
      );
    },
  },

  // 03: blue header with black coils, a circled day, a long shadow on a lavender tile.
  shadow: {
    box: [8, 6, 334, 336],
    draw: ({ p, dark, uid }) => {
      const k = dark
        ? { tile: "#2c2e4f", shade: "#202241", head: "#3a78b8", body: "#20222b", ink: "#f5f6fb", ring: "#7fb2e8", coil: "#0b0b10", monthStroke: "#13304f" }
        : { tile: "#d8d9fa", shade: "#b3b5e6", head: "#2b5f95", body: "#ffffff", ink: "#000000", ring: "#2b5f95", coil: "#0a0a0a", monthStroke: "#173a5e" };
      const coil = (cx: number) => rect(cx - 4.5, 86, 9, 30, 4.5, k.coil) + circle(cx, 116, 3, k.body, `stroke="${k.coil}" stroke-width="2"`);
      return (
        `<defs><clipPath id="${uid}-t"><rect x="12" y="10" width="326" height="326" rx="22"/></clipPath></defs>` +
        rect(12, 10, 326, 326, 22, k.tile) +
        `<g clip-path="url(#${uid}-t)"><polygon points="80,97 258,97 580,419 402,419 80,272" fill="${k.shade}"/></g>` +
        rect(80, 97, 178, 175, 7, k.body) +
        topRound(80, 97, 178, 51, 7, k.head) +
        coil(100) + coil(134) + coil(168) + coil(202) + coil(236) +
        fitted(169, 141, p.monthUp, 30, 146, 0.76, "#ffffff", 700, { family: SERIF, spacing: 1, stroke: k.monthStroke, strokeWidth: 1.4 }) +
        circle(169, 214, 51, "none", `stroke="${k.ring}" stroke-width="2.2"`) +
        circle(169, 214, 45.5, "none", `stroke="${k.ring}" stroke-width="3.6"`) +
        tx(169, 236, p.day, 58, k.ink, 900, { family: BLACK }) +
        tx(169, 326, p.year, 15, k.ring, 700)
      );
    },
  },

  // 04: heavy black outline, ring slots over the top edge, black header rule.
  heavy: {
    box: [38, 60, 352, 320],
    draw: ({ p, dark }) => {
      const k = dark ? { line: "#f2f2f2", body: "#161616", ink: "#f2f2f2" } : { line: "#000000", body: "#ffffff", ink: "#000000" };
      const ring = (cx: number) => rect(cx - 23.5, 69, 47, 63, 23.5, k.line) + rect(cx - 10.5, 82, 21, 40, 10.5, k.body);
      return (
        rect(55.5, 104.5, 317, 257, 14, k.body, `stroke="${k.line}" stroke-width="21"`) +
        `<path d="M46 174h336" stroke="${k.line}" stroke-width="19"/>` +
        ring(110) + ring(181.5) + ring(253.5) + ring(325) +
        fitted(212, 243.5, p.monthUp, 56, 150, 0.84, k.ink, 900, { family: BLACK }) +
        tx(214, 321, p.day, 98, k.ink, 900, { family: BLACK }) +
        tx(214, 345, p.year, 15, k.ink, 900, { family: BLACK, opacity: 0.55 })
      );
    },
  },

  // 05: black cartoon outline, pink header, white ring loops, bold glossy word and number.
  cartoon: {
    box: [56, 56, 238, 262],
    draw: ({ p, dark, uid }) => {
      const k = dark
        ? { line: "#f4f4f4", body: "#1a1a1a", head: "#c45b86", ink: "#f4f4f4", hl: "#ffffff" }
        : { line: "#0a0a0a", body: "#ffffff", head: "#f9a8cb", ink: "#0a0a0a", hl: "#ffffff" };
      const loop = (cx: number) =>
        rect(cx - 9, 74, 18, 56, 9, k.body, `stroke="${k.line}" stroke-width="6"`) +
        rect(cx - 2.5, 84, 5, 30, 2.5, k.line);
      return (
        rect(72.5, 103, 205, 197, 30, k.body, `stroke="${k.line}" stroke-width="9"`) +
        `<clipPath id="${uid}-h"><rect x="72.5" y="103" width="205" height="197" rx="30"/></clipPath>` +
        `<g clip-path="url(#${uid}-h)">${rect(60, 90, 230, 54, 0, k.head)}<path d="M60 144h230" stroke="${k.line}" stroke-width="6"/></g>` +
        loop(108) + loop(175) + loop(242) +
        fitted(175, 190, p.monthUp, 46, 160, 0.84, k.ink, 900, { family: BLACK, spacing: 1 }) +
        tx(175, 274, p.day, 92, k.ink, 900, { family: BLACK }) +
        tx(175, 291, p.year, 13, k.ink, 900, { family: BLACK, opacity: 0.45 })
      );
    },
  },

  // 06: a flip calendar in perspective: coils, a pale header, a slanted italic number, a fan of pages.
  flip: {
    box: [52, 78, 340, 262],
    draw: ({ p, dark }) => {
      const k = dark
        ? { line: "#9fb7c4", page: "#222c33", head: "#3c5f73", headTop: "#2f4b5b", bar: "#3a464d", ink: "#dcebf2", stack: "#2b363d", edge: "#4c6270" }
        : { line: "#2f4858", page: "#ffffff", head: "#a8dbe9", headTop: "#7fafc0", bar: "#dde1e4", ink: "#2d4858", stack: "#8ea6b3", edge: "#d8e3e9" };
      const coil = (cx: number) =>
        `<path d="M${cx - 7} 126C${cx - 7} 96 ${cx - 5} 90 ${cx} 90s7 6 7 36" fill="none" stroke="${k.line}" stroke-width="6" stroke-linecap="round"/>`;
      return (
        `<path d="M318 116L336 124 376 312 352 322 268 318Z" fill="${k.stack}" stroke="${k.line}" stroke-width="6" stroke-linejoin="round"/>` +
        `<path d="M326 130L346 316M336 134L356 316M346 142L363 314M318 126L332 318" stroke="${k.edge}" stroke-width="3" fill="none"/>` +
        `<path d="M120 122L318 116 270 310Q268 318 258 318H78Q64 318 68 304Z" fill="${k.page}" stroke="${k.line}" stroke-width="7" stroke-linejoin="round"/>` +
        `<path d="M120 122L318 116 306 164 108 168Z" fill="${k.head}" stroke="${k.line}" stroke-width="7" stroke-linejoin="round"/>` +
        `<path d="M118 126L316 120 312 138 114 144Z" fill="${k.headTop}"/>` +
        `<path d="M92 284L252 280 248 300 88 304Z" fill="${k.bar}"/>` +
        coil(138) + coil(172) + coil(206) + coil(240) + coil(274) + coil(308) +
        digits(p.day, 196, 178, 96, 12, k.ink, { slant: 12, cap: "square", base: true, gap: 3, maxWidth: 190 }) +
        tx(170, 297, p.year, 15, k.ink, 700, { opacity: 0.6 })
      );
    },
  },

  // 07: solid black glyph with a tilted white page, a curled corner and a sheet underneath.
  stack: {
    box: [50, 40, 620, 570],
    draw: ({ p, dark }) => {
      const k = dark ? { base: "#ececec", page: "#161616", ink: "#f2f2f2" } : { base: "#050505", page: "#ffffff", ink: "#050505" };
      const hook = (cx: number) =>
        rect(cx - 31, 122, 62, 64, 31, k.page) +
        `<path d="M${cx - 20} 112V98Q${cx - 20} 72 ${cx + 4} 72Q${cx + 28} 72 ${cx + 28} 98V165" fill="none" stroke="${k.base}" stroke-width="20" stroke-linecap="round"/>`;
      return (
        `<path d="M110 105H640V582H135V560Z" fill="${k.base}"/>` +
        `<path d="M110 105V215H620V105Z" fill="${k.base}"/>` +
        `<path d="M150 546H606" stroke="${k.page}" stroke-width="12"/>` +
        `<path d="M135 215L596 215 612 285C600 420 556 510 466 524H106Q74 524 80 488Z" fill="${k.page}" stroke="${k.base}" stroke-width="22" stroke-linejoin="round"/>` +
        `<path d="M466 524C476 486 496 454 520 446L610 288C602 420 556 510 466 524Z" fill="${k.base}"/>` +
        hook(235) + hook(492) +
        tx(338, 440, p.day, 235, k.ink, 900, { family: BLACK, italic: true }) +
        tx(300, 503, p.year, 34, k.ink, 900, { family: BLACK, italic: true, opacity: 0.55 })
      );
    },
  },

  // 08: black line art, a header rule, four tick marks and a big blue number.
  line: {
    box: [56, 40, 260, 255],
    draw: ({ p, dark }) => {
      const k = dark ? { line: "#f1f1f1", body: "#141414", num: "#5aa0e6" } : { line: "#080808", body: "#ffffff", num: "#2f78bd" };
      const tick = (cx: number) => `<path d="M${cx} 57.5V84.5" stroke="${k.line}" stroke-width="11" stroke-linecap="round"/>`;
      return (
        rect(76.5, 73.5, 219, 200, 18, k.body, `stroke="${k.line}" stroke-width="13"`) +
        `<path d="M72 115h228" stroke="${k.line}" stroke-width="11"/>` +
        tick(120) + tick(163) + tick(207) + tick(252) +
        tx(186, 228, p.day, 109, k.num, 900, { family: BLACK }) +
        fitted(186, 262, [p.monthShortUp, p.year].filter(Boolean).join(" "), 19, 190, 0.72, k.num, 800, { family: BLACK })
      );
    },
  },

  // 09: line art with an orange header, two hooks, thin rounded digits and a curled lower corner.
  curl: {
    box: [28, 46, 330, 360],
    draw: ({ p, dark }) => {
      const k = dark
        ? { line: "#f1ede8", body: "#2a2623", head: "#c98a2c", dhead: "#a56a16", foot: "#443d38", fold: "#5a5049", ink: "#f4efe9" }
        : { line: "#0b0b0b", body: "#f6f0ed", head: "#f7c978", dhead: "#f1a94c", foot: "#cdc1ba", fold: "#cdc1ba", ink: "#0d0d0d" };
      const hook = (cx: number) =>
        rect(cx - 12, 82, 24, 46, 8, k.dhead) +
        `<path d="M${cx - 11} 132V76a11.5 11.5 0 0 1 23 0V132" fill="none" stroke="${k.line}" stroke-width="9" stroke-linecap="round"/>`;
      return (
        `<path d="M340.5 300V116a30 30 0 0 0-30-30.5H74a30 30 0 0 0-30.5 30.5V356a30 30 0 0 0 30 31.5H252Z" fill="${k.body}"/>` +
        `<path d="M43.5 150V116a30 30 0 0 1 30-30.5h237a30 30 0 0 1 30 30.5v34Z" fill="${k.head}"/>` +
        `<path d="M43.5 366h208l-13 21.5H73a30 30 0 0 1-29.5-30Z" fill="${k.foot}"/>` +
        `<path d="M340.5 300V116a30 30 0 0 0-30-30.5H74a30 30 0 0 0-30.5 30.5V356a30 30 0 0 0 30 31.5H252" fill="none" stroke="${k.line}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M44 153H340" stroke="${k.line}" stroke-width="9"/>` +
        `<path d="M276 310Q268 306 262 316L254 384 338 300Q340 296 332 298Z" fill="${k.fold}" stroke="${k.line}" stroke-width="9" stroke-linejoin="round"/>` +
        hook(100) + hook(282) +
        fitted(191, 134, p.month, 40, 120, 0.55, k.ink, 700) +
        digits(p.day, 190, 200, 104, 9.5, k.ink) +
        tx(150, 360, p.year, 20, k.ink, 700, { opacity: 0.55 })
      );
    },
  },

  // 10: flat red-orange header, three amber rings, a cream page with a side shade and a rounded coral number.
  soft: {
    box: [40, 48, 292, 312],
    draw: ({ p, dark }) => {
      const k = dark
        ? { head: "#d0553c", headHi: "#e2694f", body: "#352c27", side: "#2a221e", ring: "#e9a73a", ringDark: "#cf8d22", num: "#f08a6f", hi: "#ffffff" }
        : { head: "#ee5a3a", headHi: "#ef6f4f", body: "#fbe8cb", side: "#f8d08f", ring: "#f7b844", ringDark: "#f0a130", num: "#ee6a4c", hi: "#ffffff" };
      const ring = (cx: number) => rect(cx - 12, 62, 24, 52, 12, k.ring) + rect(cx - 12, 88, 24, 26, 12, k.ringDark, 'opacity=".65"');
      return (
        rect(52, 132, 76, 218, 28, k.side) +
        topRound(52, 88, 266, 60, 28, k.head) +
        rect(90, 95, 230, 258, 30, k.body) +
        topRound(90, 95, 230, 54, 30, k.headHi) +
        ring(117) + ring(185) + ring(253) +
        fitted(205, 140, p.monthShort, 34, 160, 0.6, "#ffffff", 700) +
        digits(p.day, 205, 168, 142, 34, k.num, { gap: 3.2, maxWidth: 178 }) +
        rect(306, 163, 7, 28, 3.5, k.hi, 'opacity=".75"') + rect(306, 205, 7, 56, 3.5, k.hi, 'opacity=".75"') +
        tx(205, 342, p.year, 20, k.num, 700, { opacity: 0.8 })
      );
    },
  },

  // 11: a desk pad seen from an angle: coils, a red banner with a white number, a month of small dates.
  desk: {
    box: [8, 8, 206, 214],
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
        tx(66, 62, p.day, 56, "#000000", 800, { opacity: 0.28 }) +
        tx(65, 61, p.day, 56, k.num, 800) +
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
    draw: ({ p, dark }) => {
      const k = dark ? { body: "#1c1c1e", head: "#ff5a48", ink: "#f4f4f6", muted: "#8e8e93" } : { body: "#ffffff", head: "#e8412c", ink: "#0a0a0a", muted: "#9a9a9e" };
      const word = p.weekday || p.month;
      return (
        rect(0, 0, 412, 385, 88, k.body) +
        fitted(206, 98, word, 76, 296, 0.52, k.head, 300) +
        digits(p.day, 208, 140, 188, 7, k.ink, { cap: "butt", gap: 2.2, maxWidth: 260 }) +
        tx(206, 362, p.year, 24, k.muted, 300)
      );
    },
  },

  // 13: four coloured sides round a pale square with a blue number, a folded corner at the bottom right.
  frame: {
    box: [0, 0, 195, 181],
    draw: ({ p, dark }) => {
      const k = dark
        ? { blue: "#4a74e0", blue2: "#2f55c4", yellow: "#e0a424", green: "#2f9244", green2: "#236a33", red: "#cf4237", inner: "#20232b", num: "#7da1f6" }
        : { blue: "#4285f4", blue2: "#0066d9", yellow: "#f9b600", green: "#00a845", green2: "#188038", red: "#ea4335", inner: "#f8f8f8", num: "#4285f4" };
      return (
        `<path d="M8 20A15 15 0 0 1 23 5H172a15 15 0 0 1 15 15V132L142 173H23A15 15 0 0 1 8 158Z" fill="${k.blue}"/>` +
        `<path d="M142 5H172a15 15 0 0 1 15 15V53H142Z" fill="${k.blue2}"/>` +
        `<path d="M142 53H187V132H142Z" fill="${k.yellow}"/>` +
        `<path d="M52 132H142V173H52Z" fill="${k.green}"/>` +
        `<path d="M8 132H52V173H23A15 15 0 0 1 8 158Z" fill="${k.green2}"/>` +
        `<path d="M142 132H187L142 173Z" fill="${k.red}"/>` +
        `<rect x="52" y="53" width="90" height="79" fill="${k.inner}"/>` +
        tx(97, 104, p.day, 56, k.num, 700) +
        tx(97, 124, p.year, 13, k.num, 700, { opacity: 0.8 })
      );
    },
  },

  // 14: a white tile and a soft blue page with a light top lip and a white number.
  badge: {
    box: [4, 8, 112, 112],
    draw: ({ p, dark, uid }) => {
      const k = dark ? { tile: "#2a303c", a: "#6f95f7", b: "#4d79e6", lip: "#c1d8fb", tint: "#a09cf7" } : { tile: "#fdfdfb", a: "#6a92f7", b: "#4b78e6", lip: "#cfe3fb", tint: "#9d99f5" };
      return (
        `<defs><linearGradient id="${uid}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.tint}"/><stop offset=".22" stop-color="${k.a}"/><stop offset="1" stop-color="${k.b}"/></linearGradient></defs>` +
        rect(5.6, 10, 106.5, 106.5, 9, k.tile, `stroke="${dark ? "#3a4150" : "#dde1e6"}" stroke-width="1.4"`) +
        `<path d="M38 29Q60 25 82 29Q87 30 88 36H32Q33 30 38 29Z" fill="${k.lip}"/>` +
        `<path d="M38 34H82Q90 34 91 42C92 52 89 60 91 70C92 80 93 86 90 90Q88 97 80 97H40Q32 97 30 90C28 86 30 80 31 70C32 60 28 52 30 42Q31 34 38 34Z" fill="url(#${uid}-g)"/>` +
        tx(60, 80, p.day, 41, "#ffffff", 400) +
        tx(60, 93, p.year, 7.5, "#ffffff", 600, { opacity: 0.85 })
      );
    },
  },
};

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
