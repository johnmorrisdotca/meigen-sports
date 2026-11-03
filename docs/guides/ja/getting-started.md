---
title: はじめに
section: tutorial
order: 1
description: パッケージをインストールして、数行でその日のスポーツの歴史を表示します。次に読むページもここにあります。
---

Meigen Sports は、1年のどの日についても、スポーツの歴史を返します。出典のついた日付入りの事実、それを英語か日本語で言い表した文、横に置くカレンダーのページです。ネットワークも時計も使わないので、同じ入力からはいつも同じ答えが返ります。

## インストール

```sh
npm install @johnmorrisdotca/meigen-sports
```

実行時に使う依存は1つだけです。カレンダーのページを描く [koyomi-calendars](https://www.npmjs.com/package/@johnmorrisdotca/koyomi-calendars) です。データはパッケージと公開フィードのファイルに入っていて、データベースには接続しません。

## 今日の事実を表示する

パッケージは時計を読みません。「今」はあなたが渡します。[today](api:today) は、タイムゾーンでの今日の事実を選び、[renderRun](api:renderRun) が文にします。同じ seed なら、同じ文になります。

```ts
import { renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const facts = today(offline, "America/Toronto", "2026-10-20T15:00:00Z");
const sentences = renderRun(facts.slice(0, 3), { seed: "first", locale: "en", asOf: "2026-10-20" });
for (const sentence of sentences) console.log(sentence.text);
```

同梱のオフライン版には、毎日の事実が3〜8件ずつ入っています。ネットワークがなくても動きます。`asOf` は表示する日です。その日の事実は「今日」や「65歳になる」と言えますが、ほかの日の事実は日付を全部書きます。

## 絞り込む、日本語で表す

[factsFor](api:factsFor) は、渡した条件にすべて合う事実だけを残します。`locale: "ja"` で日本語の文になります。

```ts
import { factsFor, renderRun } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const hockey = factsFor(offline, { date: "10-20", sport: "ice-hockey" });
for (const sentence of renderRun(hockey.slice(0, 2), { seed: "first", locale: "ja", asOf: "2026-10-20" })) console.log(sentence.text);
```

## 次に読む

- ページに載せる: [HTML と CDN](html-and-cdn.md)、[Vite と webpack](bundlers.md)、[React・Vue・Svelte・Angular](frameworks.md)、[iframe](embed-in-an-iframe.md)。
- 型を使う、サーバーで動かす: [TypeScript と Node](typescript-and-node.md)。
- すべての export にリファレンスのページがあります: [calendarIcon](api:calendarIcon)、[displayMarkup](api:displayMarkup)、[loadFactDay](api:loadFactDay)。
- 事実の出どころ: [データの作り方](how-the-data-is-built.md)。
