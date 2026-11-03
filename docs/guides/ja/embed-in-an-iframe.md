---
title: iframe で埋め込む
section: how-to
order: 5
description: 埋め込みページの iframe で、どのページにもその日のスポーツの歴史を載せます。日付・テーマ・言語はアドレスで選びます。
---

埋め込みページは `<iframe>` 用に作ってあり、カード1枚だけを表示します。表示する内容はアドレスで決まるので、自分でコードを書く必要はありません。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Meigen Sports in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/meigen-sports/embed.html?date=10-20&theme=pins&lang=en"
      title="Sports history for October 20"
      width="420"
      height="360"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

## アドレス

| キー | 値 | 省略したとき |
|---|---|---|
| `date` | `10-20` または `2026-10-20` | 読む人のタイムゾーンでの今日 |
| `theme` | [カレンダーのテーマ](api:CALENDAR_THEMES) 18種類のどれか (`pins`、`desk`、`flip` など) | `pins` |
| `lang` | `en` または `ja` | `en` |
| `layout` | `calendar`、`years`、`compact`、`featured` ([並べ方](api:DISPLAY_LAYOUTS)) | `calendar` |
| `sport` | `ice-hockey` のような競技 (その競技の、この日の上位の事実) | すべての競技 |
| `league` | `nhl` や `cfl` のようなリーグ (そのリーグの、この日の上位の事実) | すべてのリーグ |
| `mode` | `ranked` (有名な順)、`random` (ランダム)、`mixed` (有名な順に数件＋ランダム)。[事実の選び方](picking-facts.md)を見てください | `ranked` |
| `fixed` | `mixed` のときだけ。有名な順に出す件数 | `n` の半分 (切り上げ) |
| `seed` | `random` と `mixed` のとき。同じシードなら同じ事実 | 読み込むたびに新しいシード |
| `n` | 1〜12 | 3 |
| `scheme` | `light` または `dark` | 読む人の設定 |

知らないテーマや並べ方はデフォルトになります。日付として正しくない値は、今日として扱います。枠が読むのは、その日のフィードのファイルだけで、待っている間は何も描きません。

## 注意

- スクリーンリーダーのために、上のように枠に title を付けます。
- 事実が3件のとき、カードの大きさは幅420px、高さ360pxほどです。背の高い並べ方には、背の高い枠が要ります。
- 自分のコードでカードを作りたいときは、関数を使います。[通常の HTML](html-and-cdn.md) を見てください。
