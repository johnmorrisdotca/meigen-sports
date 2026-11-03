---
title: 事実の選び方
section: how-to
order: 10
description: その日の事実や、絞り込んだ事実を、有名な順、ランダム、またはその両方で選びます。シードを使うと同じ選びをもう一度出せます。
---

[pickFacts](api:pickFacts) は、その日の事実、またはリーグ・競技・チームの事実を、3つの方法のどれかで選びます。このパッケージは時計も乱数も使わないので、選び方は事実・オプション・シードだけで決まります。

```ts
import { pickFacts } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

// 11月3日の、競技を問わず最も有名な事実5件。
const famous = pickFacts(offline, { date: "2026-11-03", n: 5 });

// 同じ日を NHL だけで。ゴーディ・ハウなどの伝説が先に来ます。
const hockey = pickFacts(offline, { date: "2026-03-31", filters: { league: "nhl" }, n: 5 });

// 有名な2件は変わらず、残り3件はシードで選びます。同じシードなら同じ3件です。
const mixed = pickFacts(offline, { date: "2026-11-03", n: 5, mode: "mixed", fixed: 2, seed: "morning" });
console.log(famous.length, hockey.length, mixed.length);
```

## 3つの方法

| 方法 | 結果 |
|---|---|
| `ranked` (省略時) | 最も有名な `n` 件。ランキングの先頭です。シードは要りません。 |
| `random` | 全体から、シードで `n` 件を引きます。シードが必要です。 |
| `mixed` | 最も有名な `fixed` 件 (いつも同じ) のあと、残りをシードで引きます。`fixed` を省くと `n` の半分 (切り上げ) です。シードが必要です。 |

事実・オプション・シードが同じなら、事実が届く順番が違っても、選びはいつも同じです。訪れるたびに変えたいときは、自分のコードで新しいシード (ランダムな文字列) を作ってください。シードを省くと `random` と `mixed` はエラーになります。

## 先に絞り込み、あとで順位づけ

順位をつける前に、`filters` (競技・リーグ・チーム・人物・国など) で候補を絞ります。その日の全体では下の方にある事実 (たとえば CFL の伝説) も、CFL だけの選びでは先頭に来ます。その日の上位だけを取ってから絞ってはいけません。複数のリーグでプレーした人 (ゴーディ・ハウは NHL と WHA) は、そのどれにも入ります。

## Pages のフィードから

その日のフィード (`days/MM-DD.json`) には、その日の上位16件しか入っていないので、絞り込みには使えません。[loadFactPicks](api:loadFactPicks) は、リーグまたは大きな競技の、その日の上位24件を、絞り込み・順位づけ済みで読み込みます。それを `pickFacts` に渡します。

```ts no-run
import { pickFacts } from "@johnmorrisdotca/meigen-sports";
import { loadFactPicks } from "@johnmorrisdotca/meigen-sports/load";

const options = { baseUrl: "https://johnmorrisdotca.github.io/meigen-sports/", dataVersion: "0.1.0", fetch: (url: string, init?: RequestInit) => fetch(url, init) };
const best = await loadFactPicks({ league: "cfl" }, "07-29", options);
console.log(pickFacts(best, { n: 3 }).map((fact) => fact.text));
```

事実が1,500件に満たない競技には、専用の一覧がありません。その日のフィードを読んで絞り込んでください。

## デモと埋め込みページ

デモの「選び方」メニューには、固定 (有名な順)・ランダム・ミックスと、選び直すボタンがあり、シードはアドレスに入ります。`?pick=mixed&seed=abc` なら、だれが開いても同じ選びが見えます。[埋め込みページ](embed-in-an-iframe.md)は `mode`、`fixed`、`seed`、`league`、`sport` を受け取ります。

## ゴールデン事実

ゴールデン事実は、データがいつも持っていなければならない、有名で出典のしっかりした事実です (`test/golden/`)。`ranked` と、`mixed` の `fixed` の部分では、ゴールデン事実が必ず勝ちます。オフライン版のゴールデン事実は、その日の上位8件に入り、リーグごとの選びでもそのリーグの上位8件に入ることを、テストで確かめています。
