# Calendar icons

[Gallery of every theme at several sizes and dates](calendar-gallery.md) · [The gallery in Japanese](calendar-gallery.ja.md) · [Layouts that use them](display-layouts.md)

<p align="center">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/hero-icons-dark.webp">
<img alt="A calendar page for October 20 beside a sentence, over all fourteen themes." src="./images/hero-icons-light.webp" width="720">
</picture>
</p>

Fourteen themes, one call each. The picture above is `calendarIcon` called once for each theme (light and dark are the same call with `scheme`).

```js
import { CALENDAR_THEMES, calendarIcon } from "@johnmorrisdotca/meigen-sports";

const svg = calendarIcon({ theme: "flip", month: 3, day: 20, year: 2026, locale: "en", scheme: "light", size: 96 });
console.log(svg.startsWith("<svg")); // true
console.log(svg.includes("Friday Mar 20 2026")); // true
console.log(CALENDAR_THEMES.length); // 14
```

## Examples

### Every theme, light and dark

<p align="center">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/themes-dark.webp">
<img alt="All fourteen themes in two rows of seven for March 20, 2026." src="./images/themes-light.webp" width="720">
</picture>
</p>

```js
import { CALENDAR_THEMES, calendarIcon } from "@johnmorrisdotca/meigen-sports";

const light = CALENDAR_THEMES.map((theme) => calendarIcon({ theme, month: 3, day: 20, year: 2026, scheme: "light" }));
const dark = CALENDAR_THEMES.map((theme) => calendarIcon({ theme, month: 3, day: 20, year: 2026, scheme: "dark" }));
console.log(light.every((svg, at) => svg !== dark[at])); // true
```

### In Japanese

The month and the weekday follow `locale`. A theme that names the month draws `3月`; the weekday and the full date are in the `<title>`.

<p align="center">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/themes-ja-dark.webp">
<img alt="All fourteen themes for March 20, 2026 with Japanese month and weekday words." src="./images/themes-ja-light.webp" width="720">
</picture>
</p>

```js
import { calendarIcon } from "@johnmorrisdotca/meigen-sports";

const svg = calendarIcon({ theme: "line", month: 9, day: 9, year: 2026, locale: "ja", scheme: "dark" });
console.log(svg.includes("水曜日 9月 9 2026")); // true
```

### Sizes

`size` is the width in pixels, from 16 to 1024, and the height follows the theme's own shape. The [gallery](calendar-gallery.md) shows every theme from 16 to 96 pixels.

```js
import { calendarIcon } from "@johnmorrisdotca/meigen-sports";

const widths = [16, 32, 64, 128].map((size) => calendarIcon({ theme: "desk", month: 12, day: 31, size }).match(/ width="(\d+)"/)?.[1]);
console.log(widths.join(" ")); // 16 32 64 128
```

### With a year and without

A weekday is drawn only when a year is given, because without a year it would be a guess. Without one, a theme with room shows the month in its place.

```js
import { calendarIcon } from "@johnmorrisdotca/meigen-sports";

console.log(calendarIcon({ theme: "pins", month: 3, day: 20 }).includes("Friday")); // false
console.log(calendarIcon({ theme: "pins", month: 3, day: 20, year: 2026 }).includes("Friday")); // true
```

### Every date is drawn

All 366 days, both languages, light and dark, with and without a year, are drawn and checked for well-formed markup by `test/calendar-icon.test.ts`. 29 February is a real day here.

```js
import { CALENDAR_THEMES, calendarIcon } from "@johnmorrisdotca/meigen-sports";

const whole = CALENDAR_THEMES.every((theme) => calendarIcon({ theme, month: 2, day: 29, year: 2028 }).endsWith("</svg>"));
console.log(whole); // true
```

## The fourteen looks

Each is SVG from `calendarIcon`, drawn from shapes, gradients and a stroke-drawn digit set, so it looks the same on every device and needs no font file or picture. Each theme follows one of the looks John collected as references (a flat page with pins, a heavy black outline, a flip calendar, a thin large number and so on); the shapes are our own, no company's artwork is copied or shipped, no logo is used and no theme is named after a company or product.

