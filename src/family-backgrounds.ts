// family-backgrounds: twenty-five original poster backgrounds, each drawn in code as SVG (gradients, radial glows, patterns, bezier bands, playing-surface markings), each in a dark
// and a light variant, and the text and line colours that stay readable over them. No image is used, nothing is fetched and nothing is imported.
//
// This file is the same, byte for byte, in every package of the family that draws a background (Taisen Brackets, Kyogijo and the rest): a package copies it at build time and
// never edits it. A change is made here, the version below is raised, and `test/family-backgrounds.test.ts` holds the sha256 of this file, so a copy that drifted is found.
// MIT licence. Every preset is the work of this package's author; none is traced from, or copies, anyone's artwork, logo, trophy or photograph.
//
//   backgroundSvg("midnight", { width: 1080, height: 1350, theme: "dark" }) -> { defs, body, ink }
//
// `defs` goes inside the drawing's `<defs>`, `body` right after a plain rectangle of `ink.base`, and `ink` says which colours to draw text, lines, boxes and marks in.
export const FAMILY_BACKGROUNDS_VERSION = "1.0.1";

/** The presets, by name. The five that end in a playing surface read as one: pitch (soccer), ice (hockey), hardwood (basketball), infield (baseball) and turf (football). */
export const BACKGROUND_PRESETS = [
  "midnight", "crimson", "royal", "emerald", "pitch", "ice", "hardwood", "infield", "turf", "ball-panels", "swirl", "waves", "glow",
  "floodlights", "confetti", "carbon", "aurora", "sunburst", "chevrons", "halftone", "argyle", "contour", "stardust", "mesh", "spotlight",
] as const;

export type BackgroundPresetName = (typeof BACKGROUND_PRESETS)[number];

export interface BackgroundSvgOptions {
  width: number;
  height: number;
  /** `dark` (the default) or `light`: which of the preset's two palettes. With your own `colors`, the ink follows what they are. */
  theme?: "dark" | "light";
  /** Your own colours, as hex (`#0b1230`) or `rgb()`: the first two make the ground, the third and fourth the glow and the pattern. Fewer than four keep the preset's for the rest. */
  colors?: readonly string[];
  /** The angle of the ground's gradient and of the pattern over it, in degrees as CSS has it (180 is top to bottom). The preset's own by default; a playing surface keeps its lines straight. */
  angle?: number;
  /** How strong the pattern and glow are, 0 to 1. Default 0.6. */
  intensity?: number;
  /** Moves the scattered parts (confetti, stars, scratches, contours). Default 1. */
  seed?: number;
  /** The prefix of the ids the background writes. Default: a hash of its options. Only letters, digits, `_` and `-` are kept (every other character becomes `-`), and `bg-` goes in front of one that does not start with a letter; a safe id is used as written. */
  id?: string;
}

/** The colours to draw over a background. Every text colour is checked against `dominant`, the colours the background mostly is, for a contrast of 4.5 to 1 (3 to 1 for `muted`). */
export interface BackgroundInk {
  /** The plain colour to fill the picture with before `body`: the ground's first colour. */
  base: string;
  /** Whether the ground is dark (so the text is light). */
  dark: boolean;
  text: string;
  muted: string;
  /** The connecting lines. */
  line: string;
  /** The fill and edge of a box laid on the picture; both are `rgba()`. */
  box: string;
  edge: string;
  /** The pill behind a round's name, a team's plain disc, the ring round a mark, the dotted road and the accent for a winner, a champion and a highlight. */
  panel: string;
  plain: string;
  ring: string;
  spine: string;
  accent: string;
  /** The colours the picture is mostly, worst cases included: the ground's two colours and each blended with the glow at its strongest. */
  dominant: string[];
}

export interface BackgroundSvg {
  defs: string;
  body: string;
  ink: BackgroundInk;
}

// ------------------------------------------------------------------------------------------------ colour

type Rgb = readonly [number, number, number];
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** A number written without float noise. */
const r = (n: number): string => String(Math.round(n * 10) / 10 === 0 ? 0 : Math.round(n * 10) / 10);

/** A colour as three channels, or `null` when it is not hex or `rgb()`. */
export function parseColor(text: string): Rgb | null {
  const t = text.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as unknown as Rgb;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(t);
  return rgb ? ([clamp(+rgb[1], 0, 255), clamp(+rgb[2], 0, 255), clamp(+rgb[3], 0, 255)] as const) : null;
}

const hex2 = (n: number): string => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
export const toHex = (c: Rgb): string => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: Rgb, a: number): string => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

/** The relative luminance of a colour, as WCAG defines it. */
export function luminance(c: Rgb): number {
  const [R, G, B] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** The WCAG contrast ratio of two colours, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const INK_LIGHT: Rgb = [247, 244, 236];
const INK_DARK: Rgb = [22, 24, 26];

// ------------------------------------------------------------------------------------------------ the pieces

/** A small seeded generator (mulberry32): the same seed always gives the same run of numbers. */
function seeded(seed: number): () => number {
  let a = (Math.floor(seed) * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The caller's id made safe to write into an `id` attribute and a `url(#...)`: letters, digits, `_` and `-`, starting with a letter. An id that is already safe is unchanged. */
function safeId(id: string): string {
  const clean = id.replace(/[^\w-]/g, "-");
  return /^[A-Za-z]/.test(clean) ? clean : `bg-${clean}`;
}

/** A small stable hash of a string, as base 36. */
function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** What a preset draws with. */
interface Ground {
  w: number;
  h: number;
  /** The four colours: the ground's two, the glow, the pattern. */
  c: readonly [string, string, string, string];
  /** The strength of the decoration, 0 to about 1.2 (1 at the default intensity). */
  k: number;
  rnd: () => number;
  id: string;
  dark: boolean;
  long: number;
  short: number;
}

interface Made { defs: string; body: string }

const stops = (list: readonly (readonly [number, string, number?])[]): string => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined && a !== 1 ? ` stop-opacity="${a}"` : ""}/>`).join("");
/** A radial glow: `colour` at the centre fading to nothing at `rad`. */
const glow = (id: string, colour: string, a: number): string => `<radialGradient id="${id}">${stops([[0, colour, a], [1, colour, 0]])}</radialGradient>`;
const circle = (cx: number, cy: number, rad: number, fill: string, extra = ""): string => `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rad)}" fill="${fill}"${extra}/>`;
const fade = (g: Ground, base: number): string => ` opacity="${Math.round(clamp(base * g.k, 0, 1) * 100) / 100}"`;

