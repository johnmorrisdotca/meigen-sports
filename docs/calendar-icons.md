# Calendar icons

Fourteen original calendar-page drawings. Each is SVG from `calendarIcon`, drawn from shapes, gradients and a stroke-drawn digit set, so it looks the same on every device and needs no font file or picture. Each theme follows one of the looks John collected as references (a flat page with pins, a heavy black outline, a flip calendar, a thin large number and so on); the shapes are our own, no company's artwork is copied or shipped, no logo is used and no theme is named after a company or product.

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

```js no-run
import { calendarIcon } from "@johnmorrisdotca/meigen-sports";
import "@johnmorrisdotca/meigen-sports/styles.css";

document.body.innerHTML = `<span class="meigen-cal">${calendarIcon({
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
