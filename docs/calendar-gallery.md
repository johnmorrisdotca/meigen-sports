[日本語](calendar-gallery.ja.md) · English

# Calendar gallery

Every calendar-page theme at five dates and six sizes, in light and dark. The dates are the 1st (`1 Jan`), a single digit (`9 Feb`, `9 Sep`), and the longest month names (September, November and December), up to the 31st. Each sheet is one `calendarIcon` call per picture: the top two rows are the dates with a year (a weekday where the theme has room), the bottom pair is `31 Dec` at 16 to 96 pixels with no year. The `sun` and `roll` sheets also have a row of weekend pages (6 and 7 June, 31 October and 1 November, 30 and 31 May, 31 December and 1 January). In every picture the day is centred on its page, and the year sits in its own room above the bottom edge ([how each theme places them](calendar-icons.md#where-the-day-and-the-year-sit)). See [calendar-icons.md](calendar-icons.md) for the options and [the same gallery in Japanese](calendar-gallery.ja.md).

```js
import { CALENDAR_THEMES, calendarIcon } from "@johnmorrisdotca/meigen-sports";

const dates = [[1, 1], [2, 9], [9, 9], [11, 30], [12, 31]];
const sheet = CALENDAR_THEMES.map((theme) => dates.map(([month, day]) => calendarIcon({ theme, month, day, year: 2026, locale: "en", scheme: "light", size: 112 })));
console.log(sheet.length, sheet[0].length); // 18 5
const sizes = [16, 24, 32, 48, 64, 96].map((size) => calendarIcon({ theme: "pins", month: 12, day: 31, locale: "en", scheme: "dark", size }));
console.log(sizes.length); // 6
```

## Pins

`pins`: A flat white page, a red header, two slate pins through white holes, the month in capitals and a large day.

![Pins at five dates in light and dark, and at six sizes](images/gallery-pins-en.webp)

## Loops

`loops`: A grey outline, a grey header and three ring pins.

![Loops at five dates in light and dark, and at six sizes](images/gallery-loops-en.webp)

## Long shadow

`shadow`: A blue header, five black coils, a circled day and a long shadow on a lavender tile.

![Long shadow at five dates in light and dark, and at six sizes](images/gallery-shadow-en.webp)

## Heavy

`heavy`: A very heavy black outline, ring slots over the top edge and a black header rule.

![Heavy at five dates in light and dark, and at six sizes](images/gallery-heavy-en.webp)

## Cartoon

`cartoon`: A black cartoon outline, a pink header, white ring loops and a heavy word and number.

![Cartoon at five dates in light and dark, and at six sizes](images/gallery-cartoon-en.webp)

## Flip

`flip`: A flip calendar in perspective: coils, a pale header, a slanted number and a fan of pages.

![Flip at five dates in light and dark, and at six sizes](images/gallery-flip-en.webp)

## Stack

`stack`: A solid black glyph with a tilted white page, a curled corner and a sheet underneath.

![Stack at five dates in light and dark, and at six sizes](images/gallery-stack-en.webp)

## Line

`line`: Black line art, four tick marks and a big blue number.

![Line at five dates in light and dark, and at six sizes](images/gallery-line-en.webp)

## Curl

`curl`: Line art with an orange header, two hooks, thin rounded digits and a curled corner.

![Curl at five dates in light and dark, and at six sizes](images/gallery-curl-en.webp)

## Soft

`soft`: A flat orange header, three amber rings, a cream page with a side shade and a rounded coral number.

![Soft at five dates in light and dark, and at six sizes](images/gallery-soft-en.webp)

## Desk

`desk`: A desk pad seen at an angle: silver coils, a red banner with a white number and the month's dates.

![Desk at five dates in light and dark, and at six sizes](images/gallery-desk-en.webp)

## Thin

`thin`: A plain white page, the weekday in red and a very thin number.

![Thin at five dates in light and dark, and at six sizes](images/gallery-thin-en.webp)

## Frame

`frame`: Four coloured sides round a pale square with a blue number and a folded corner.

![Frame at five dates in light and dark, and at six sizes](images/gallery-frame-en.webp)

## Badge

`badge`: A white tile with a soft blue page and a white number.

![Badge at five dates in light and dark, and at six sizes](images/gallery-badge-en.webp)

## Sun disc

`sun`: A square tear-off page: a grey strip to tear it off by, a huge black day over a red disc, the year on top and a side column on each side. The third and fourth rows are the weekend pages.

![Sun disc at five dates, four weekend pages, light and dark, and at six sizes](images/gallery-sun-en.webp)

## Wall roll

`roll`: A tall wall tear-off page: the pages already torn off curl above, a huge condensed day in the colour of its weekday, side columns and a dotted memo area. The third and fourth rows are the weekend pages.

![Wall roll at five dates, four weekend pages, light and dark, and at six sizes](images/gallery-roll-en.webp)

## Plain

`plain`: A plain tear-off pad on a kraft stand: a small month, a big day, the weekday in capitals, the month and year, and the moon.

![Plain at five dates in light and dark, and at six sizes](images/gallery-plain-en.webp)

## Squircle

`squircle`: A soft rounded tile in a teal-to-blue gradient, a white page with a coloured band and two binding tabs, and a large bold day.

![Squircle at five dates in light and dark, and at six sizes](images/gallery-squircle-en.webp)
