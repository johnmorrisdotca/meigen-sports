[English](coverage.md) · 日本語

# 収録の一覧

`python3 -I pipeline/coverage_matrix.py` が書き出します。数字は手で直さないでください。英語の表と JSON が正本です。

- [coverage.md](coverage.md) — 競技 × 年代 × タグの件数
- [coverage-matrix.json](../data-sources/coverage-matrix.json) — 同じ表の機械可読版

列の意味:

- **downloaded** — ディスク上の抽出
- **archived** — 同じファイル（DS1 の保管行は調整セッションが書く）
- **identity-linked** — 人物、フランチャイズ、試合の ID
- **rights-cleared** — CC0 / CC BY-SA 4.0 / CC BY 4.0 / Retrosheet
- **feed-ready** — 公開できる事実

掲載した競技は、件数が 0 でも行を残します。マスが 0 なのは穴です。性別やパラの印では選びません。

F1 の Jolpica は CC BY-NC-SA 4.0（非営利）なので公開事実には使いません。NASCAR や UFC などの公式 API も使いません。控えは Wikidata です。出典表は英語の [coverage.md](coverage.md) にあります。
