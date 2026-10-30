import assert from "node:assert/strict";
import { test } from "node:test";
import { CALENDAR_THEME_ALIASES, CALENDAR_THEME_LABELS, CALENDAR_THEMES, calendarIcon, calendarThemeOf } from "../src/calendarIcon.ts";
import type { CalendarTheme } from "../src/calendarIcon.ts";

const FORBIDDEN = /google|apple|microsoft|android|ios|material|fluent|samsung|icons8|flaticon|shutterstock/i;
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Every month and day of the year, with 29 February. */
function everyDate(): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  MONTH_DAYS.forEach((days, i) => {
    for (let d = 1; d <= days; d += 1) out.push([i + 1, d]);
  });
  return out;
}

/** A small well-formedness check: tags nest and close, ids are unique and every url(#id) points at one. */
function assertWellFormed(svg: string, what: string): void {
  assert.ok(svg.startsWith("<svg ") && svg.endsWith("</svg>"), `${what}: svg root`);
  assert.ok(!/NaN|undefined|Infinity|\[object/.test(svg), `${what}: bad number or value`);
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|[^>"])*?)(\/?)>/g)) {
    const [, close, name, , selfClose] = m;
    if (selfClose) continue;
    if (close) assert.equal(stack.pop(), name, `${what}: </${name}> without its tag`);
    else stack.push(name!);
  }
  assert.deepEqual(stack, [], `${what}: tags left open`);
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(new Set(ids).size, ids.length, `${what}: duplicate id`);
  for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(m[1]!), `${what}: url(#${m[1]}) has no target`);
}

