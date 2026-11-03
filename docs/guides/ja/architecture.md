---
title: 設計
section: explanation
order: 10
description: コード、パッケージ同梱のデータ、公開フィードを分けて置くしくみと、すべての関数が守る規則、その規則を守らせる検査を説明します。
---

このガイドは、パッケージを変更したい人や、その振る舞いの理由を知りたい人のための地図です。[データの作り方](how-the-data-is-built.md)は事実の出どころを説明します。このガイドは、事実がどこにあり、呼び出しがどのように事実へ届き、何が答えをどこでも同じに保っているかを説明します。

## 3つに分けて置く

```text
src/            the code: pure functions, typed, no data of their own
src/data/       what ships in the package: 1,525 offline facts, 30 quotations, a history starter
data/v1/<v>/    what is published on GitHub Pages: 126,810 facts in static JSON, with a catalogue
```

- **コード**（`src/`）はレコードを読み、レコードか文字列を返します。`fetch` を渡さない限り、ファイルは読まず、ネットワークにも接続しません。
- **パッケージのデータ**（`src/data/`）はあえて小さくしてあり、パックして約 1 MB です。`offline` エントリーポイントは、366日それぞれについて、重要度と知名度で選んだ上位3〜5件の事実を収めています。種類、競技、人物、クラブが偏らないようにしてあります。
- **フィード**（`data/v1/<version>/`）はすべての事実を収め、日、競技、エンティティごとのシャードに分かれています。`load*` 関数が検証してから読み込みます。サイトは、読み込めるときはフィードを使い、読み込めないときは offline のセットに切り替え、そのことも表示します。

1回のビルドが両方を作ります。`node scripts/check-build.ts` は、パッケージと GitHub Pages のサイトが同じビルドでないとき、リリースを失敗させます。パッケージのバージョン、データのフォルダ、事実のマニフェストの SHA-256 を比べます。

## 日付から文章まで

```text
a date ──► dates.ts ──► facts.ts ──► sentences.ts (templates/) ──► display.ts ──► HTML
 "11-20"   month-day     which facts    a fact worded for the day    four layouts
            or full date  match, ranked   it is read on, in a language  (calendarIcon beside)
```

- **`dates.ts`** は日付を読みます。`YYYY-MM-DD` は正確な日付、`MM-DD` は暦の日を表し、正確な日付を渡したときは、それより後のレコードも除外します。どの関数も時計を読みません。`calendarDayInZone(timeZone, nowIso)` は、渡した時刻をもとに、そのタイムゾーンで何日かを答えます。
- **`facts.ts`** は事実を選んで順位を付けます。日、競技、エンティティ、出典、種類、言語、テキストで絞り込めます。`significance` と `rankFeed` はフィードを並べ替え、特定の競技やクラブが一日を埋め尽くさないよう上限を設けます。
- **`sentences.ts`** と `templates/` は事実を文にします。文は、事実のフィールドからコミット済みのテンプレートで作ります。必要なフィールドがなければそのテンプレートは使わず、推測せずに言う内容を減らします。`renderRun` は、隣り合う文が同じ言い回しにならないよう、一覧を文にします。
- **`display.ts`** と **`calendarIcon.ts`** は結果を描画します。HTML の4つのレイアウトと、SVG の18種類のカレンダーページです。どちらも純粋関数です。

```js
import { factsFor, renderRun } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const facts = factsFor(offline, { date: "10-20" }).slice(0, 3);
const a = renderRun(facts, { seed: "card", locale: "en", asOf: "2026-10-20" });
const b = renderRun(facts, { seed: "card", locale: "en", asOf: "2026-10-20" });
console.log(a.length > 0, JSON.stringify(a) === JSON.stringify(b));
```

## 規則

1. **時計も乱数も使わない。** 日付、タイムゾーン、seed は引数です。同じ呼び出しは Node、Deno、Bun、ワーカー、ブラウザのどこでも同じ答えを返し、サーバーはブラウザと同じカードを描けます。
2. **出どころは行に付いて回る。** すべての事実と引用が、出典、ライセンス、元へのリンクを持ちます。コードの MIT ライセンスはデータには及びません。データの権利は `NOTICE.md` と `data-sources/` に書いてあります。
3. **日付を作り出さない。** 引用には発言の日付がないので、記念日は割り当てません。出版年は日付ではなく、大会の開始日は開会式の日ではありません。事実とは、出典が述べていることだけです。
4. **ローダーは検証する。** `load*` 関数は、渡した `fetch` を使い、返ってきたものをスキーマで検証して、合わないものは拒否します。そのためキャッシュ、再試行、キャンセルは呼び出す側で決められ、壊れたフィードがページに届くことはありません。
5. **出力するとき、テキストはエスケープする。** `displayMarkup` はすべての事実のテキストをエスケープするので、返される文字列は HTML としてそのまま設定できます。

## エントリーポイント

| エントリーポイント | 含むもの |
| --- | --- |
| `@johnmorrisdotca/meigen-sports` | 事実を選ぶ関数、文、カレンダーページ、レイアウト |
| `/offline` | パッケージに入れた「過去の今日」の事実 |
| `/history`、`/quotes` | 歴史データの入門セットと引用 |
| `/load` | 公開フィードのローダー |
| `/categories`、`/catalogue.json` | 事実の種類と、ビルドが数えた収録内容 |
| `/styles.css` | レイアウト用のスタイルシート（任意） |

## データの作り方

事実は、`scripts/data.ts` と `pipeline/` の Python パイプラインが、保管してチェックサムを付け、検証した出典の extract（取り出したデータ）から作ります。`pnpm data:check` は生成したすべてのバイトを、コミット済みの出典の入力と照合し、`node scripts/check-golden.ts` は、データに含まれているべき有名な事実が入っているかを確かめます。全体の説明は[データパイプライン](../../data-pipeline.ja.md)にあります。

## 正しさを保つしくみ

| 検査 | 何を確かめるか |
| --- | --- |
| `pnpm check` | シャード、lint、型、単体テスト、ビルド、パックしたパッケージ |
| `pnpm test:readme` | README、ドキュメント、ガイドのすべての例を、ビルドしたパッケージに対して実行する |
| `pnpm test:usage` | ガイドが示すパッケージの使い方すべてを、npm がパックしたとおりにビルドまたは実行する |
| `pnpm test:golden` | 有名な事実がデータに入っている |
| `pnpm test:demo` | デモを、実際のブラウザでスマートフォンの幅とデスクトップの幅に合わせて確かめる |
| `pnpm docs:check` | すべての export にドキュメントコメントと実行される例があり、すべてのガイドにフロントマターがあり、リンク先が存在する |
