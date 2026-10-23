// Original calendar-page drawings as SVG. Ten named themes, each in light and dark.
// No image is used. Theme names are generic: never a company or product name.

export const CALENDAR_THEMES = ["classic", "outline", "spiral", "bold", "tent", "curl", "pad", "minimal", "fold", "tile"] as const;

export type CalendarTheme = (typeof CALENDAR_THEMES)[number];

export const CALENDAR_THEME_LABELS: Record<CalendarTheme, { en: string; ja: string }> = {
  classic: { en: "Classic", ja: "クラシック" },
  outline: { en: "Outline", ja: "線画" },
  spiral: { en: "Spiral", ja: "リング綴じ" },
  bold: { en: "Bold", ja: "太枠" },
  tent: { en: "Tent", ja: "卓上" },
  curl: { en: "Curl", ja: "めくり" },
  pad: { en: "Pad", ja: "日めくり" },
  minimal: { en: "Minimal", ja: "数字" },
  fold: { en: "Fold", ja: "折り角" },
  tile: { en: "Tile", ja: "タイル" },
};

export interface CalendarIconOptions {
  /** Month 1–12. */
  month: number;
  /** Day of the month 1–31. */
  day: number;
  /** Four-digit year drawn on the year chip. Omit to leave the chip off. */
  year?: number;
  theme?: CalendarTheme;
  /** `en` (the default) or any locale `Intl` accepts. */
  locale?: string;
  scheme?: "light" | "dark";
  /** Width in CSS pixels. Height follows the theme's page. Default 96. */
  size?: number;
}

interface Palette {
  paper: string;
  ink: string;
  header: string;
  headerInk: string;
  ring: string;
  muted: string;
  shade: string;
  chip: string;
}

interface Parts {
  month: string;
  weekday: string;
  day: string;
  year: string;
  label: string;
}

const FONT = "ui-sans-serif,system-ui,sans-serif";

/** The named theme, or null when the word is not one of ours. */
export function calendarThemeOf(name: string | null | undefined): CalendarTheme | null {
  const id = name?.trim().toLowerCase();
  return id && (CALENDAR_THEMES as readonly string[]).includes(id) ? (id as CalendarTheme) : null;
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
  const theme = options.theme ?? "classic";
  if (!calendarThemeOf(theme)) throw new RangeError(`unknown calendar theme: ${theme}`);
  const locale = options.locale?.trim() || "en";
  const scheme = options.scheme === "dark" ? "dark" : "light";
  const size = options.size ?? 96;
  if (!Number.isFinite(size) || size < 16 || size > 1024) throw new RangeError("size must be 16–1024");
  const parts = dateParts(month, day, options.year, locale);
  const p = palette(scheme, theme);
  const uid = `cal-${theme}-${month}-${day}-${options.year ?? "x"}-${scheme}`;
  const body = drawers[theme](p, parts, uid);
  const box = theme === "fold" || theme === "tile" || theme === "minimal" ? [64, 64] : [64, 80];
  const height = Math.round((size * box[1]) / box[0]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box[0]} ${box[1]}" width="${round(size)}" height="${height}" role="img" aria-label="${esc(parts.label)}">${body}</svg>`;
}

function dateParts(month: number, day: number, year: number | undefined, locale: string): Parts {
  const utc = Date.UTC(year ?? 2000, month - 1, day);
  const date = new Date(utc);
  const monthText = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(date);
  const yearText = year === undefined ? "" : String(year);
  const label = [monthText, String(day), yearText].filter(Boolean).join(" ");
  return { month: monthText, weekday, day: String(day), year: yearText, label };
}

function palette(scheme: "light" | "dark", theme: CalendarTheme): Palette {
  if (theme === "tile") {
    return scheme === "dark"
      ? { paper: "#2a4a4a", ink: "#f3f7f6", header: "#2a4a4a", headerInk: "#f3f7f6", ring: "#7aa8a4", muted: "#b7c9c6", shade: "#1a3030", chip: "#1a3030" }
      : { paper: "#2f6f6a", ink: "#f7fffe", header: "#2f6f6a", headerInk: "#f7fffe", ring: "#1d4a46", muted: "#d5ece8", shade: "#1d4a46", chip: "#1d4a46" };
  }
  if (theme === "fold") {
    return scheme === "dark"
      ? { paper: "#2a2438", ink: "#f4eefc", header: "#5b4a86", headerInk: "#f4eefc", ring: "#8d7ab8", muted: "#c9bfd8", shade: "#1a1624", chip: "#1a1624" }
      : { paper: "#f4eefc", ink: "#2a2438", header: "#5b4a86", headerInk: "#f4eefc", ring: "#5b4a86", muted: "#6d627c", shade: "#d5cbe6", chip: "#5b4a86" };
  }
  return scheme === "dark"
    ? { paper: "#1c1814", ink: "#f4ece4", header: "#b33a2c", headerInk: "#fff8f0", ring: "#d08070", muted: "#b8aaa0", shade: "#0e0c0a", chip: "#3a2e28" }
    : { paper: "#fffaf3", ink: "#1a1510", header: "#c23b2a", headerInk: "#fff8f0", ring: "#8b2a1e", muted: "#6a5e54", shade: "#d8cfc4", chip: "#1a1510" };
}

