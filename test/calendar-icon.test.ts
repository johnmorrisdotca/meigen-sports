import assert from "node:assert/strict";
import { test } from "node:test";
import { CALENDAR_THEME_ALIASES, CALENDAR_THEME_LABELS, CALENDAR_THEMES, CALENDAR_YEAR_MIN, calendarIcon, calendarLayout, calendarMoon, calendarThemeOf, calendarWeekend } from "../src/calendarIcon.ts";
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

test("eighteen generic themes, each with an English and a short Japanese name", () => {
  assert.equal(CALENDAR_THEMES.length, 18);
  assert.deepEqual([...CALENDAR_THEMES], ["pins", "loops", "shadow", "heavy", "cartoon", "flip", "stack", "line", "curl", "soft", "desk", "thin", "frame", "badge", "sun", "roll", "plain", "squircle"]);
  for (const theme of CALENDAR_THEMES) {
    assert.equal(calendarThemeOf(theme), theme);
    assert.equal(calendarThemeOf(theme.toUpperCase()), theme);
    const { en, ja } = CALENDAR_THEME_LABELS[theme];
    assert.ok(en.length >= 3 && en.length <= 12, en);
    assert.ok([...ja].length >= 2 && [...ja].length <= 12, ja);
    assert.ok(!FORBIDDEN.test(theme) && !FORBIDDEN.test(en) && !FORBIDDEN.test(ja));
  }
  assert.equal(calendarThemeOf("squircle"), "squircle");
  assert.ok(calendarIcon({ theme: "squircle", month: 11, day: 3, year: 2026 }).startsWith("<svg"));
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
  assert.match(ja, /aria-label="2026年3月20日（金曜日）"/);
  assert.match(ja, /<title>2026年3月20日（金曜日）<\/title>/);
  assert.match(calendarIcon({ theme: "pins", month: 12, day: 31, locale: "ja" }), /aria-label="12月31日"/);
  assert.match(calendarIcon({ theme: "pins", month: 12, day: 31, year: 2026, locale: "ja-JP" }), /aria-label="2026年12月31日（木曜日）"/);
  assert.match(calendarIcon({ theme: "pins", month: 2, day: 30, year: 2026, locale: "ja" }), /aria-label="2026年2月30日"/);
  for (const theme of CALENDAR_THEMES) {
    for (const scheme of ["light", "dark"] as const) {
      assert.match(calendarIcon({ theme, month: 12, day: 31, year: 2026, locale: "ja", scheme }), /aria-label="2026年12月31日（木曜日）"/, theme);
      assert.match(calendarIcon({ theme, month: 12, day: 31, locale: "ja", scheme }), /aria-label="12月31日"/, theme);
    }
  }
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

test("every theme says where its day sits: centred in a page inside its box, the same for 1, 9, 30 and 31", () => {
  for (const theme of CALENDAR_THEMES) {
    for (const withYear of [true, false]) {
      const { box, page, yearZone, numeral } = calendarLayout(theme, withYear);
      assert.equal(numeral, "centre", theme);
      assert.ok(page[0] >= box[0] && page[1] >= box[1] && page[0] + page[2] <= box[0] + box[2] && page[1] + page[3] <= box[1] + box[3], `${theme}: the page is inside the box`);
      if (yearZone) assert.ok(yearZone[1] + yearZone[3] <= box[1] + box[3], `${theme}: the year's room is inside the box`);
    }
    const marked = (day: number, year?: number) => {
      const svg = calendarIcon({ theme, month: 10, day, year });
      return [svg.includes('data-part="day"'), svg.includes('data-part="year"')];
    };
    for (const day of [1, 9, 30, 31]) {
      assert.equal(marked(day)[0], true, `${theme} ${day}: the day is marked`);
      assert.equal(marked(day)[1], false, `${theme} ${day}: no year, no year chip`);
      assert.equal(marked(day, 2026)[1], theme !== "desk", `${theme} ${day}: the year chip is drawn when there is a year`);
    }
  }
  assert.ok(CALENDAR_YEAR_MIN >= 0.07);
});

test("a year is drawn at the theme's minimum size or larger", () => {
  for (const theme of CALENDAR_THEMES) {
    if (theme === "desk") continue;
    const svg = calendarIcon({ theme, month: 10, day: 31, year: 2026 });
    const width = Number(svg.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) /)![1]);
    const chip = svg.match(/<g data-part="year">.*?<\/g>|<text[^>]*><tspan data-part="month">.*?<\/text>/)![0];
    const size = Number(chip.match(/font-size="([\d.]+)"/)![1]);
    assert.ok(size >= CALENDAR_YEAR_MIN * width - 0.5, `${theme}: the year is ${size} in a drawing ${width} wide`);
  }
});

