---
title: 通常の HTML と CDN
section: how-to
order: 2
description: jsDelivr や unpkg の script タグ1つで、その日のスポーツの歴史を通常のページに表示します。
---

ビルドは要りません。ブラウザは `@johnmorrisdotca/meigen-sports` のようなパッケージ名を解決できないので、CDN のアドレスから import します。下の2つのページは、どちらも同じカードを出します。今日の事実3件と、カレンダーのページです。

## jsDelivr

jsDelivr は、`/+esm` を付けるとパッケージをブラウザ用のモジュールにしてくれます。データは別のエントリーポイントなので、別の import にします。

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

unpkg はパッケージのファイルをそのまま配ります。`?module` を付けると、中の import を書き換えてくれます。

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

## 注意

- `<script type="module">` を使います。普通の script では `import` できません。
- オフライン版は約1MBあります。1日分を出すだけなら要りません。代わりに [1日分のフィードを読み込む](api:loadFactDay) と、数KBで済みます。
- ページを変えたくないときは、アドレスにバージョンを書きます (`@johnmorrisdotca/meigen-sports@0.22.0`)。
- 何も表示されないときは、[困ったとき](troubleshooting.md) を見てください。