const drawers: Record<CalendarTheme, (p: Palette, parts: Parts, uid: string) => string> = {
  classic: (p, parts) =>
    page(p, 8, 12, 48, 62, 6) +
    rings(p, 24, 40, 12, 4.2) +
    headerBar(p, 8, 16, 48, 14, 6) +
    text(32, 26.4, parts.month, 7, p.headerInk, 700) +
    text(32, 50, parts.day, 20, p.ink, 700) +
    yearMark(p, parts.year, 21, 64),
  outline: (p, parts) =>
    `<rect x="9" y="13" width="46" height="60" rx="6" fill="none" stroke="${p.ink}" stroke-width="2.2"/>` +
    `<rect x="9" y="17" width="46" height="13" rx="0" fill="none" stroke="${p.ink}" stroke-width="2.2"/>` +
    ringsStroke(p, 24, 40, 13, 4) +
    text(32, 27, parts.month, 7, p.ink, 700) +
    text(32, 51, parts.day, 18, p.ink, 700) +
    yearMark(p, parts.year, 21, 65, true),
  spiral: (p, parts) =>
    coils(p, 16, 9, 5) +
    page(p, 10, 14, 44, 58, 3) +
    `<rect x="10" y="14" width="44" height="12" fill="${p.header}"/>` +
    text(32, 23.2, parts.month, 6.5, p.headerInk, 700) +
    text(32, 48, parts.day, 20, p.ink, 700) +
    yearMark(p, parts.year, 21, 64),
  bold: (p, parts) =>
    `<rect x="7" y="14" width="50" height="58" rx="4" fill="${p.paper}" stroke="${p.ink}" stroke-width="4"/>` +
    `<rect x="18" y="10" width="8" height="8" rx="1.4" fill="${p.paper}" stroke="${p.ink}" stroke-width="3"/>` +
    `<rect x="38" y="10" width="8" height="8" rx="1.4" fill="${p.paper}" stroke="${p.ink}" stroke-width="3"/>` +
    `<rect x="9" y="18" width="46" height="12" fill="${p.header}"/>` +
    text(32, 27.2, parts.month, 7, p.headerInk, 800) +
    text(32, 52, parts.day, 20, p.ink, 800) +
    yearMark(p, parts.year, 21, 64),
  tent: (p, parts) =>
    `<polygon points="16,18 58,14 58,70 16,74" fill="${p.shade}"/>` +
    `<rect x="8" y="16" width="44" height="58" rx="3" fill="${p.paper}" stroke="${p.ink}" stroke-width="1.4"/>` +
    `<rect x="8" y="16" width="44" height="13" fill="${p.header}"/>` +
    `<line x1="8" y1="16" x2="52" y2="16" stroke="${p.ink}" stroke-width="1.4"/>` +
    text(30, 25.6, parts.month, 6.5, p.headerInk, 700) +
    text(30, 50, parts.day, 18, p.ink, 700) +
    yearMark(p, parts.year, 17, 66),
  curl: (p, parts, uid) =>
    page(p, 9, 12, 46, 60, 5) +
    rings(p, 24, 40, 12, 3.6) +
    headerBar(p, 9, 16, 46, 12, 5) +
    text(32, 25.2, parts.month, 6.5, p.headerInk, 700) +
    text(30, 48, parts.day, 18, p.ink, 700) +
    `<defs><clipPath id="${uid}-curl"><path d="M55 54 L55 67 Q55 72 50 72 L38 72 Z"/></clipPath></defs>` +
    `<path d="M38 72 L55 54 L55 67 Q55 72 50 72 Z" fill="${p.shade}" stroke="${p.ink}" stroke-width="1"/>` +
    `<path d="M38 72 L55 54 L44 54 Q38 54 38 60 Z" fill="${p.paper}" stroke="${p.ink}" stroke-width="1"/>` +
    (parts.year ? text(48, 68, parts.year.slice(2), 5.5, p.ink, 700) : ""),
  pad: (p, parts) =>
    `<rect x="16" y="16" width="40" height="56" rx="2" fill="${p.shade}"/>` +
    `<rect x="13" y="14" width="40" height="56" rx="2" fill="${p.muted}"/>` +
    page(p, 10, 12, 40, 56, 2) +
    `<rect x="10" y="12" width="40" height="11" fill="${p.header}"/>` +
    text(30, 20.4, parts.month, 6, p.headerInk, 700) +
    grid(p, 14, 40, 32, 16, 7, 4) +
    text(30, 46, parts.day, 16, p.ink, 700) +
    yearMark(p, parts.year, 19, 60),
  minimal: (p, parts) =>
    `<rect x="4" y="4" width="56" height="56" rx="8" fill="${p.paper}"/>` +
    text(32, 18, parts.weekday, 7, p.header, 700) +
    text(32, 42, parts.day, 24, p.ink, 700) +
    (parts.year ? text(32, 56, parts.year, 7, p.muted, 700) : ""),
  fold: (p, parts) =>
    `<rect x="6" y="6" width="52" height="52" rx="8" fill="${p.paper}" stroke="${p.shade}" stroke-width="1"/>` +
    `<path d="M42 6 H50 A8 8 0 0 1 58 14 V22 L42 6 Z" fill="${p.header}"/>` +
    `<path d="M42 6 L58 22 L42 22 Q42 6 42 6 Z" fill="${p.shade}"/>` +
    text(30, 24, parts.month, 6, p.muted, 700) +
    text(30, 42, parts.day, 18, p.ink, 700) +
    (parts.year ? text(30, 52, parts.year, 6, p.muted, 700) : ""),
  tile: (p, parts) =>
    `<rect x="4" y="4" width="56" height="56" rx="14" fill="${p.paper}"/>` +
    text(32, 20, parts.month, 6.5, p.muted, 700) +
    text(32, 40, parts.day, 20, p.ink, 700) +
    (parts.year ? text(32, 52, parts.year, 6.5, p.muted, 700) : ""),
};

