---
title: 困ったとき
section: troubleshooting
order: 8
description: ページに何も出ないとき、その日の事実が少ないとき、読み込みでよく出るエラーについて。
---

## 通常のページで何も表示されない

- **script がモジュールになっていない。** `<script type="module">` を使います。
- **script タグでパッケージ名をそのまま使っている。** ブラウザは `@johnmorrisdotca/meigen-sports` を解決できません。CDN のアドレス ([通常の HTML](html-and-cdn.md))、import map、バンドラー ([バンドラー](bundlers.md)) のどれかを使います。
- **ファイルとしてページを開いている。** 別のオリジンのモジュールや `fetch` には、Web サーバーが要ります。`npx serve` や開発サーバーを使います。

## その日の事実が少ない

オフライン版には、1日あたり3〜8件だけ入っています。もっと見たいときは、その日のフィード ([loadFactDay](api:loadFactDay)) を読み込むか、索引 ([queryFacts](api:queryFacts)) で探します。競技やリーグで絞ると、さらに減ります。静かな日は、もともと少なくなります。

## 違う日なのに「今日」や「65歳になる」と書かれる

`asOf` に、表示している日 (`YYYY-MM-DD`) を渡します。渡さないと、文はどこでも正しい形になり、事実の日付を全部書きます。渡すと、その日の事実だけが「今日」と言います。

## 「Feed request failed (404)」

ファイルがありません。国、競技、id を打ち間違えると、空の答えではなく 404 になります。打ち間違いが「事実なし」に見えることはありません。[loadVocabulary](api:loadVocabulary) で綴りを確かめます。

## 「Expected a public HTTPS base URL」

読み込みの関数が受け付けるのは `https:` のアドレスです。`http:` は `localhost` と `127.0.0.1` だけで、ユーザー名・クエリ・フラグメントは付けられません。`baseUrl` には、`https://johnmorrisdotca.github.io/meigen-sports/` のようなサイトのアドレスを渡します。

## 「Invalid data version」

`dataVersion` はフィードのバージョンのフォルダ (`0.1.0`) で、パッケージのバージョンではありません。

## Angular でカードにカレンダーのページが出ない

Angular のサニタイザーは `[innerHTML]` から SVG を取り除きます。[Angular の例](frameworks.md#angular) のように、文字列を明示的に信頼します。事実の文字はすでにエスケープされています。
