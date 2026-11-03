---
title: データの作り方
section: explanation
order: 7
description: 事実や名言の出どころ、すべてに出典を付ける理由、そしてパッケージが推測をしない理由。
---

パッケージの事実や名言には、出典と、その出典が許す利用条件がすべて付いています。コードは MIT ライセンスで、データはそれぞれの権利を持ちます。[NOTICE.md](../../../NOTICE.md) に一覧があります。

## 文ではなく、事実のデータ

[過去の今日の事実](api:OnThisDayRecord) は、日付、種類、人やチーム、出典などの項目でできていて、他人の文をそのまま持つことはありません。読む文は、項目からテンプレートで作ります ([render](api:render))。英語と日本語があります。項目が足りないときは、そのテンプレートを使いません。推測するより、言わないほうを選びます。

## 日付

日付には精度があります。日、月、年、およそ、のどれかです。文は、記録が持っていることだけを言います。Wikidata 自身が2つの日付を同じ重みで挙げているときは、そのことを書き ([dateNote](api:dateNote))、これまでの日付はそのまま残します。パッケージは時計を読みません。`asOf` で渡した日に合わせて文を作ります。

## 生まれた場所

生まれた場所は、町と、その国がいまもあるときはその国です ("Hoofddorp, Kingdom of the Netherlands")。Wikidata は場所の最初の国を挙げますが、それがとうに消えた国のこと ("London, Roman Empire") があります。そのときは町だけを言います。

## 同梱とフィード

オフライン版は、毎日の事実を3〜5件ずつ入れたもので、ネットワークなしで「今日」が動きます。全データは GitHub Pages の静的 JSON です。[日ごと](api:loadFactDay)、[競技ごと](api:loadSport)、[国ごと](api:loadCountry)のファイルがあり、[索引](api:queryFacts)を使えば「10月20日のルーマニアの事実」も取れます。読む人に鍵は要らず、読む人ごとにデータベースを呼ぶこともありません。

## 何も失わない作り直し

事実は、gitに入っていないextract（取り出したデータ）から作ります。`pnpm data:facts` は、extractが足りない、空、またはあとから作るべきextractより古いときは、ファイル名を示して止まります。入力ごとのSHA-256は `data-sources/facts/inputs.json` に残します。そのあと、新しい事実を前回のリリースの事実と比べます。事実が消える、idが変わる、種類ごとの数が減る、idが同じ事実の項目が変わる、のどれかがあると、何も書かずに止まります。`data-sources/rebuild-allow.json` に理由つきで書いたものだけは通ります。作り直しの順番は `pipeline/README.md` にあります。

## 中身の一覧

`catalogue.json` は、データが持っているものすべてを、ビルドが事実から数えたものです。それぞれの数字の意味は[型](api:Catalogue)に書いてあります。グラフのページは [catalogue.html](https://johnmorrisdotca.github.io/meigen-sports/catalogue.html) です。

## もっと

- リポジトリの [データパイプライン](../../data-pipeline.md)、[レコードの形](../../record-schema.md)、[歴史データの考え方](../../history-model.md)。
- [使うデータと使わないデータ](../../open-sources.md)。