function page(p: Palette, x: number, y: number, w: number, h: number, r: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${p.paper}" stroke="${p.shade}" stroke-width="1"/>`;
}

function headerBar(p: Palette, x: number, y: number, w: number, h: number, r: number): string {
  return `<path d="M${x} ${y + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h} Z" fill="${p.header}"/>`;
}

function rings(p: Palette, x1: number, x2: number, y: number, r: number): string {
  return `<circle cx="${x1}" cy="${y}" r="${r}" fill="${p.paper}" stroke="${p.ring}" stroke-width="1.8"/>` +
    `<circle cx="${x2}" cy="${y}" r="${r}" fill="${p.paper}" stroke="${p.ring}" stroke-width="1.8"/>`;
}

function ringsStroke(p: Palette, x1: number, x2: number, y: number, r: number): string {
  return `<circle cx="${x1}" cy="${y}" r="${r}" fill="none" stroke="${p.ink}" stroke-width="2"/>` +
    `<circle cx="${x2}" cy="${y}" r="${r}" fill="none" stroke="${p.ink}" stroke-width="2"/>`;
}

function coils(p: Palette, x: number, y: number, count: number): string {
  let out = "";
  for (let i = 0; i < count; i += 1) {
    out += `<ellipse cx="${x + i * 8}" cy="${y}" rx="2.6" ry="4.4" fill="none" stroke="${p.ink}" stroke-width="1.6"/>`;
  }
  return out;
}

function grid(p: Palette, x: number, y: number, w: number, h: number, cols: number, rows: number): string {
  const cw = w / cols;
  const rh = h / rows;
  let out = "";
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      out += `<rect x="${round(x + c * cw + 0.6)}" y="${round(y + r * rh + 0.6)}" width="${round(cw - 1.2)}" height="${round(rh - 1.2)}" rx="0.6" fill="none" stroke="${p.shade}" stroke-width="0.6"/>`;
    }
  }
  return out;
}

function yearMark(p: Palette, year: string, x: number, y: number, outline = false): string {
  if (!year) return "";
  const fill = outline ? "none" : p.chip;
  const stroke = outline ? ` stroke="${p.ink}" stroke-width="1.4"` : "";
  const ink = outline ? p.ink : p.paper;
  return `<rect x="${x}" y="${y}" width="22" height="8" rx="2" fill="${fill}"${stroke}/>` +
    `<text x="${x + 11}" y="${y + 6.1}" text-anchor="middle" font-size="5.6" font-family="${FONT}" fill="${ink}" font-weight="700">${esc(year)}</text>`;
}

function text(x: number, y: number, value: string, size: number, fill: string, weight: number): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-family="${FONT}" fill="${fill}" font-weight="${weight}">${esc(value)}</text>`;
}

function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
