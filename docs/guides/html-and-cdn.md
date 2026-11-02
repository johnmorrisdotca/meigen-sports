---
title: Plain HTML and CDNs
section: how-to
order: 2
description: Show a day's sports history on a plain page with one script tag from jsDelivr or unpkg.
---

A page needs no build step. A browser cannot resolve a bare package name such as `@johnmorrisdotca/meigen-sports`, so import it from a CDN address instead. Both pages below show the same card: today's three facts beside a calendar page.

## jsDelivr

jsDelivr turns a package into a browser module when you add `/+esm`. The data is its own entry point, so it is its own import.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Meigen Sports from jsDelivr</title>
  </head>
  <body>
    <div id="card"></div>
    <script type="module">
      import { calendarDayInZone, calendarIcon, displayMarkup, renderRun, today } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/meigen-sports/+esm";
      import offline from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/meigen-sports/offline/+esm";

      const now = "2026-10-20T15:00:00Z";
      const [month, day] = calendarDayInZone("America/Toronto", now).split("-").map(Number);
      const facts = renderRun(today(offline, "America/Toronto", now).slice(0, 3), { seed: "card", locale: "en", asOf: "2026-10-20" });
      document.getElementById("card").innerHTML = displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month, day, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
    </script>
  </body>
</html>
```

## unpkg

unpkg serves the package's own files; `?module` makes it rewrite the imports inside them.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Meigen Sports from unpkg</title>
  </head>
  <body>
    <div id="card"></div>
    <script type="module">
      import { calendarDayInZone, calendarIcon, displayMarkup, renderRun, today } from "https://unpkg.com/@johnmorrisdotca/meigen-sports/dist/index.js?module";
      import offline from "https://unpkg.com/@johnmorrisdotca/meigen-sports/dist/data/offline.js?module";

      const now = "2026-10-20T15:00:00Z";
      const [month, day] = calendarDayInZone("America/Toronto", now).split("-").map(Number);
      const facts = renderRun(today(offline, "America/Toronto", now).slice(0, 3), { seed: "card", locale: "en", asOf: "2026-10-20" });
      document.getElementById("card").innerHTML = displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month, day, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
    </script>
  </body>
</html>
```

## Notes

- Use `<script type="module">`. A classic script cannot `import`.
- The offline set is about a megabyte. A page that shows a day does not need it: [load one day's feed](api:loadFactDay) instead, which is a few kilobytes.
- Pin a version in the address (`@johnmorrisdotca/meigen-sports@0.22.0`) when you want the page to stay as it is.
- If nothing appears, see [troubleshooting](troubleshooting.md).
