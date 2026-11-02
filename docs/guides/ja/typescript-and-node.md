---
title: TypeScript と Node
section: how-to
order: 6
description: パッケージの型を使います。同じ関数が、DOM のないサーバーでも動きます。
---

パッケージは、エントリーポイントごとに自分の型を持っています。関数は純粋で、日付や seed は引数です。なので、Node でも Deno でも Bun でもワーカーでもブラウザでも、同じ呼び出しは同じ答えを返します。このファイルは型を検査したあと、型を取り除いてくれる Node 22.18 以降でそのまま実行します。

```ts
import { factsFor, renderRun, type DisplayLayout, type OnThisDayRecord, type RunSentence } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const facts: OnThisDayRecord[] = factsFor(offline, { date: "10-20" });
const sentences: RunSentence[] = renderRun(facts.slice(0, 3), { seed: "ts", locale: "en", asOf: "2026-10-20" });
console.log(facts.length > 0, sentences.length);

// @ts-expect-error "grid" is not one of the four layouts
const layout: DisplayLayout = "grid";
console.log(layout);
```

`@ts-expect-error` は、`"grid"` が4つの [並べ方](api:DISPLAY_LAYOUTS) のどれでもなく、コンパイラが断ることを示すためのものです。

## サーバーで

サーバーでも、ブラウザと同じカードを作れます。DOM も時計もなく、「今」は呼ぶ側が渡します。

```mjs
import { calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

// A server draws the same card a browser does: pure functions, no DOM, no clock (the caller says what "now" is).
const facts = renderRun(today(offline, "America/Toronto", "2026-10-20T15:00:00Z").slice(0, 3), { seed: "card", locale: "en", asOf: "2026-10-20" });
const card = displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month: 10, day: 20, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
const page = `<!doctype html><title>Sports history</title>${card}`;
console.log(facts.length, page.includes("meigen-cal"));
```

## よく使う型

- [OnThisDayRecord](api:OnThisDayRecord): 事実1件。[MeigenRecord](api:MeigenRecord): 名言か歴史データ1行。
- [RunSentence](api:RunSentence)、[RenderOptions](api:RenderOptions): 文の材料。
- [LoadOptions](api:LoadOptions) と [FetchFeed](api:FetchFeed): 読み込みの関数は自分の `fetch` を受け取るので、キャッシュ、再試行、キャンセルは自分で決められます。
