---
title: Vite と webpack
section: how-to
order: 3
description: パッケージをインストールして、Vite や webpack のプロジェクトで import します。
---

インストールします。

```sh
npm install @johnmorrisdotca/meigen-sports
# または: pnpm add @johnmorrisdotca/meigen-sports
# または: yarn add @johnmorrisdotca/meigen-sports
```

すべて ES モジュールで、エントリーポイントごとに分かれています。バンドラーは import したものだけを含めます。`@johnmorrisdotca/meigen-sports` (関数)、`/offline` (同梱の事実)、`/load` (フィードの読み込み)、`/quotes`、`/history`、`/categories` があります。事実は大きな配列なので、`/offline` は表示する場所でだけ import するか、代わりに1日分のフィードを読み込みます。

## Vite

ページです。

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

スクリプトです。Vite は設定なしでこのエントリーをビルドします。

```ts no-run
import { calendarDayInZone, calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const now = "2026-10-20T15:00:00Z";
const [month, day] = calendarDayInZone("America/Toronto", now).split("-").map(Number);
const facts = renderRun(today(offline, "America/Toronto", now).slice(0, 3), { seed: "card", locale: "en", asOf: "2026-10-20" });
document.getElementById("card")!.innerHTML = displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month, day, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
```

## webpack

エントリーです。

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

`webpack.config.mjs` です。webpack 5 は、`exports` を持つパッケージに特別な設定が要りません。

```mjs no-run
import { fileURLToPath } from "node:url";

export default {
  mode: "production",
  entry: "./src/index.js",
  output: { path: fileURLToPath(new URL("./dist", import.meta.url)), filename: "main.js" },
};
```

`npx webpack` を実行し、できた `dist/main.js` をページから読み込みます。

## ほかのツール

`package.json` の `exports` を読めるツールなら、同じように使えます。Rollup、esbuild、Parcel、Bun、Deno (`npm:@johnmorrisdotca/meigen-sports`) などです。コードは副作用のない普通の ES2022 なので、使わない部分はツリーシェイキングで取り除かれます。
