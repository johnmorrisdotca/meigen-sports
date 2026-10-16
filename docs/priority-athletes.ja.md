[English](priority-athletes.md) · 日本語

# 優先する選手

正本は [`data-sources/priority-athletes.csv`](../data-sources/priority-athletes.csv) です。あとのビルドは、これらの行を先に読みます。名簿は **1,000 人**です。John の重複なしの名前が先で、1,000 人に足りなければ知名度で足します。John の重複なしがすでに 1,000 を超えるときは、その全員を残します。

| 列 | 意味 |
| --- | --- |
| `name` | 書かれた名前 |
| `sport` | 括弧内の競技をスラッグにしたもの（先頭の競技） |
| `qid` | Wikidata の番号。その名前（必要なら競技付き）の英語版記事が一人に決まるときだけ入れる |
| `priority` | `1` はこの優先名簿 |
| `notes` | 他競技、`ambiguous:…`、`fame-fill`、QID が空の理由 |

## 重複の除き方

同じ人は一行です。

- Wikidata の QID が付いている: 出典が複数競技でも一行。
- QID がまだない: 折りたたんだ名前 **と** 同じ競技が重複。名前が同じでも競技や年代が違えば、QID で同一と分かるまで二行のまま。推測しません。

曖昧な名前は空のまま John に戻します。

## 人数

John の重複なしのあと、1,000 人に足りなければ、まだ載っていない人から証拠の強い順（殿堂・賞の名簿、のちサイトリンク、記録、五輪・パラリンピックのメダル）に、競技と男女をまたいで足して 1,000 行にします。1,000 に合わせるために John の名前は落としません。

名前の追加は CSV に行を足します。QID は推測しません。空の QID は `python3 -I pipeline/priority_athletes.py` で Wikipedia の `/wiki/` と Wikidata の EntityData から埋めます。

DS1 の `core.person` への結びは **QID のみ**（`core.external_id` の `wikidata`）です。同じ QID は空の欄を埋めるだけで、二件目の人物は作りません。重複の疑いがある対は記録し、結合しません。

出典は Wikidata（CC0）と英語版 Wikipedia（CC BY-SA 4.0）です。ESPN、Sports Reference、NHL の端点は使いません。

## この名簿のあと

残りはサイトリンク数、殿堂、主要賞、記録、五輪・パラリンピックのメダルで並べます。上位 1,000 人を長い尾より先に揃えます。競技ごとの上位 100 / 1,000 / 10,000 の充足は、その抽出ができてから [coverage.md](coverage.md) に出します。