// ------------------------------------------------------------------------------------------------ the presets

type Draw = (g: Ground) => Made;
interface Preset {
  /** The four colours for a dark ground and for a light one. */
  dark: readonly [string, string, string, string];
  light: readonly [string, string, string, string];
  /** The ground's gradient angle (CSS degrees). */
  angle: number;
  /** A playing surface keeps its lines straight whatever the angle. */
  surface?: boolean;
  draw: Draw;
}

const PRESETS: Record<BackgroundPresetName, Preset> = {
  midnight: {
    dark: ["#0b1230", "#1b2160", "#7f8cff", "#c7ceff"], light: ["#eef1fb", "#d4dcf5", "#3d4fd0", "#7c8be0"], angle: 160,
    draw: (g) => ({
      defs: glow(`${g.id}a`, g.c[2], 0.9) + glow(`${g.id}b`, g.c[3], 0.6),
      body: `<ellipse cx="${r(g.w * 0.5)}" cy="${r(g.h * 0.08)}" rx="${r(g.w * 0.8)}" ry="${r(g.h * 0.38)}" fill="url(#${g.id}a)"${fade(g, 0.55)}/><ellipse cx="${r(g.w * 0.85)}" cy="${r(g.h * 0.95)}" rx="${r(g.w * 0.6)}" ry="${r(g.h * 0.3)}" fill="url(#${g.id}b)"${fade(g, 0.35)}/>`,
    }),
  },
  crimson: {
    dark: ["#2b0610", "#7b1027", "#ff5a4d", "#ffb199"], light: ["#fdeeec", "#f6d0cf", "#c0392b", "#e58a80"], angle: 150,
    draw: (g) => ({
      defs: glow(`${g.id}a`, g.c[2], 0.9) + `<linearGradient id="${g.id}b" x1="0" y1="0" x2="1" y2="0">${stops([[0, g.c[3], 0], [0.5, g.c[3], 0.5], [1, g.c[3], 0]])}</linearGradient>`,
      body: `<ellipse cx="${r(g.w * 0.1)}" cy="${r(g.h * 0.95)}" rx="${r(g.w * 0.75)}" ry="${r(g.h * 0.45)}" fill="url(#${g.id}a)"${fade(g, 0.6)}/><path d="M${r(g.w * 0.55)} 0H${r(g.w * 0.8)}L${r(g.w * 0.3)} ${r(g.h)}H${r(g.w * 0.05)}Z" fill="url(#${g.id}b)"${fade(g, 0.16)}/>`,
    }),
  },
  royal: {
    dark: ["#170a38", "#33197f", "#b69cff", "#5fb0ff"], light: ["#f2edff", "#d8cbff", "#5b3fd1", "#3a86d6"], angle: 135,
    draw: (g) => ({
      defs: glow(`${g.id}a`, g.c[2], 0.9) + glow(`${g.id}b`, g.c[3], 0.8),
      body: `${circle(g.w * 0.05, g.h * 0.05, g.long * 0.6, `url(#${g.id}a)`, fade(g, 0.5))}${circle(g.w * 0.98, g.h * 0.92, g.long * 0.55, `url(#${g.id}b)`, fade(g, 0.4))}`,
    }),
  },
  emerald: {
    dark: ["#04251c", "#0d5a43", "#3ee0a0", "#a8f5d4"], light: ["#eaf8f2", "#c5ecdc", "#178a62", "#5cc9a0"], angle: 120,
    draw: (g) => {
      const band = (x: number, wd: number): string => `<path d="M${r(x)} 0h${r(wd)}L${r(x - g.h * 0.5 + wd)} ${r(g.h)}h${r(-wd)}Z"/>`;
      return {
        defs: glow(`${g.id}a`, g.c[2], 0.9),
        body: `${circle(g.w * 0.5, g.h * 1.05, g.long * 0.7, `url(#${g.id}a)`, fade(g, 0.4))}<g fill="${g.c[3]}"${fade(g, 0.07)}>${band(g.w * 0.55, g.w * 0.14)}${band(g.w * 0.8, g.w * 0.05)}${band(g.w * 1.05, g.w * 0.2)}${band(g.w * 0.28, g.w * 0.03)}</g>`,
      };
    },
  },
  pitch: {
    dark: ["#0a3a1d", "#0f5429", "#e8f6ea", "#0a3a1d"], light: ["#cdebd0", "#b4dfb8", "#ffffff", "#9fd2a4"], angle: 180, surface: true,
    draw: (g) => {
      const land = g.w >= g.h;
      const L = land ? g.w : g.h, S = land ? g.h : g.w;
      const n = 12;
      const stripe = L / n;
      const line = `fill="none" stroke="${g.c[2]}" stroke-width="${r(Math.max(2, S * 0.006))}"${fade(g, 0.4)}`;
      const t = land ? "" : ` transform="rotate(90)translate(0 ${r(-g.w)})"`;
      const m = S * 0.07;
      return {
        defs: "",
        body: `<g fill="${g.c[3]}"${fade(g, 0.3)}>${Array.from({ length: n / 2 }, (_, i) => (land ? `<rect x="${r((2 * i + 1) * stripe)}" y="0" width="${r(stripe)}" height="${r(g.h)}"/>` : `<rect x="0" y="${r((2 * i + 1) * stripe)}" width="${r(g.w)}" height="${r(stripe)}"/>`)).join("")}</g>` +
          `<g${t} ${line}><rect x="${r(m)}" y="${r(m)}" width="${r(L - 2 * m)}" height="${r(S - 2 * m)}"/><path d="M${r(L / 2)} ${r(m)}V${r(S - m)}"/>${circle(L / 2, S / 2, S * 0.17, "none", ` stroke="${g.c[2]}" stroke-width="${r(Math.max(2, S * 0.006))}"`)}` +
          `<rect x="${r(m)}" y="${r(S * 0.28)}" width="${r(L * 0.15)}" height="${r(S * 0.44)}"/><rect x="${r(L - m - L * 0.15)}" y="${r(S * 0.28)}" width="${r(L * 0.15)}" height="${r(S * 0.44)}"/><rect x="${r(m)}" y="${r(S * 0.4)}" width="${r(L * 0.05)}" height="${r(S * 0.2)}"/><rect x="${r(L - m - L * 0.05)}" y="${r(S * 0.4)}" width="${r(L * 0.05)}" height="${r(S * 0.2)}"/></g>`,
      };
    },
  },
  ice: {
    dark: ["#0c2238", "#1d4a70", "#9fd4ff", "#ff6a6a"], light: ["#f3f9ff", "#d5eafa", "#3d8fd1", "#d94a4a"], angle: 170, surface: true,
    draw: (g) => {
      const { w, h } = g;
      const marks = `fill="none" stroke-linecap="round"`;
      const scratches = Array.from({ length: 26 }, () => {
        const x = g.rnd() * w, y = g.rnd() * h, len = (0.1 + g.rnd() * 0.4) * g.long * 0.5, bend = (g.rnd() - 0.5) * len * 0.5, a = (g.rnd() - 0.5) * 1.1;
        return `M${r(x)} ${r(y)}q${r(Math.cos(a) * len * 0.5 + bend * 0.2)} ${r(Math.sin(a) * len * 0.5 + bend)} ${r(Math.cos(a) * len)} ${r(Math.sin(a) * len)}`;
      }).join("");
      const land = w >= h;
      const bw = Math.max(2, Math.min(w, h) * 0.007);
      const cx = w / 2, cy = h / 2;
      // The rink's markings, faint: the centre circle and spot, the red centre line, two blue lines, the faceoff spots.
      const across = land
        ? (p: number) => `M${r(p)} ${r(h * 0.04)}V${r(h * 0.96)}`
        : (p: number) => `M${r(w * 0.04)} ${r(p)}H${r(w * 0.96)}`;
      const along = land ? w : h;
      const centre = land ? cx : cy;
      const spot = (x: number, y: number): string => circle(x, y, bw * 1.2, g.c[3]) + circle(x, y, bw * 7, "none", ` stroke="${g.c[3]}" stroke-width="${r(bw * 0.7)}"`);
      const spots = [[-0.28, -0.22], [-0.28, 0.22], [0.28, -0.22], [0.28, 0.22]].map(([a, b]) => (land ? spot(cx + a * w, cy + b * h) : spot(cx + b * w, cy + a * h))).join("");
      return {
        defs: `<pattern id="${g.id}p" width="60" height="60" patternUnits="userSpaceOnUse"><circle cx="7" cy="9" r="1.1" fill="${g.c[2]}" opacity=".5"/><circle cx="38" cy="22" r=".9" fill="${g.c[2]}" opacity=".4"/><circle cx="21" cy="48" r="1.2" fill="${g.c[2]}" opacity=".5"/><circle cx="52" cy="53" r=".8" fill="${g.c[2]}" opacity=".4"/></pattern>`,
        body: `<rect width="${r(w)}" height="${r(h)}" fill="url(#${g.id}p)"${fade(g, 0.4)}/><path d="${scratches}" ${marks} stroke="${g.dark ? "#ffffff" : "#6aa6d6"}" stroke-width="1.2"${fade(g, 0.22)}/>` +
          `<g ${marks} stroke-width="${r(bw)}"${fade(g, 0.45)}><path d="${across(centre)}" stroke="${g.c[3]}" stroke-dasharray="${r(bw * 6)} ${r(bw * 3)}"/><path d="${across(centre - along * 0.2)}M${across(centre + along * 0.2).slice(1)}" stroke="${g.dark ? "#5aa0ff" : "#2d6fd0"}"/>${circle(cx, cy, Math.min(w, h) * 0.16, "none", ` stroke="${g.dark ? "#5aa0ff" : "#2d6fd0"}" stroke-width="${r(bw)}"`)}</g><g${fade(g, 0.4)}>${spots}${circle(cx, cy, bw * 2, g.dark ? "#5aa0ff" : "#2d6fd0")}</g>`,
      };
    },
  },
  hardwood: {
    dark: ["#2a1507", "#4f2c10", "#e0a45a", "#f3d9ae"], light: ["#f3dcae", "#e2bb7a", "#8a5a1d", "#fff6e0"], angle: 180, surface: true,
    draw: (g) => {
      const ph = Math.max(22, g.short / 22);
      const pw = ph * 7;
      const tile = pw * 2;
      const plank = (x: number, y: number, wd: number, shade: number): string => `<rect x="${r(x)}" y="${r(y)}" width="${r(wd)}" height="${r(ph)}" fill="${shade ? g.c[2] : g.c[3]}" opacity="${shade ? 0.2 : 0.1}"/>`;
      const line = `fill="none" stroke="${g.c[3]}" stroke-width="${r(Math.max(2, g.short * 0.006))}"${fade(g, 0.45)}`;
      const land = g.w >= g.h;
      const L = land ? g.w : g.h, S = land ? g.h : g.w;
      const t = land ? "" : ` transform="rotate(90)translate(0 ${r(-g.w)})"`;
      const key = S * 0.33;
      return {
        defs: `<pattern id="${g.id}p" width="${r(tile)}" height="${r(ph * 4)}" patternUnits="userSpaceOnUse">${plank(0, 0, pw * 1.3, 1)}${plank(pw * 1.3, 0, pw * 0.7, 0)}${plank(0, ph, pw * 0.5, 0)}${plank(pw * 0.5, ph, pw * 1.5, 1)}${plank(0, ph * 2, pw * 1.1, 0)}${plank(pw * 1.1, ph * 2, pw * 0.9, 1)}${plank(0, ph * 3, pw * 0.8, 1)}${plank(pw * 0.8, ph * 3, pw * 1.2, 0)}<path d="M0 0H${r(tile)}M0 ${r(ph)}H${r(tile)}M0 ${r(ph * 2)}H${r(tile)}M0 ${r(ph * 3)}H${r(tile)}" stroke="#000" stroke-width="1" opacity=".18"/><path d="M${r(pw * 1.3)} 0v${r(ph)}M${r(pw * 0.5)} ${r(ph)}v${r(ph)}M${r(pw * 1.1)} ${r(ph * 2)}v${r(ph)}M${r(pw * 0.8)} ${r(ph * 3)}v${r(ph)}" stroke="#000" stroke-width="1" opacity=".16"/></pattern>`,
        body: `<rect width="${r(g.w)}" height="${r(g.h)}" fill="url(#${g.id}p)"${fade(g, 1.2)}/><g${t} ${line}><rect x="${r(S * 0.07)}" y="${r(S * 0.07)}" width="${r(L - S * 0.14)}" height="${r(S * 0.86)}"/><path d="M${r(L / 2)} ${r(S * 0.07)}V${r(S * 0.93)}"/>${circle(L / 2, S / 2, S * 0.14, "none", ` stroke="${g.c[3]}" stroke-width="${r(Math.max(2, S * 0.006))}"`)}<rect x="${r(S * 0.07)}" y="${r(S / 2 - key / 2)}" width="${r(L * 0.2)}" height="${r(key)}"/><rect x="${r(L - S * 0.07 - L * 0.2)}" y="${r(S / 2 - key / 2)}" width="${r(L * 0.2)}" height="${r(key)}"/></g>`,
      };
    },
  },
  infield: {
    dark: ["#0c3a1e", "#14562b", "#c98a4b", "#e9f3e3"], light: ["#c8e8c6", "#a9d9a6", "#c58948", "#ffffff"], angle: 180, surface: true,
    draw: (g) => {
      const { w, h } = g;
      const run = Math.min(w, h) * 0.5;
      const hx = w / 2, hy = h * 0.96;
      const first = [hx + run * 0.7, hy - run * 0.7], third = [hx - run * 0.7, hy - run * 0.7], second = [hx, hy - run * 1.4];
      return {
        defs: `<pattern id="${g.id}p" width="${r(g.long / 14)}" height="${r(g.long / 14)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${r(g.long / 28)}" height="${r(g.long / 14)}" fill="${g.c[3]}" opacity=".13"/></pattern>`,
        body: `<rect width="${r(w)}" height="${r(h)}" fill="url(#${g.id}p)"${fade(g, 1)}/>${circle(hx, hy, run * 1.25, g.c[2], fade(g, 0.4))}<path d="M${r(hx)} ${r(hy)}L${r(first[0])} ${r(first[1])}L${r(second[0])} ${r(second[1])}L${r(third[0])} ${r(third[1])}Z" fill="none" stroke="${g.c[3]}" stroke-width="${r(Math.max(2, run * 0.025))}" stroke-linejoin="round"${fade(g, 0.4)}/><g fill="${g.c[3]}"${fade(g, 0.5)}><rect x="${r(first[0] - run * 0.04)}" y="${r(first[1] - run * 0.04)}" width="${r(run * 0.08)}" height="${r(run * 0.08)}"/><rect x="${r(third[0] - run * 0.04)}" y="${r(third[1] - run * 0.04)}" width="${r(run * 0.08)}" height="${r(run * 0.08)}"/><rect x="${r(second[0] - run * 0.04)}" y="${r(second[1] - run * 0.04)}" width="${r(run * 0.08)}" height="${r(run * 0.08)}"/><path d="M${r(hx - run * 0.05)} ${r(hy - run * 0.04)}h${r(run * 0.1)}v${r(run * 0.04)}l${r(-run * 0.05)} ${r(run * 0.05)}l${r(-run * 0.05)} ${r(-run * 0.05)}Z"/></g>`,
      };
    },
  },
  turf: {
    dark: ["#0b3322", "#115034", "#eef6ee", "#f0c64a"], light: ["#cbe9d2", "#b3dcbd", "#ffffff", "#c79417"], angle: 180, surface: true,
    draw: (g) => {
      const land = g.w >= g.h;
      const L = land ? g.w : g.h, S = land ? g.h : g.w;
      const zone = L * 0.1;
      const yard = (L - 2 * zone) / 10;
      const t = land ? "" : ` transform="rotate(90)translate(0 ${r(-g.w)})"`;
      const lines = Array.from({ length: 11 }, (_, i) => `M${r(zone + i * yard)} 0V${r(S)}`).join("");
      const hashes = Array.from({ length: 50 }, (_, i) => `M${r(zone + (i + 0.5) * yard * 0.2 * 1)} ${r(S * 0.4)}v${r(S * 0.025)}M${r(zone + (i + 0.5) * yard * 0.2)} ${r(S * 0.6)}v${r(-S * 0.025)}`).join("");
      return {
        defs: "",
        body: `<g${t}><path d="M0 0h${r(zone)}v${r(S)}h${r(-zone)}ZM${r(L - zone)} 0h${r(zone)}v${r(S)}h${r(-zone)}Z" fill="${g.c[3]}"${fade(g, 0.2)}/><g fill="none" stroke="${g.c[2]}"${fade(g, 0.35)}><path d="${lines}" stroke-width="${r(Math.max(2, S * 0.007))}"/><path d="${hashes}" stroke-width="${r(Math.max(1.5, S * 0.004))}"/></g></g>`,
      };
    },
  },
  "ball-panels": {
    dark: ["#0d1322", "#1c2744", "#7f9bff", "#050810"], light: ["#eef2fa", "#d6def0", "#4a64c8", "#a9b6dc"], angle: 150,
    draw: (g) => {
      const s = clamp(g.long / 12, 50, 110);
      const hw = s * 1.732, hh = s * 3;
      const hexPath = (cx: number, cy: number): string => Array.from({ length: 6 }, (_, i) => `${i === 0 ? "M" : "L"}${r(cx + s * Math.cos((Math.PI / 3) * i + Math.PI / 6))} ${r(cy + s * Math.sin((Math.PI / 3) * i + Math.PI / 6))}`).join("") + "Z";
      const pent = (cx: number, cy: number): string => Array.from({ length: 5 }, (_, i) => `${i === 0 ? "M" : "L"}${r(cx + s * 0.62 * Math.cos((Math.PI * 2 * i) / 5 - Math.PI / 2))} ${r(cy + s * 0.62 * Math.sin((Math.PI * 2 * i) / 5 - Math.PI / 2))}`).join("") + "Z";
      return {
        defs: `${glow(`${g.id}a`, g.c[2], 0.8)}<pattern id="${g.id}p" width="${r(hw)}" height="${r(hh)}" patternUnits="userSpaceOnUse"><path d="${hexPath(0, 0)}${hexPath(hw, 0)}${hexPath(hw / 2, s * 1.5)}${hexPath(0, s * 3)}${hexPath(hw, s * 3)}" fill="none" stroke="${g.c[2]}" stroke-width="${r(s * 0.05)}" opacity=".5"/><path d="${pent(hw / 2, s * 1.5)}" fill="${g.c[3]}" opacity=".8"/></pattern>`,
        body: `<rect width="${r(g.w)}" height="${r(g.h)}" fill="url(#${g.id}p)"${fade(g, 0.55)}/>${circle(g.w * 0.5, g.h * 0.45, g.long * 0.6, `url(#${g.id}a)`, fade(g, 0.4))}`,
      };
    },
  },
  swirl: {
    dark: ["#0a1030", "#241a6b", "#ff4fa3", "#34c3ff"], light: ["#f4f0ff", "#ddd2ff", "#e0368a", "#1e9bd6"], angle: 160,
    draw: (g) => {
      const { w, h } = g;
      const ribbon = (y0: number, y1: number, th: number, fill: string, op: number): string => `<path d="M${r(-w * 0.1)} ${r(h * y0)}C${r(w * 0.3)} ${r(h * (y0 - 0.35))} ${r(w * 0.6)} ${r(h * (y1 + 0.3))} ${r(w * 1.1)} ${r(h * y1)}L${r(w * 1.1)} ${r(h * (y1 + th))}C${r(w * 0.6)} ${r(h * (y1 + th + 0.28))} ${r(w * 0.3)} ${r(h * (y0 + th - 0.3))} ${r(-w * 0.1)} ${r(h * (y0 + th))}Z" fill="${fill}"${fade(g, op)}/>`;
      return { defs: "", body: ribbon(0.75, 0.2, 0.1, g.c[2], 0.5) + ribbon(0.85, 0.35, 0.16, g.c[3], 0.4) + ribbon(0.6, 0.05, 0.05, g.c[2], 0.35) + ribbon(1, 0.55, 0.12, g.c[3], 0.28) };
    },
  },
  waves: {
    dark: ["#04162c", "#0a3f6b", "#42b4ff", "#9be4ff"], light: ["#eaf6ff", "#c9e7fb", "#1f86d4", "#69c0ec"], angle: 180,
    draw: (g) => {
      const { w, h } = g;
      const wave = (y: number, amp: number, ph: number, fill: string, op: number): string => `<path d="M0 ${r(h * y)}C${r(w * 0.2)} ${r(h * y - amp * (1 + ph))} ${r(w * 0.3)} ${r(h * y + amp)} ${r(w * 0.5)} ${r(h * y)}S${r(w * 0.8)} ${r(h * y - amp * (1 - ph))} ${r(w)} ${r(h * y - amp * 0.3)}V${r(h)}H0Z" fill="${fill}"${fade(g, op)}/>`;
      return { defs: glow(`${g.id}a`, g.c[3], 0.9), body: `${circle(w * 0.7, h * 0.12, g.long * 0.35, `url(#${g.id}a)`, fade(g, 0.3))}${wave(0.55, h * 0.05, 0.3, g.c[2], 0.16)}${wave(0.66, h * 0.045, -0.2, g.c[2], 0.2)}${wave(0.77, h * 0.04, 0.4, g.c[3], 0.16)}${wave(0.88, h * 0.035, -0.3, g.c[2], 0.26)}` };
    },
  },
  glow: {
    dark: ["#070b1c", "#141a40", "#ffcf5a", "#ff7a3d"], light: ["#fff8e6", "#ffe9b8", "#f0a000", "#ff7a3d"], angle: 180,
    draw: (g) => {
      const cx = g.w / 2, cy = g.h * 0.42;
      return {
        defs: glow(`${g.id}a`, g.c[2], 1) + glow(`${g.id}b`, g.c[3], 0.8),
        body: `${circle(cx, cy, g.long * 0.62, `url(#${g.id}a)`, fade(g, 0.55))}${circle(cx, cy, g.long * 0.3, `url(#${g.id}b)`, fade(g, 0.35))}<g fill="none" stroke="${g.c[2]}" stroke-width="1.5"${fade(g, 0.25)}>${circle(cx, cy, g.short * 0.28, "none")}${circle(cx, cy, g.short * 0.42, "none")}${circle(cx, cy, g.short * 0.58, "none")}</g>`,
      };
    },
  },
  floodlights: {
    dark: ["#060a1a", "#142046", "#fff3c4", "#7fb2ff"], light: ["#f1f4fb", "#d8e1f2", "#f0b429", "#4a82d6"], angle: 180,
    draw: (g) => {
      const { w, h } = g;
      const cone = (x: number, spread: number, reach: number): string => `<path d="M${r(x - w * 0.012)} 0H${r(x + w * 0.012)}L${r(x + spread * reach)} ${r(h * reach)}L${r(x - spread * reach)} ${r(h * reach)}Z"/>`;
      const xs = [0.12, 0.31, 0.5, 0.69, 0.88];
      return {
        defs: `<linearGradient id="${g.id}a" x1="0" y1="0" x2="0" y2="1">${stops([[0, g.c[2], 0.9], [1, g.c[2], 0]])}</linearGradient>${glow(`${g.id}b`, g.c[2], 0.9)}`,
        body: `<g fill="url(#${g.id}a)"${fade(g, 0.28)}>${xs.map((x, i) => cone(w * x, w * (i % 2 ? 0.12 : 0.17), 1)).join("")}</g>${xs.map((x) => circle(w * x, h * 0.012, Math.max(3, w * 0.012), g.c[2], fade(g, 0.8))).join("")}<ellipse cx="${r(w / 2)}" cy="${r(h)}" rx="${r(w * 0.7)}" ry="${r(h * 0.2)}" fill="url(#${g.id}b)"${fade(g, 0.3)}/>`,
      };
    },
  },
  confetti: {
    dark: ["#150a30", "#3a0f5e", "#ff5fa2", "#ffd34e"], light: ["#fff3fa", "#ffe0f0", "#e0368a", "#e8a900"], angle: 150,
    draw: (g) => {
      const palette = [g.c[2], g.c[3], g.dark ? "#4fd1ff" : "#1e9bd6", g.dark ? "#8dff9c" : "#27a843"];
      const size = clamp(g.short / 60, 7, 16);
      const pieces = Array.from({ length: 44 }, (_, i) => {
        const x = g.rnd() * g.w, y = g.rnd() * g.h, a = Math.round(g.rnd() * 180);
        const kind = i % 3;
        return `<${kind === 2 ? `circle cx="${r(x)}" cy="${r(y)}" r="${r(size * 0.35)}"` : `rect x="${r(x)}" y="${r(y)}" width="${r(size * (kind ? 0.5 : 1.1))}" height="${r(size * (kind ? 1.4 : 0.55))}" transform="rotate(${a} ${r(x)} ${r(y)})"`} fill="${palette[i % 4]}"/>`;
      });
      return { defs: "", body: `<g${fade(g, 0.55)}>${pieces.join("")}</g>` };
    },
  },
  carbon: {
    dark: ["#0b0c0e", "#1c1f24", "#7a8494", "#2a2e35"], light: ["#e1e4e8", "#c9ced6", "#6b7686", "#aeb5c0"], angle: 135,
    draw: (g) => ({
      defs: `<pattern id="${g.id}p" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${g.c[3]}"/><rect x="6" y="6" width="6" height="6" fill="${g.c[3]}"/><rect x="6" width="6" height="6" fill="${g.c[2]}" opacity=".35"/><rect y="6" width="6" height="6" fill="${g.c[2]}" opacity=".35"/></pattern><linearGradient id="${g.id}a" x1="0" y1="0" x2="1" y2="1">${stops([[0, g.c[2], 0], [0.45, g.c[2], 0.5], [0.55, g.c[2], 0.5], [1, g.c[2], 0]])}</linearGradient>`,
      body: `<rect width="${r(g.w)}" height="${r(g.h)}" fill="url(#${g.id}p)"${fade(g, 0.55)}/><rect width="${r(g.w)}" height="${r(g.h)}" fill="url(#${g.id}a)"${fade(g, 0.28)}/>`,
    }),
  },
  aurora: {
    dark: ["#030b1a", "#082a3a", "#3dffb0", "#9a6bff"], light: ["#eefaf6", "#d2eefa", "#12a875", "#7a4fe0"], angle: 180,
    draw: (g) => {
      const { w, h } = g;
      const band = (x: number, wd: number, lean: number, id: string): string => `<path d="M${r(w * x)} ${r(h * 0.02)}C${r(w * (x + lean))} ${r(h * 0.25)} ${r(w * (x - lean))} ${r(h * 0.45)} ${r(w * (x + lean * 0.5))} ${r(h * 0.8)}L${r(w * (x + wd + lean * 0.5))} ${r(h * 0.8)}C${r(w * (x + wd - lean))} ${r(h * 0.45)} ${r(w * (x + wd + lean))} ${r(h * 0.25)} ${r(w * (x + wd))} ${r(h * 0.02)}Z" fill="url(#${id})"/>`;
      const stars = Array.from({ length: 36 }, () => circle(g.rnd() * w, g.rnd() * h * 0.6, 0.6 + g.rnd() * 1.1, g.dark ? "#fff" : g.c[3], ` opacity="${r(0.25 + g.rnd() * 0.5)}"`)).join("");
      const vg = (id: string, c: string): string => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops([[0, c, 0], [0.25, c, 0.9], [1, c, 0]])}</linearGradient>`;
      return {
        defs: vg(`${g.id}a`, g.c[2]) + vg(`${g.id}b`, g.c[3]),
        body: `<g${fade(g, 0.5)}>${band(0.05, 0.22, 0.12, `${g.id}a`)}${band(0.35, 0.28, -0.1, `${g.id}b`)}${band(0.62, 0.3, 0.1, `${g.id}a`)}</g>${g.dark ? `<g${fade(g, 0.9)}>${stars}</g>` : ""}`,
      };
    },
  },
  sunburst: {
    dark: ["#1a0830", "#5a1458", "#ffb347", "#ff5f6d"], light: ["#fff6e8", "#ffe0bd", "#f08a00", "#e0455a"], angle: 180,
    draw: (g) => {
      const cx = g.w / 2, cy = g.h * 0.45, big = g.long * 1.2, n = 28;
      const wedges = Array.from({ length: n }, (_, i) => {
        const a0 = (Math.PI * 2 * i) / n, a1 = a0 + Math.PI / n;
        return `M${r(cx)} ${r(cy)}L${r(cx + big * Math.cos(a0))} ${r(cy + big * Math.sin(a0))}L${r(cx + big * Math.cos(a1))} ${r(cy + big * Math.sin(a1))}Z`;
      }).join("");
      return { defs: glow(`${g.id}a`, g.c[2], 1) + `<radialGradient id="${g.id}b">${stops([[0, g.c[2], 0.9], [1, g.c[2], 0]])}</radialGradient>`, body: `<path d="${wedges}" fill="url(#${g.id}b)"${fade(g, 0.22)}/>${circle(cx, cy, g.long * 0.4, `url(#${g.id}a)`, fade(g, 0.45))}` };
    },
  },
  chevrons: {
    dark: ["#0a1a33", "#123e6e", "#5cc8ff", "#ffffff"], light: ["#edf5fd", "#cfe4f7", "#1d7fc4", "#7aa9d0"], angle: 180,
    draw: (g) => {
      const t = clamp(g.short / 14, 40, 80);
      return {
        defs: `<pattern id="${g.id}p" width="${r(t * 2)}" height="${r(t)}" patternUnits="userSpaceOnUse"><path d="M0 ${r(t * 0.85)}L${r(t)} ${r(t * 0.2)}L${r(t * 2)} ${r(t * 0.85)}" fill="none" stroke="${g.c[2]}" stroke-width="${r(t * 0.14)}" stroke-linejoin="round"/></pattern><linearGradient id="${g.id}a" x1="0" y1="0" x2="0" y2="1">${stops([[0, g.c[3], 0.5], [0.5, g.c[3], 0]])}</linearGradient>`,
        body: `<rect width="${r(g.w)}" height="${r(g.h)}" fill="url(#${g.id}p)"${fade(g, 0.28)}/><rect width="${r(g.w)}" height="${r(g.h)}" fill="url(#${g.id}a)"${fade(g, 0.12)}/>`,
      };
    },
  },
  halftone: {
    dark: ["#12081f", "#2d1157", "#ff4fb0", "#ffd24e"], light: ["#fdf2fb", "#f3dcf5", "#d02f93", "#e9a800"], angle: 135,
    draw: (g) => {
      const s = clamp(g.short / 40, 14, 26);
      return {
        defs: `<pattern id="${g.id}p" width="${r(s)}" height="${r(s)}" patternUnits="userSpaceOnUse"><circle cx="${r(s / 2)}" cy="${r(s / 2)}" r="${r(s * 0.3)}" fill="${g.c[2]}"/></pattern><linearGradient id="${g.id}a" x1="0" y1="1" x2="1" y2="0">${stops([[0, "#fff", 1], [0.65, "#fff", 0]])}</linearGradient><mask id="${g.id}m"><rect width="${r(g.w)}" height="${r(g.h)}" fill="url(#${g.id}a)"/></mask>${glow(`${g.id}b`, g.c[3], 0.9)}`,
        body: `${circle(g.w * 0.1, g.h * 0.95, g.long * 0.5, `url(#${g.id}b)`, fade(g, 0.3))}<rect width="${r(g.w)}" height="${r(g.h)}" fill="url(#${g.id}p)" mask="url(#${g.id}m)"${fade(g, 0.5)}/>`,
      };
    },
  },
  argyle: {
    dark: ["#10172c", "#1d2a52", "#e6b34a", "#7d8fd8"], light: ["#f1f3fa", "#dbe1f3", "#b8851a", "#5d70b8"], angle: 150,
    draw: (g) => {
      const t = clamp(g.short / 9, 60, 120);
      return {
        defs: `<pattern id="${g.id}p" width="${r(t)}" height="${r(t * 1.5)}" patternUnits="userSpaceOnUse"><path d="M${r(t / 2)} 0L${r(t)} ${r(t * 0.75)}L${r(t / 2)} ${r(t * 1.5)}L0 ${r(t * 0.75)}Z" fill="${g.c[3]}" opacity=".35"/><path d="M0 0L${r(t)} ${r(t * 1.5)}M${r(t)} 0L0 ${r(t * 1.5)}" stroke="${g.c[2]}" stroke-width="1.2" opacity=".6"/></pattern>`,
        body: `<rect width="${r(g.w)}" height="${r(g.h)}" fill="url(#${g.id}p)"${fade(g, 0.45)}/>`,
      };
    },
  },
  contour: {
    dark: ["#071a1c", "#0f3d40", "#5ee6d6", "#a0f5ea"], light: ["#eaf7f5", "#cdebe6", "#17917f", "#5bbfb0"], angle: 160,
    draw: (g) => {
      const ring = (cx: number, cy: number, rad: number): string => {
        const n = 9, pts = Array.from({ length: n }, (_, i) => {
          const a = (Math.PI * 2 * i) / n, d = rad * (0.82 + g.rnd() * 0.36);
          return [cx + d * Math.cos(a) * 1.25, cy + d * Math.sin(a)];
        });
        const mid = (a: number[], b: number[]): string => `${r((a[0] + b[0]) / 2)} ${r((a[1] + b[1]) / 2)}`;
        return `M${mid(pts[n - 1], pts[0])}` + pts.map((p, i) => `Q${r(p[0])} ${r(p[1])} ${mid(p, pts[(i + 1) % n])}`).join("") + "Z";
      };
      const centres: [number, number][] = [[g.w * (0.2 + g.rnd() * 0.15), g.h * (0.25 + g.rnd() * 0.15)], [g.w * (0.65 + g.rnd() * 0.2), g.h * (0.65 + g.rnd() * 0.2)]];
      const d = centres.flatMap(([cx, cy]) => Array.from({ length: 7 }, (_, i) => ring(cx, cy, g.short * (0.07 + i * 0.075)))).join("");
      return { defs: "", body: `<path d="${d}" fill="none" stroke="${g.c[2]}" stroke-width="${r(Math.max(1.2, g.short / 500))}"${fade(g, 0.3)}/>` };
    },
  },
  stardust: {
    dark: ["#05030f", "#1a1050", "#dfe4ff", "#b78bff"], light: ["#f4f2ff", "#e3defa", "#5a4bd0", "#8a6be0"], angle: 160,
    draw: (g) => {
      const { w, h } = g;
      const dots = Array.from({ length: 70 }, () => `<circle cx="${r(g.rnd() * w)}" cy="${r(g.rnd() * h)}" r="${r(0.5 + g.rnd() ** 3 * 2.2)}" opacity="${r(0.2 + g.rnd() * 0.6)}"/>`).join("");
      return {
        defs: glow(`${g.id}a`, g.c[3], 0.9) + `<linearGradient id="${g.id}b" x1="0" y1="0" x2="1" y2="0">${stops([[0, g.c[3], 0], [0.5, g.c[3], 0.5], [1, g.c[3], 0]])}</linearGradient>`,
        body: `<path d="M0 ${r(h * 0.75)}L${r(w * 0.7)} 0H${r(w)}V${r(h * 0.1)}L${r(w * 0.3)} ${r(h)}H0Z" fill="url(#${g.id}b)"${fade(g, 0.14)}/>${circle(w * 0.75, h * 0.2, g.long * 0.3, `url(#${g.id}a)`, fade(g, 0.4))}<g fill="${g.c[2]}"${fade(g, 1)}>${dots}</g>`,
      };
    },
  },
  mesh: {
    dark: ["#0d1030", "#1d1a55", "#ff6aa8", "#3ee0ff"], light: ["#f5f2ff", "#e5def9", "#e0407f", "#1db4d6"], angle: 135,
    draw: (g) => {
      const blobs: [number, number, number, string][] = [[0.1, 0.1, 0.6, g.c[2]], [0.95, 0.2, 0.5, g.c[3]], [0.2, 0.9, 0.55, g.c[3]], [0.9, 0.95, 0.6, g.c[2]], [0.5, 0.5, 0.35, g.dark ? "#8a6bff" : "#7a5ee0"]];
      return {
        defs: blobs.map((b, i) => glow(`${g.id}${i}`, b[3], 0.9)).join(""),
        body: blobs.map((b, i) => circle(g.w * b[0], g.h * b[1], g.long * b[2], `url(#${g.id}${i})`, fade(g, 0.45))).join(""),
      };
    },
  },
  spotlight: {
    dark: ["#05070f", "#161c34", "#fff1c8", "#7fb2ff"], light: ["#eef0f6", "#d3d9e8", "#f6c54a", "#7fa5e0"], angle: 180,
    draw: (g) => {
      const { w, h } = g;
      return {
        defs: `<linearGradient id="${g.id}a" x1="0" y1="0" x2="0" y2="1">${stops([[0, g.c[2], 0.85], [1, g.c[2], 0.05]])}</linearGradient>${glow(`${g.id}b`, g.c[2], 0.9)}<radialGradient id="${g.id}v" cx=".5" cy=".5" r=".75">${stops([[0.55, "#000", 0], [1, "#000", 0.55]])}</radialGradient>`,
        body: `<path d="M${r(w * 0.47)} 0H${r(w * 0.53)}L${r(w * 0.88)} ${r(h * 0.92)}H${r(w * 0.12)}Z" fill="url(#${g.id}a)"${fade(g, 0.3)}/><ellipse cx="${r(w / 2)}" cy="${r(h * 0.93)}" rx="${r(w * 0.5)}" ry="${r(h * 0.1)}" fill="url(#${g.id}b)"${fade(g, 0.55)}/>${g.dark ? `<rect width="${r(w)}" height="${r(h)}" fill="url(#${g.id}v)"/>` : ""}`,
      };
    },
  },
};

// ------------------------------------------------------------------------------------------------ the ink

/** The least contrast of a colour against each of several. */
const worst = (c: Rgb, over: readonly Rgb[]): number => Math.min(...over.map((o) => contrastRatio(c, o)));

function inkFor(c: readonly [string, string, string, string], k: number): { ink: BackgroundInk; scrim: string } {
  const [c0, c1, c2, c3] = c.map((x) => parseColor(x) ?? [128, 128, 128]) as [Rgb, Rgb, Rgb, Rgb];
  // The decoration's strongest effect on the ground: a blend of up to 40% of the glow and the pattern.
  const reach = clamp(0.2 + 0.35 * k, 0.2, 0.5);
  const grounds = [c0, c1, mix(c0, c2, reach), mix(c1, c2, reach), mix(c0, c3, reach), mix(c1, c3, reach)];
  let over = grounds;
  let useLight = worst(INK_LIGHT, over) >= worst(INK_DARK, over);
  const text: Rgb = useLight ? INK_LIGHT : INK_DARK;
  // A ground too mid-toned for either ink is dimmed with a veil until the text reads at 4.5 to 1.
  let scrim = "";
  if (worst(text, over) < 4.6) {
    const veil = useLight ? BLACK : WHITE;
    let a = 0;
    while (a < 0.85 && worst(text, over) < 4.6) {
      a += 0.05;
      over = grounds.map((g) => mix(g, veil, a));
    }
    scrim = `<rect width="100%" height="100%" fill="${toHex(veil)}" opacity="${Math.round(a * 100) / 100}"/>`;
  }
  const ground = over[0];
  useLight = text === INK_LIGHT;
  let muted = mix(text, ground, 0.34);
  for (let t = 0.34; t > 0 && worst(muted, over) < 4.6; t -= 0.04) muted = mix(text, ground, t);
  const goldFallback: Rgb = useLight ? [240, 198, 74] : [138, 90, 0];
  const accent = [c2, c3, goldFallback].map((x) => ({ x, s: worst(x, over.slice(0, 2)) })).sort((a, b) => b.s - a.s).find((o) => o.s >= 3)?.x ?? goldFallback;
  return {
    scrim,
    ink: {
      base: toHex(c0),
      dark: useLight,
      text: toHex(text),
      muted: toHex(muted),
      line: toHex(mix(text, ground, 0.2)),
      box: rgba(mix(ground, useLight ? BLACK : WHITE, useLight ? 0.55 : 0.6), 0.74),
      edge: rgba(text, 0.3),
      panel: toHex(mix(ground, useLight ? BLACK : WHITE, 0.5)),
      plain: toHex(mix(ground, text, 0.22)),
      ring: useLight ? "#f4f1e8" : "#ffffff",
      spine: toHex(accent),
      accent: toHex(accent),
      dominant: over.map(toHex),
    },
  };
}

// ------------------------------------------------------------------------------------------------ the entry

/**
 * One background: `defs` for the drawing's `<defs>`, `body` for what goes over a plain `ink.base` rectangle, and `ink`, the colours to draw text, lines and boxes in. The same preset and options
 * always give the same markup; every id starts with `options.id`. An unknown preset throws.
 */
export function backgroundSvg(preset: BackgroundPresetName, options: BackgroundSvgOptions): BackgroundSvg {
  const def = (PRESETS as Record<string, Preset | undefined>)[preset];
  if (!def) throw new RangeError(`Unknown background "${String(preset)}": use one of ${BACKGROUND_PRESETS.join(", ")}`);
  const w = Math.max(1, options.width), h = Math.max(1, options.height);
  const dark = (options.theme ?? "dark") !== "light";
  const palette = [...(dark ? def.dark : def.light)] as [string, string, string, string];
  const given = (options.colors ?? []).slice(0, 4);
  given.forEach((x, i) => { if (parseColor(x)) palette[i] = toHex(parseColor(x)!); });
  // One colour makes the ground by itself: its second is the same, a little deeper (dark) or lighter (light).
  if (given.length === 1 && parseColor(given[0])) palette[1] = toHex(mix(parseColor(given[0])!, dark ? BLACK : WHITE, 0.35));
  const intensity = clamp(options.intensity ?? 0.6, 0, 1);
  const k = intensity / 0.6;
  const id = options.id != null ? safeId(String(options.id)) : `bg${hashOf(JSON.stringify([preset, w, h, dark, given, options.angle, intensity, options.seed]))}`;
  const angle = options.angle ?? def.angle;
  const ground: Ground = { w, h, c: palette, k, rnd: seeded(options.seed ?? 1), id, dark, long: Math.max(w, h), short: Math.min(w, h) };
  const made = def.draw(ground);
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad), dy = -Math.cos(rad);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const defs = `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${r(w / 2 - dx * half)}" y1="${r(h / 2 - dy * half)}" x2="${r(w / 2 + dx * half)}" y2="${r(h / 2 + dy * half)}">${stops([[0, palette[0]], [1, palette[1]]])}</linearGradient><clipPath id="${id}c"><rect width="${r(w)}" height="${r(h)}"/></clipPath>${made.defs}`;
  const delta = def.surface || options.angle === undefined ? 0 : options.angle - def.angle;
  const decor = delta === 0 ? made.body : `<g transform="rotate(${r(delta)} ${r(w / 2)} ${r(h / 2)})">${made.body}</g>`;
  const { ink, scrim } = inkFor(palette, k);
  const body = `<g clip-path="url(#${id}c)"><rect width="${r(w)}" height="${r(h)}" fill="url(#${id}g)"/>${decor}${scrim.replace('width="100%" height="100%"', `width="${r(w)}" height="${r(h)}"`)}</g>`;
  return { defs, body, ink };
}
