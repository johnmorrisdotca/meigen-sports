[English](open-sources.md) · 日本語

# 公開出典とライセンス

ダウンロードの前にライセンスを確認します。自動収集を禁じる出典、または CC0 / CC BY-SA 4.0 / CC BY 4.0 / Retrosheet でないデータは使いません。どの競技も Wikidata（CC0）と Wikipedia（CC BY-SA 4.0、クレジット付き）を控えにします。ESPN、Sports Reference、NHL の端点は使いません。

取得: `python3 -I pipeline/fetch_wikidata_open.py`。生の SPARQL は `data-sources/raw/wikidata/`（git 対象外）。変換用の抽出は `MEIGEN_EXTRACT_DIR`。このパッケージは DS1 に書きません。

## モータースポーツ

F1 の Jolpica（Ergast の後継）は **CC BY-NC-SA 4.0**（非営利）です。公開事実には入れません。Wikidata（CC0）を使います。NASCAR や MotoGP などの公式 API は公開データセットではないので使いません。

## 格闘技、ゴルフ、テニス、陸上、五輪

UFC の公式統計は公開データセットではありません。ボクシング、総合格闘技、メジャー、陸上、水泳、オリンピックとパラリンピックは Wikidata（CC0）です。

## 女子のリーグ

WNBA、NWSL、PWHL の公式サイトは公開データセットではありません。Wikidata の競技と大会の所属（WNBA、NWSL、PWHL、女子ワールドカップ）で取ります。性別では選びません。女子ワールドカップの試合は openfootball（CC0）の抽出にすでにあります。

## 引用

英語 Wikiquote のスポーツページは CC BY-SA 4.0 です。公式 API で取得し、題名・版・URL を残し、スポーツに関する行だけを入れます。[有名な引用](famous-quotes.ja.md) を見てください。Kaggle はダウンロード前に記載のライセンスを読みます。不明なライセンスや Goodreads / BrainyQuote の収集物は照合だけです。quotes.toscrape.com は GoodReads の教材用収集で、照合だけです。

## その他

自転車、ラグビー、クリケット、競馬、アルペンスキーは Wikidata（CC0）。eスポーツは、確認できた公開の構造化ダンプがまだ無いので、表の行は穴のままです。
