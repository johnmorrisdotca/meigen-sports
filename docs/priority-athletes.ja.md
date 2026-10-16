[English](priority-athletes.md) · 日本語

# 優先する選手

正本は [`data-sources/priority-athletes.csv`](../data-sources/priority-athletes.csv) です。あとのビルドは、これらの行を先に読みます。名簿は **1,000 人**です。John の重複なしの名前が先です。1,000 に足りない分は、次の順で足します（Wikipedia CC BY-SA / Wikidata CC0。NHL の端点、ESPN、Sports Reference は使いません）:

1. スタンレー・カップの決勝点・シリーズを決めた得点者（英語版『`List of Stanley Cup champions`』の `Winning goal` 欄）。
2. 野球の MVP（ア・リーグ / ナ・リーグ）、著名な本塁打打者、ホームランダービー優勝者。
3. 扱う競技の、悪名または象徴として広く知られる人物（出典のある事実だけ。噂、民族、宗教、健康、性、家族、政治は書かない）。
4. それでも足りなければ殿堂・賞の名簿。

John の重複なしがすでに 1,000 を超えるときは、その全員を残します。1,000 に合わせるために John の名前は落としません。

| 列 | 意味 |
| --- | --- |
| `name` | 書かれた名前 |
| `sport` | 競技のスラッグ |
| `qid` | Wikidata の番号。英語版記事が一人に決まるときだけ |
| `priority` | `1` はこの 1,000 人 |
| `notes` | 補充の理由（`SC GWG`、`MLB MVP`、`HR hitter`、`HR Derby`、`notorious:…`）、他競技、`ambiguous:…` |

## 重複の除き方

同じ人は一行です。

- Wikidata の QID が付いている: 出典が複数競技でも一行。
- QID がまだない: 折りたたんだ名前 **と** 同じ競技が重複。名前が同じでも競技や年代が違えば、QID で同一と分かるまで二行のまま。推測しません。

曖昧な名前は空のまま John に戻します。CSV に行を足して名前を追加します。QID は推測しません。

DS1 の `core.person` への結びは **QID のみ**です。同じ QID は空の欄を埋めるだけで、二件目は作りません。重複の疑いは記録し、結合しません。

## この名簿のあと

残りはサイトリンク、殿堂、主要賞、記録、五輪・パラリンピックのメダルで並べます。充足の数字は、その抽出ができてから [coverage.md](coverage.md) に出します。