const WEEKEND_THEMES = ["sun", "roll"] as const;
/** Saturday and Sunday: 6 and 7, 31 and 1 (a month end), 30 and 31, and 31 Dec and 1 Jan (a year end). */
const WEEKENDS = [
  { year: 2026, saturday: [6, 6], sunday: [6, 7] },
  { year: 2026, saturday: [10, 31], sunday: [11, 1] },
  { year: 2026, saturday: [5, 30], sunday: [5, 31] },
  { year: 2022, saturday: [12, 31], sunday: [1, 1] },
] as const;

test("a weekend is the Saturday and the Sunday after it, across a month or a year end, and a weekday has none", () => {
  for (const w of WEEKENDS) {
    const sunYear = w.sunday[0] === 1 && w.saturday[0] === 12 ? w.year + 1 : w.year;
    const want = { saturday: { year: w.year, month: w.saturday[0], day: w.saturday[1] }, sunday: { year: sunYear, month: w.sunday[0], day: w.sunday[1] } };
    assert.deepEqual(calendarWeekend(w.year, w.saturday[0], w.saturday[1]), want);
    assert.deepEqual(calendarWeekend(sunYear, w.sunday[0], w.sunday[1]), want);
  }
  assert.equal(calendarWeekend(2027, 1, 1), null, "Friday 1 January 2027");
  assert.equal(calendarWeekend(2026, 11, 2), null, "a Monday");
  assert.equal(calendarWeekend(2026, 2, 30), null, "a day the month does not have");
  assert.equal(calendarWeekend(2027, 2, 29), null, "29 February of a common year");
  assert.notEqual(calendarWeekend(2028, 2, 26), null, "Saturday 26 February 2028");
});

test("the moon is a mean lunation: known new and full moons fall on 0 and 4", () => {
  assert.equal(calendarMoon(2000, 1, 6), 0);
  assert.equal(calendarMoon(2024, 4, 8), 0);
  assert.equal(calendarMoon(2026, 11, 9), 0);
  assert.equal(calendarMoon(2000, 1, 21), 4);
  assert.equal(calendarMoon(2024, 1, 25), 4);
  assert.equal(calendarMoon(2026, 11, 24), 4);
  for (const [month, day] of everyDate()) assert.ok([0, 1, 2, 3, 4, 5, 6, 7].includes(calendarMoon(2026, month, day)));
});

test("a weekend page draws both days, each in its own half, on `sun` and `roll` only, light and dark, in both languages", () => {
  for (const theme of WEEKEND_THEMES) {
    for (const w of WEEKENDS) {
      for (const locale of ["en", "ja"]) {
        for (const scheme of ["light", "dark"] as const) {
          for (const [month, day] of [w.saturday, w.sunday]) {
            const svg = calendarIcon({ theme, month, day, year: month === 1 && w.saturday[0] === 12 ? w.year + 1 : w.year, locale, scheme, weekend: "split" });
            const what = `${theme} ${locale} ${scheme} ${month}/${day}`;
            assertWellFormed(svg, what);
            assert.ok(drawsDay(svg, w.saturday[1]) && drawsDay(svg, w.sunday[1]), `${what}: both days are drawn`);
            assert.ok(svg.includes("clip-path"), `${what}: a diagonal cuts the page`);
            assert.equal(svg.match(/<g data-part="day">/g)?.length, 1, what);
          }
        }
      }
    }
    const label = (month: number, day: number, year: number, locale = "en") => calendarIcon({ theme, month, day, year, locale, weekend: "split" }).match(/aria-label="([^"]*)"/)![1];
    assert.equal(label(10, 31, 2026), "Saturday Oct 31 2026 and Sunday Nov 1 2026");
    assert.equal(label(11, 1, 2026), label(10, 31, 2026), "the Sunday is on the Saturday's page");
    assert.equal(calendarIcon({ theme, month: 11, day: 1, year: 2026, weekend: "split" }), calendarIcon({ theme, month: 10, day: 31, year: 2026, weekend: "split" }), "and it is the same picture, byte for byte");
    assert.equal(label(12, 31, 2022, "ja"), "2022年12月31日（土曜日）と2023年1月1日（日曜日）");
    assert.equal(label(1, 1, 2023), "Saturday Dec 31 2022 and Sunday Jan 1 2023");
    const monday = calendarIcon({ theme, month: 11, day: 2, year: 2026, weekend: "split" });
    assert.equal(monday, calendarIcon({ theme, month: 11, day: 2, year: 2026 }), "a Monday, a holiday or not, keeps its own page");
    assert.equal(calendarIcon({ theme, month: 10, day: 31, weekend: "split" }), calendarIcon({ theme, month: 10, day: 31 }), "no year, no weekend page");
    assert.notEqual(calendarIcon({ theme, month: 10, day: 31, year: 2026, weekend: "split" }), calendarIcon({ theme, month: 10, day: 31, year: 2026 }));
    assert.deepEqual(Object.keys(calendarLayout(theme, true, true)).includes("split"), true);
    assert.equal(calendarLayout(theme, true, true).numeral, "diagonal");
    assert.equal(calendarLayout(theme, true).numeral, "centre");
  }
  for (const theme of CALENDAR_THEMES.filter((one) => !(WEEKEND_THEMES as readonly string[]).includes(one))) {
    assert.equal(calendarIcon({ theme, month: 10, day: 31, year: 2026, weekend: "split" }), calendarIcon({ theme, month: 10, day: 31, year: 2026 }), `${theme} has no weekend page`);
  }
  assert.throws(() => calendarIcon({ theme: "sun", month: 10, day: 31, year: 2026, weekend: "both" as "split" }), /weekend/);
});

