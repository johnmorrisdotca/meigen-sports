---
title: Embed it in an iframe
section: how-to
order: 5
description: Put a day's sports history on any page with an iframe of the embed page, and choose the day, the theme and the language in the address.
---

The embed page is made for an `<iframe>`: one card and nothing else. The address says what it shows, so you need no code of your own.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Meigen Sports in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/meigen-sports/embed.html?date=10-20&theme=pins&lang=en"
      title="Sports history for October 20"
      width="420"
      height="360"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

## The address

| Key | Value | Default |
|---|---|---|
| `date` | `10-20` or `2026-10-20` | today, in the reader's time zone |
| `theme` | one of the eighteen [calendar themes](api:CALENDAR_THEMES), such as `pins`, `desk`, `flip` | `pins` |
| `lang` | `en` or `ja` | `en` |
| `layout` | `calendar`, `years`, `compact` or `featured` ([the layouts](api:DISPLAY_LAYOUTS)) | `calendar` |
| `sport` | a sport such as `ice-hockey` | all sports |
| `n` | 1 to 12 | 3 |
| `scheme` | `light` or `dark` | the reader's own |

An unknown theme or layout falls back to the default; a date that is not a day means today. The frame fetches only its own feed file for the day, and draws nothing while it waits.

## Notes

- Give the frame a title, as above, for screen readers.
- The card is about 420 pixels wide and 360 high with three facts; a taller layout needs a taller frame.
- To control the card with your own code instead, use the functions: see [plain HTML](html-and-cdn.md).
