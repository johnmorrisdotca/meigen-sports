---
title: 日付から文章まで
section: how-to
order: 11
description: タイムゾーンに合わせてその日の事実を選び、絞り込み、読み手の言語と読む日に合わせて文にして、引用を添えます。
---

スポーツの歴史のカードは、4つの判断でできています。どの日か、その日のどの事実か、どう文にするか、横に何を置くかです。どれも、渡した値だけで結果が決まる純粋関数で、時計も乱数も使いません。そのため、このガイドの内容はターミナルでもサーバーでもページでも同じように動きます。

## どの日か

`calendarDayInZone(timeZone, nowIso)` は、渡した時刻に、そのタイムゾーンで何日かを `MM-DD` で返します。ライブラリは時計を読みません。時計を読むのは呼び出す側です。一度だけ読んで、その時刻を下の関数へ渡していきます。

```js
import { calendarDayInZone, isDate, monthDayOf } from "@johnmorrisdotca/meigen-sports";

// 03:00 UTC on 21 October is still the 20th in Toronto, and already the 21st in Tokyo.
console.log(calendarDayInZone("America/Toronto", "2026-10-21T03:00:00Z"), calendarDayInZone("Asia/Tokyo", "2026-10-21T03:00:00Z")); // 10-20 10-21
console.log(isDate("2026-10-20"), isDate("10-20"), isDate("tomorrow")); // true false false
console.log(monthDayOf("2022-11-20"), monthDayOf("11-20")); // 11-20 11-20
```

`isDate` は、正確な `YYYY-MM-DD` の形かどうかを調べます。`monthDayOf` は、その形か暦の `MM-DD` を、暦の日（`MM-DD`）にそろえます。事実を選ぶ関数は、どちらの形も受け取ります。正確な日付を渡すと、それより後の日付のレコードも除外し、暦の日を渡したときは除外しません。

## どの事実か

`factsFor(set, options)` は、「過去の今日」の事実のセットから事実を選びます。セットとは、パッケージに入っている `offline` か、フィードから読み込んだ一日分のシャードです。`today(set, timeZone, nowIso)` は、そのタイムゾーンでの今日について同じことをします。競技で絞り込むには `sport` を使います。

```js
import { factsFor, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const all = factsFor(offline, { date: "11-20" });
const soccer = factsFor(offline, { date: "11-20", sport: "soccer" });
console.log(all.length > 0, soccer.length <= all.length, soccer.every((fact) => fact.sport === "soccer"));
console.log(today(offline, "America/Toronto", "2026-11-20T15:00:00Z").length > 0); // true
```

空の結果が返ることはありえますし、想定内です。今のデータには欠けがあり（歴史データの入門セットには、暦の日のうち224日に行がありません）、パッケージは事実を作り出さず、そのまま空で返します。翌日やほかの競技を試すか、はるかに多くの事実を持つ公開フィードを使ってください。

## 読む日に合わせて文にする

`render` と `renderRun` は事実を文にします。表示する日（`asOf`）を渡します。事実のまさにその日には、文は「今日」「この日」と言ってよく、年も残します。それ以外の日は、レコードが持つ精度で日付を全部書きます。`locale` は `en` か `ja` です。`renderRun` は、隣り合う文が同じ言い回しにならないよう一覧を文にし、`seed` は選び方を毎回同じにします。

```js
import { factsFor, renderRun } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const facts = factsFor(offline, { date: "10-20" }).slice(0, 3);
const en = renderRun(facts, { seed: "card", locale: "en", asOf: "2026-10-20" });
const ja = renderRun(facts, { seed: "card", locale: "ja", asOf: "2026-10-20" });
console.log(en.length, ja.length, en[0].text !== ja[0].text);
console.log(/[぀-ヿ一-鿿]/.test(ja[0].text));
```

事実にテンプレートが必要とするフィールドがなければ、そのテンプレートは使わず、文は言う内容を減らします。推測はしません。

## 引用と歴史データの入門セット

引用には発言の日付がないので、記念日を割り当てることはありません。`quoteForDate` は、日付ごとに決まった一つを選ぶので、同じ日付なら同じ引用になります。`historyOnDate` は、歴史データの入門セットを日と競技で絞り込みます。

```js
import { historyOnDate, quoteForDate } from "@johnmorrisdotca/meigen-sports";
import history from "@johnmorrisdotca/meigen-sports/history";
import quotes from "@johnmorrisdotca/meigen-sports/quotes";

console.log(quoteForDate(quotes, "2026-10-14")?.speaker); // James Dwight
console.log(quoteForDate(quotes, "2026-10-14")?.speaker === quoteForDate(quotes, "2026-10-14")?.speaker); // true
console.log(historyOnDate(history, "2022-11-20", { sports: ["soccer"] }).length); // 1
```

すべてのレコードが出典、ライセンス、元へのリンクを持つので、ページは言葉の出どころを示せます。リンクは `record.source` と `wikipediaUrl` から得られます。

## カレンダーページの横に置く

この4つの段階の結果を `calendarIcon` と一緒に `displayMarkup` に渡します。18種類のカレンダーページと4つのレイアウトは[カレンダーページとレイアウト](../../display-layouts.md)にあり、デモの[ビルダー](https://johnmorrisdotca.github.io/meigen-sports/builder.html)は、選んだ組み合わせのコードを書き出します。126,810件の事実を持つ公開フィードを使うには、`loadFactDay` で一日分を読み込み、そのレコードを同じ関数に渡します。一日分が空で返ってきたときなどは、[TypeScript と Node](typescript-and-node.md)と[困ったとき](troubleshooting.md)を参照してください。
