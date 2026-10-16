[English](famous-quotes.md) · 日本語

# 有名な引用

`famous-quotes` は、既存の `quote` 種に付ける **収集タグ** です。`kind` は `quote` のまま、`types` は `quotation` と `famous-quotes` です。46個の `HISTORY_TYPES` には入りません。Gutenberg の本の抜粋は `historical` のみです。

文言は、権利を確認した出典の原文だけを保存します。各行に話者、出典（題名、版、URL）、帰属、ライセンス、`rightsReasoning`（権利の理由）を付けます。出典が日付を示さない限り、発言日は空です。`quoteForDate` は暦日のハッシュで選ぶだけで、その日に言ったとは主張しません。

## ページのライセンスと引用された文言

英語版 Wikiquote の **ページの編集物** は CC BY-SA 4.0 です。並び、ウィキ文、一部の編集文が対象です。引用された **文言そのもの** には及びません。文言の権利は、パブリックドメインである場合や、短い標語で著作物に当たらない場合を除き、話者または著者に残ります。

公開する引用には、次の両方が必要です。

1. **帰属**（話者、固定した題名、版、URL）。
2. **記録した `rightsReasoning`**。ページではなく、その **文言** を公開できる理由です。

正当化できない行は入れません。穴は穴のままです。

## 主たる取り込み: Wikiquote（ページは CC BY-SA 4.0）

スポーツのページと選手・監督の関連ページは、公式 API（`action=query` の版、または `action=parse` / REST）で取得します。題名、版番号、`oldid` の URL を各行に残します。[Wikiquote:Copyrights](https://en.wikiquote.org/wiki/Wikiquote:Copyrights) を表示します。映画・テレビの台詞は保存しません。論争中、出典なし、機微な話題の行は除きます。

この種は、文言の権利を説明できる Wikiquote のスポーツ引用を **8件** 残します（票 `cmv91xw8o0000jp06crow6utm`）。領域ごとのパブリックドメインが5件（Herbert、Goldsmith、Hughes、Roosevelt、Coubertin の1920年の宣誓）。米国で著作物に当たらない短い標語が3件（Sanders、Berra、John Thomas。[Circular 33](https://www.copyright.gov/circs/circ33.pdf)）。Gutenberg の22件と合わせ、公開の引用は30件です。原文は英語のみです。日本語訳は作りません。

2026-10-16 に取得した Wikiquote の JSON 14件は、すでに DS1 の `wikiquote/2026-10-16/` に保存済みです。再保存しません。次の原資料の引き渡しでは `scripts/archive_raw.py <prefix> <dir> <date> --sql-out …` を使います。

## 照合だけ（取り込みなし）

データセットのページで、ダウンロードの前にライセンスを読みます。教材用の収集許可は、再配布の許諾ではありません。

| 出典 | 記載のライセンス | 判断 |
| --- | --- | --- |
| [kieranpoc/quotes](https://www.kaggle.com/datasets/kieranpoc/quotes)（WikiQuoteXL） | CC BY-SA 4.0。Wikiquote からの抽出。人物ページ。映画ではない | オープンだが、公開リポジトリに 117 MB のダンプは置きません。現行の Wikiquote で確認し、固定した API の版を取り込みます。 |
| [manann/quotes-500k](https://www.kaggle.com/datasets/manann/quotes-500k) | **不明**。例は Goodreads 風（Monroe、Purkey、Seuss、映画の行） | （話者, 文言）の照合のみ。CSV を git に入れません。 |
| [quotes.toscrape.com](https://quotes.toscrape.com/) | Zyte の Scrapy 教材。引用は GoodReads.com | 照合のみ。Harry Potter など文学の行。スポーツとしては取り込みません。 |
| AZQuotes、BrainyQuote、Goodreads、Bleacher Report など、この票で挙げた順位表 | 編集著作物 | 照合のみ。収集しません。ESPN、Sports Reference、NHL の端点は使いません。 |

## 見送り（欠落）

Wikiquote のページ許諾だけでは文言を公開できない行、または話題の規則に合わない行は入れません。映画の台詞（Rocky、The Sandlot など）。Ali の蝶の比喩（使ったページでは一覧記事のみ）。宗教・祈り・暴力・政治・性差のジャーナリズム。欠ける Wikiquote ページ（Gretzky ほか）。

**19件の種から外した行**（話者の文言はなお著作権があり、Wikiquote の CC BY-SA では許諾されない）: Ali の1978年の雑誌。Lombardi の1959年の会合（2004年の報告）と 2001年の「最後まで」。Jordan の1998年の書籍。Wooden の1972年の指導書と 2003年の広告。Gehrig の1939年の演説（カナダと英国ではパブリックドメイン、米国では2035年まで）。Paige の1958年の新聞。Pelé の1980年の本。Owens の2002年の放送。Shankly の1981年のテレビ。

Lombardi に誤って付けられた「Winning isn't everything」は Red Sanders として保存します。穴は穴のままです。文言を推測しません。