| Id | English | Japanese | Picture | The look |
| --- | --- | --- | --- | --- |
| `pins` | Pins | ピン留め | ![Pins](images/calendar-pins.svg) | a flat white page, a red header, two slate pins through white holes, the month in capitals and a large day |
| `loops` | Loops | 輪綴じ | ![Loops](images/calendar-loops.svg) | a grey outline, a grey header and three ring pins |
| `shadow` | Long shadow | 長い影 | ![Long shadow](images/calendar-shadow.svg) | a blue header, five black coils, a circled day and a long shadow on a lavender tile |
| `heavy` | Heavy | 極太 | ![Heavy](images/calendar-heavy.svg) | a very heavy black outline, ring slots over the top edge and a black header rule |
| `cartoon` | Cartoon | マンガ風 | ![Cartoon](images/calendar-cartoon.svg) | a black cartoon outline, a pink header, white ring loops and a heavy word and number |
| `flip` | Flip | 卓上 | ![Flip](images/calendar-flip.svg) | a flip calendar in perspective: coils, a pale header, a slanted number and a fan of pages |
| `stack` | Stack | 重ね | ![Stack](images/calendar-stack.svg) | a solid black glyph with a tilted white page, a curled corner and a sheet underneath |
| `line` | Line | 線画 | ![Line](images/calendar-line.svg) | black line art, four tick marks and a big blue number |
| `curl` | Curl | めくり | ![Curl](images/calendar-curl.svg) | line art with an orange header, two hooks, thin rounded digits and a curled corner |
| `soft` | Soft | やわらか | ![Soft](images/calendar-soft.svg) | a flat orange header, three amber rings, a cream page with a side shade and a rounded coral number |
| `desk` | Desk | 立体 | ![Desk](images/calendar-desk.svg) | a desk pad seen at an angle: silver coils, a red banner with a white number and the month's dates |
| `thin` | Thin | 細字 | ![Thin](images/calendar-thin.svg) | a plain white page, the weekday in red and a very thin number |
| `frame` | Frame | 四色枠 | ![Frame](images/calendar-frame.svg) | four coloured sides round a pale square with a blue number and a folded corner |
| `badge` | Badge | バッジ | ![Badge](images/calendar-badge.svg) | a white tile with a soft blue page and a white number |

## What each drawing says

A theme draws what its look has room for. A theme whose look has a month word draws it in capitals (`MARCH`, or `3月`); one that has a weekday draws it only when a year is given (without a year a weekday would be a guess), and shows the month instead. A small year is drawn where the page has room. Whatever a theme leaves off the picture is in its `<title>` and `aria-label` (`Friday Mar 20 2026`). A day the month does not have (30 February) is drawn as given and has no weekday.

## Earlier names

The ten themes of 0.12 and 0.13 are still accepted. Each name reads as the theme that replaced it (`CALENDAR_THEME_ALIASES`), and `calendarThemeOf("classic")` returns `pins`.

| Earlier | Now |
| --- | --- |
| `classic` | `pins` |
| `outline` | `line` |
| `spiral` | `loops` |
| `bold` | `heavy` |
| `tent` | `flip` |
| `curl` | `curl` |
| `pad` | `stack` |
| `minimal` | `thin` |
| `fold` | `frame` |
| `tile` | `badge` |

## In a page

The `.meigen-cal` box makes the drawing as wide as its box. The stylesheet is optional.

```js no-run
import { calendarIcon } from "@johnmorrisdotca/meigen-sports";
import "@johnmorrisdotca/meigen-sports/styles.css";

document.body.innerHTML = `<span class="meigen-cal" style="width:96px">${calendarIcon({
  theme: "pins",
  month: 3,
  day: 20,
  year: 2026,
  locale: "en",
  scheme: "light",
})}</span>`;
```

Pass the month (1–12), the day (1–31) and an optional year. The library does not read the clock. `scheme` is `light` or `dark`; `size` is the width in pixels (16 to 1024) and the height follows the theme's shape. `calendarThemeOf(name)` returns a theme id, reads an earlier name as its replacement and returns `null` for anything else.

The demo keeps the choice in the address: `?icon=pins`.