/** The day is drawn as text (`>20<`) or as one stroked digit group per digit. */
function drawsDay(svg: string, day: number): boolean {
  if (svg.includes(`>${day}<`)) return true;
  const groups = [...svg.matchAll(/<g transform="translate\([^)]*\) scale\(/g)].length;
  return groups >= String(day).length;
}

test("fourteen generic themes, each with an English and a short Japanese name", () => {
  assert.equal(CALENDAR_THEMES.length, 14);
  assert.deepEqual([...CALENDAR_THEMES], ["pins", "loops", "shadow", "heavy", "cartoon", "flip", "stack", "line", "curl", "soft", "desk", "thin", "frame", "badge"]);
  for (const theme of CALENDAR_THEMES) {
    assert.equal(calendarThemeOf(theme), theme);
    assert.equal(calendarThemeOf(theme.toUpperCase()), theme);
    const { en, ja } = CALENDAR_THEME_LABELS[theme];
    assert.ok(en.length >= 3 && en.length <= 12, en);
    assert.ok([...ja].length >= 2 && [...ja].length <= 12, ja);
    assert.ok(!FORBIDDEN.test(theme) && !FORBIDDEN.test(en) && !FORBIDDEN.test(ja));
  }
  assert.equal(calendarThemeOf("google"), null);
  assert.equal(calendarThemeOf(""), null);
  assert.equal(calendarThemeOf("constructor"), null);
});

test("the ten earlier names still work and read as the theme that replaced each", () => {
  assert.deepEqual(Object.keys(CALENDAR_THEME_ALIASES).sort(), ["bold", "classic", "curl", "fold", "minimal", "outline", "pad", "spiral", "tent", "tile"]);
  for (const [old, now] of Object.entries(CALENDAR_THEME_ALIASES)) {
    assert.ok((CALENDAR_THEMES as readonly string[]).includes(now), now);
    assert.equal(calendarThemeOf(old), now);
    assert.equal(calendarIcon({ month: 3, day: 20, theme: old as CalendarTheme }), calendarIcon({ month: 3, day: 20, theme: now }));
  }
  assert.throws(() => calendarIcon({ month: 1, day: 1, theme: "google" as CalendarTheme }), /theme/);
});

test("every theme draws every one of the 366 dates, in English and Japanese, light and dark, with and without a year", () => {
  const dates = everyDate();
  assert.equal(dates.length, 366);
  for (const theme of CALENDAR_THEMES) {
    for (const locale of ["en", "ja"]) {
      for (const scheme of ["light", "dark"] as const) {
        for (const year of [undefined, 2026]) {
          const seen = new Set<string>();
          for (const [month, day] of dates) {
            const svg = calendarIcon({ theme, month, day, year, locale, scheme });
            const what = `${theme} ${locale} ${scheme} ${year ?? "-"} ${month}/${day}`;
            assertWellFormed(svg, what);
            assert.match(svg, /role="img"/);
            assert.ok(svg.includes(`<title>`), what);
            assert.ok(drawsDay(svg, day), `${what}: the day is not drawn`);
            assert.ok(!FORBIDDEN.test(svg), what);
            seen.add(svg);
          }
          assert.equal(seen.size, 366, `${theme} ${locale} ${scheme} ${year ?? "-"}: two dates drew the same picture`);
        }
      }
    }
  }
});

test("the label names the date in the page's language and a year only when given", () => {
  const en = calendarIcon({ theme: "pins", month: 3, day: 20, year: 2026, locale: "en" });
  assert.match(en, /aria-label="Friday Mar 20 2026"/);
  const noYear = calendarIcon({ theme: "pins", month: 3, day: 20, locale: "en" });
  assert.match(noYear, /aria-label="Mar 20"/);
  const ja = calendarIcon({ theme: "pins", month: 3, day: 20, year: 2026, locale: "ja" });
  assert.match(ja, /aria-label="[^"]*3月[^"]*20[^"]*2026/);
  assert.ok(ja.includes("3月"));
  const word = calendarIcon({ theme: "thin", month: 3, day: 20, year: 2026, locale: "en" });
  assert.ok(word.includes("Friday"));
  assert.ok(calendarIcon({ theme: "thin", month: 3, day: 20, locale: "en" }).includes("March"));
  assert.ok(calendarIcon({ theme: "thin", month: 3, day: 20, year: 2026, locale: "ja" }).includes("金曜日"));
  assert.ok(calendarIcon({ theme: "heavy", month: 3, day: 20, locale: "en" }).includes("MARCH"));
});

test("sizes 16 to 512 keep the theme's shape and are written as whole pixels of height", () => {
  for (const theme of CALENDAR_THEMES) {
    const box = calendarIcon({ theme, month: 3, day: 20 }).match(/viewBox="([^"]+)"/)![1]!.split(" ").map(Number);
    assert.equal(box.length, 4);
    assert.ok(box[2]! > 0 && box[3]! > 0, theme);
    for (const size of [16, 24, 32, 48, 64, 96, 128, 256, 512]) {
      const svg = calendarIcon({ theme, month: 12, day: 31, year: 2026, size });
      assert.match(svg, new RegExp(`width="${size}"`), `${theme} ${size}`);
      const height = Number(svg.match(/height="(\d+)"/)![1]);
      assert.equal(height, Math.round((size * box[3]!) / box[2]!), `${theme} ${size}`);
      assert.ok(height >= 8, `${theme} ${size}`);
      assertWellFormed(svg, `${theme} ${size}`);
    }
  }
});

test("an unknown locale falls back to English and the clock is not read", () => {
  const svg = calendarIcon({ theme: "heavy", month: 3, day: 20, locale: "zz-not-a-locale-!!" });
  assert.ok(svg.includes("MARCH"));
  assert.throws(() => calendarIcon({ month: 0, day: 1 }), /month/);
  assert.throws(() => calendarIcon({ month: 1, day: 32 }), /day/);
  assert.throws(() => calendarIcon({ month: 1, day: 1, year: 0 }), /year/);
  assert.throws(() => calendarIcon({ month: 1, day: 1, theme: "pins", size: 8 }), /size/);
  assert.throws(() => calendarIcon({ month: 1, day: 1, theme: "pins", size: 2000 }), /size/);
  const a = calendarIcon({ month: 10, day: 23, year: 2026, theme: "desk" });
  const b = calendarIcon({ month: 10, day: 23, year: 2026, theme: "desk" });
  assert.equal(a, b);
  assert.ok(!a.includes("new Date()"));
});

test("a month, day and year that would break out of the markup cannot", () => {
  const svg = calendarIcon({ theme: "thin", month: 3, day: 20, year: 2026, locale: 'en"><script>' });
  assert.ok(!svg.includes("<script"));
});
