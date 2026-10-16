[English](famous-quotes.md) · 日本語

# 有名な引用

`famous-quotes` は、既存の `quote` 種に付ける **収集タグ** です。`kind` は `quote` のまま、`types` は `quotation` と `famous-quotes` です。46個の `HISTORY_TYPES` には入りません。Gutenberg の本の抜粋は `historical` のみです。

文言は、権利を確認した出典の原文だけを保存します。各行に話者、出典（題名、版、URL）、帰属の確度、ライセンス、翻訳の由来を付けます。出典が日付を示さない限り、発言日は空です。`quoteForDate` は暦日のハッシュで選ぶだけで、その日に言ったとは主張しません。

## 主たる取り込み: Wikiquote（CC BY-SA 4.0）

スポーツのページと選手・監督の関連ページは、公式 API（`action=query` の版、または `action=parse` / REST）で取得します。題名、版番号、`oldid` の URL を各行に残します。[Wikiquote:Copyrights](https://en.wikiquote.org/wiki/Wikiquote:Copyrights) を表示します。ページの編集物は CC BY-SA 4.0 ですが、個々の引用は元作品の公正利用のままのことがあります。映画・テレビの台詞は保存しません。論争中、出典なし、機微な話題の行は除きます。

この種は、出典のあるスポーツ引用を19件足します（票 `cmv91xw8o0000jp06crow6utm`）。Gutenberg の22件と合わせ、公開の引用は41件です。原文は英語のみです。日本語訳は作りません。

## 照合だけ（取り込みなし）

データセットのページで、ダウンロードの前にライセンスを読みます。教材用の収集許可は、再配布の許諾ではありません。

| 出典 | 記載のライセンス | 判断 |
| --- | --- | --- |
| [kieranpoc/quotes](https://www.kaggle.com/datasets/kieranpoc/quotes)（WikiQuoteXL） | CC BY-SA 4.0。Wikiquote からの抽出。人物ページ。映画ではない | オープンだが、公開リポジトリに 117 MB のダンプは置きません。現行の Wikiquote で確認し、固定した API の版を取り込みます。 |
| [manann/quotes-500k](https://www.kaggle.com/datasets/manann/quotes-500k) | **不明**。例は Goodreads 風（Monroe、Purkey、Seuss、映画の行） | （話者, 文言）の照合のみ。CSV を git に入れません。 |
| [quotes.toscrape.com](https://quotes.toscrape.com/) | Zyte の Scrapy 教材。引用は GoodReads.com | 照合のみ。Harry Potter など文学の行。スポーツとしては取り込みません。 |
| AZQuotes、BrainyQuote、Goodreads、Bleacher Report など、この票で挙げた順位表 | 編集著作物 | 照合のみ。収集しません。ESPN、Sports Reference、NHL の端点は使いません。 |

## 見送り（欠落）

Wikiquote で権利を確認できなかった有名な行、または話題の規則に合わない行は入れません。映画の台詞（Rocky、The Sandlot など）。Ali の蝶の比喩（使ったページでは一覧記事のみ）。宗教・祈り・暴力・政治・性差のジャーナリズム。欠ける Wikiquote ページ（Gretzky ほか）。Lombardi に誤って付けられた「Winning isn't everything」は Red Sanders として保存します。穴は穴のままです。文言を推測しません。