test("the side columns say only what is known: the weekday and month, and a holiday only when the page is given one", () => {
  const sun = (extra: object, locale = "ja") => calendarIcon({ theme: "sun", month: 1, day: 1, year: 2027, locale, ...extra });
  assert.ok(sun({}).includes("金") && sun({}).includes("月"));
  assert.ok(!sun({}).includes("元日"));
  assert.ok(sun({ holidays: { "2027-01-01": "元日" } }).includes("元"));
  assert.ok(sun({ holidays: { "01-01": { en: "New Year's Day", ja: "元日" } } }).includes("日"));
  assert.ok(sun({ holidays: { "01-01": { en: "New Year's Day" } } }, "en").includes("New Year&#39;s Day") || sun({ holidays: { "01-01": { en: "New Year's Day" } } }, "en").includes("New Year's Day"));
  assert.ok(!sun({ holidays: { "2027-01-02": "other" } }).includes("other"));
  for (const theme of WEEKEND_THEMES) assert.ok(!calendarIcon({ theme, month: 1, day: 1, year: 2027, columns: false }).includes('data-part="side"'));
  assert.ok(calendarIcon({ theme: "roll", month: 1, day: 1, year: 2027 }).includes('data-part="side"'));
  assert.ok(!calendarIcon({ theme: "roll", month: 1, day: 1 }).includes("FRIDAY"), "no year, no weekday");
  assert.ok(calendarIcon({ theme: "plain", month: 1, day: 1, year: 2027, holidays: { "01-01": "元日" } }).includes("元日"));
  assert.ok(!calendarIcon({ theme: "plain", month: 1, day: 1, year: 2027 }).includes("元日"));
  assert.ok(calendarIcon({ theme: "plain", month: 1, day: 1, year: 2027 }).includes("<path"), "the moon is drawn");
  assert.ok(!calendarIcon({ theme: "plain", month: 1, day: 1, year: 2027, moon: false }).includes('stroke-width="1.8"'));
});

test("weekday ink: Saturday blue, Sunday and a holiday red, any other day black", () => {
  const ink = (day: number, extra: object = {}) => {
    const svg = calendarIcon({ theme: "roll", month: 11, day, year: 2026, ...extra });
    return svg.match(/<g data-part="day">.*?stroke="(#[0-9a-f]{6})"/)![1];
  };
  const [black, blue, red] = [ink(2), ink(7), ink(8)];
  assert.equal(new Set([black, blue, red]).size, 3);
  assert.equal(ink(3, { holidays: { "2026-11-03": "x" } }), red, "a holiday on a Tuesday");
  assert.equal(ink(4), black);
});

test("the sun's disc is a slot: a mark replaces it, and anything that could run code is refused", () => {
  const plain = calendarIcon({ theme: "sun", month: 3, day: 20, year: 2026 });
  const marked = calendarIcon({ theme: "sun", month: 3, day: 20, year: 2026, mark: '<rect x="-80" y="-80" width="160" height="160" fill="#123456"/>' });
  assert.ok(marked.includes("#123456") && !plain.includes("#123456"));
  assert.notEqual(plain, marked);
  assertWellFormed(marked, "sun with a mark");
  for (const bad of ["<script>alert(1)</script>", '<circle onclick="x()" r="9"/>', "<style>*{}</style>", "<foreignObject/>", '<a href="javascript:x"/>']) {
    assert.throws(() => calendarIcon({ theme: "sun", month: 3, day: 20, mark: bad }), /mark/, bad);
  }
});
