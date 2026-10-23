# Calendar icons

Ten original calendar-page drawings. Each is SVG from `calendarIcon`. No photograph, stock icon or product art is used, and no theme is named after a company.

| Id | English | Japanese | Picture |
| --- | --- | --- | --- |
| `classic` | Classic | クラシック | ![Classic](images/calendar-classic.svg) |
| `outline` | Outline | 線画 | ![Outline](images/calendar-outline.svg) |
| `spiral` | Spiral | スパイラル綴じ | ![Spiral](images/calendar-spiral.svg) |
| `bold` | Bold | 太枠 | ![Bold](images/calendar-bold.svg) |
| `tent` | Tent | 卓上 | ![Tent](images/calendar-tent.svg) |
| `curl` | Curl | めくり | ![Curl](images/calendar-curl.svg) |
| `pad` | Pad | 日めくり | ![Pad](images/calendar-pad.svg) |
| `minimal` | Minimal | ミニマル | ![Minimal](images/calendar-minimal.svg) |
| `fold` | Fold | 折り角 | ![Fold](images/calendar-fold.svg) |
| `tile` | Tile | タイル | ![Tile](images/calendar-tile.svg) |

The Japanese names have not yet been read by a person who reads Japanese.

```js no-run
import { calendarIcon } from "@johnmorrisdotca/meigen-sports";
import "@johnmorrisdotca/meigen-sports/styles.css";

document.body.innerHTML = `<span class="meigen-cal">${calendarIcon({
  theme: "classic",
  month: 3,
  day: 20,
  year: 2026,
  locale: "en",
  scheme: "light",
})}</span>`;
```

Pass the month (1–12), the day (1–31) and an optional year. The library does not read the clock. `scheme` is `light` or `dark`. `calendarThemeOf(name)` returns a theme id or `null`.

The demo keeps the choice in the address: `?icon=classic`.
