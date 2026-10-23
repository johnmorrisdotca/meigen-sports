import assert from "node:assert/strict";
import { test } from "node:test";
import { CALENDAR_THEME_LABELS, CALENDAR_THEMES, calendarIcon, calendarThemeOf } from "../src/calendarIcon.ts";

const FORBIDDEN = /google|apple|microsoft|android|ios|material|fluent|samsung/i;

test("ten generic themes, each with English and short Japanese names", () => {
  assert.equal(CALENDAR_THEMES.length, 10);
  assert.deepEqual([...CALENDAR_THEMES], ["classic", "outline", "spiral", "bold", "tent", "curl", "pad", "minimal", "fold", "tile"]);
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
});

test("every theme draws the month, day and year in light and dark", () => {
  for (const theme of CALENDAR_THEMES) {
    for (const scheme of ["light", "dark"] as const) {
      const svg = calendarIcon({ theme, month: 3, day: 20, year: 2026, locale: "en", scheme, size: 96 });
      assert.match(svg, /^<svg /);
      assert.match(svg, /<\/svg>$/);
      assert.match(svg, /role="img"/);
      assert.ok(svg.includes("Mar") || svg.includes("March"), `${theme} ${scheme} month`);
      assert.ok(svg.includes(">20<"), `${theme} ${scheme} day`);
      assert.ok(svg.includes("2026") || svg.includes("26"), `${theme} ${scheme} year`);
      assert.ok(!svg.includes("new Date()"));
    }
  }
});

test("Japanese month and weekday sit in the drawing", () => {
  const svg = calendarIcon({ theme: "minimal", month: 3, day: 20, year: 2026, locale: "ja" });
  assert.ok(svg.includes("3月") || svg.includes("3"));
  assert.ok(svg.includes("2026"));
});

test("the clock is not read and bad input is refused", () => {
  assert.throws(() => calendarIcon({ month: 0, day: 1 }), /month/);
  assert.throws(() => calendarIcon({ month: 1, day: 32 }), /day/);
  assert.throws(() => calendarIcon({ month: 1, day: 1, year: 0 }), /year/);
  assert.throws(() => calendarIcon({ month: 1, day: 1, theme: "classic", size: 8 }), /size/);
  const a = calendarIcon({ month: 10, day: 23, year: 2026, theme: "classic" });
  const b = calendarIcon({ month: 10, day: 23, year: 2026, theme: "classic" });
  assert.equal(a, b);
});
