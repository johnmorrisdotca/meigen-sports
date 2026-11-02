---
title: Vite and webpack
section: how-to
order: 3
description: Install the package and import it in a Vite or webpack project.
---

Install it.

```sh
npm install @johnmorrisdotca/meigen-sports
# or: pnpm add @johnmorrisdotca/meigen-sports
# or: yarn add @johnmorrisdotca/meigen-sports
```

Everything is an ES module with its own entry point, so a bundler keeps only what you import: `@johnmorrisdotca/meigen-sports` (the functions), `/offline` (the bundled facts), `/load` (the feed loaders), `/quotes`, `/history` and `/categories`. The facts are a large array: import `/offline` only where you show them, or load one day's feed instead.

## Vite

The page.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Meigen Sports with Vite</title>
  </head>
  <body>
    <div id="card"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

The script. Vite builds this entry with no configuration.

```ts no-run
import { calendarDayInZone, calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const now = "2026-10-20T15:00:00Z";
const [month, day] = calendarDayInZone("America/Toronto", now).split("-").map(Number);
const facts = renderRun(today(offline, "America/Toronto", now).slice(0, 3), { seed: "card", locale: "en", asOf: "2026-10-20" });
document.getElementById("card")!.innerHTML = displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month, day, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
```

## webpack

The entry.

```js no-run
import { calendarDayInZone, calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const now = "2026-10-20T15:00:00Z";
const [month, day] = calendarDayInZone("America/Toronto", now).split("-").map(Number);
const facts = renderRun(today(offline, "America/Toronto", now).slice(0, 3), { seed: "card", locale: "en", asOf: "2026-10-20" });
const card = document.createElement("div");
card.innerHTML = displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month, day, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
document.body.append(card);
```

`webpack.config.mjs`. webpack 5 needs nothing special for a package with `exports`.

```mjs no-run
import { fileURLToPath } from "node:url";

export default {
  mode: "production",
  entry: "./src/index.js",
  output: { path: fileURLToPath(new URL("./dist", import.meta.url)), filename: "main.js" },
};
```

Run `npx webpack` and load the `dist/main.js` it makes from a page.

## Other tools

Anything that reads `exports` in `package.json` works the same way: Rollup, esbuild, Parcel, Bun, Deno (`npm:@johnmorrisdotca/meigen-sports`). The code is plain ES2022 with no side effects, so tree shaking removes what you do not use.
