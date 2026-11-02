[English](calendar-gallery.md) · 日本語

# カレンダーのギャラリー

十七のカレンダーを、五つの日付と六つの大きさで、明るい色と暗い色で並べました。日付は、1日（1月1日）、一桁の日（2月9日、9月9日）、長い月の名前（9月、11月、12月）、31日です。どの絵も `calendarIcon` を一回呼んだものです。上の二段は年つきの日付（曜日が入るテーマもあります）、下の二つは 12月31日 を16から96ピクセルで、年なしで並べています。絵の `<title>` と `aria-label` は日本語の日付の順で、年つきは `2026年12月31日（木曜日）`、年なしは `12月31日` です。`sun` と `roll` には、土日ページ（6月6日・7日、10月31日・11月1日、5月30日・31日、12月31日・1月1日）の段もあります。どの絵でも、日付は紙の真ん中にあり、年は下の縁から離れた場所にあります。使い方は [calendar-icons.md](calendar-icons.md) を見てください。

```js
import { CALENDAR_THEMES, calendarIcon } from "@johnmorrisdotca/meigen-sports";

const dates = [[1, 1], [2, 9], [9, 9], [11, 30], [12, 31]];
const sheet = CALENDAR_THEMES.map((theme) => dates.map(([month, day]) => calendarIcon({ theme, month, day, year: 2026, locale: "ja", scheme: "light", size: 112 })));
console.log(sheet.length, sheet[0].length); // 17 5
const sizes = [16, 24, 32, 48, 64, 96].map((size) => calendarIcon({ theme: "pins", month: 12, day: 31, locale: "ja", scheme: "dark", size }));
console.log(sizes.length); // 6
```

## ピン留め

`pins`: 白いページに赤い見出しと二つのピン。月は大文字で、日付は大きく。

![ピン留め：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-pins-ja.webp)

## 輪綴じ

`loops`: 灰色の枠と灰色の見出し、三つのリング。

![輪綴じ：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-loops-ja.webp)

## 長い影

`shadow`: 青い見出しと黒いコイルが五つ。丸で囲んだ日付と、薄紫の台に長い影。

![長い影：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-shadow-ja.webp)

## 極太

`heavy`: とても太い黒の枠。上の縁にリングの穴、見出しの下に黒い線。

![極太：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-heavy-ja.webp)

## マンガ風

`cartoon`: 黒い太枠、ピンクの見出し、白いリング。月も数字も太く大きく。

![マンガ風：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-cartoon-ja.webp)

## 卓上

`flip`: 斜めから見た卓上カレンダー。コイル、薄い色の見出し、傾いた数字、重なった紙。

![卓上：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-flip-ja.webp)

## 重ね

`stack`: 黒く塗った形に、傾いた白いページ。角が丸まり、下にもう一枚。

![重ね：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-stack-ja.webp)

## 線画

`line`: 黒い線の絵。目盛りが四つ、大きな青い数字。

![線画：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-line-ja.webp)

## めくり

`curl`: オレンジの見出しの線画。フックが二つ、細くて丸い数字、めくれた角。

![めくり：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-curl-ja.webp)

## やわらか

`soft`: オレンジの見出し、黄色のリングが三つ、クリーム色のページ、丸みのある珊瑚色の数字。

![やわらか：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-soft-ja.webp)

## 立体

`desk`: 斜めに置いた卓上シート。銀色のコイル、赤い帯に白い数字、その月の日付。

![立体：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-desk-ja.webp)

## 細字

`thin`: 白い無地のページ。曜日は赤、数字はとても細い。

![細字：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-thin-ja.webp)

## 四色枠

`frame`: 四色の辺が淡い四角を囲み、青い数字と折れた角。

![四色枠：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-frame-ja.webp)

## バッジ

`badge`: 白いタイルに、やわらかい青いページと白い数字。

![バッジ：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-badge-ja.webp)

## 日の丸

`sun`: 四角い日めくり。上に灰色のはがす帯、赤い丸の上に大きな黒い数字、年は上、左右に欄があります。三段目と四段目は土日ページです。

![日の丸：五つの日付、四つの土日ページ（明るい色と暗い色）と六つの大きさ](images/gallery-sun-ja.webp)

## 壁掛け

`roll`: 縦長の壁掛け日めくり。はがした紙が上で丸まり、曜日の色の大きな細長い数字、左右の欄、点線のメモ欄があります。三段目と四段目は土日ページです。

![壁掛け：五つの日付、四つの土日ページ（明るい色と暗い色）と六つの大きさ](images/gallery-roll-ja.webp)

## 無地

`plain`: 無地の日めくり。クラフト紙の台に、小さな月、大きな数字、大文字の曜日、月と年、月の満ち欠けがあります。

![無地：五つの日付（明るい色と暗い色）と六つの大きさ](images/gallery-plain-ja.webp)
