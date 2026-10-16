[English](record-schema.md) · 日本語

# ウェブサイト向けの記録の形

過去の今日の事実をサイトが読むときの形です。既存の `MeigenRecord` は、出典付きの文章のままです。抽出結果の `JSON` は、下のオブジェクトをすでに持ちます。`text` から名前を解析しません。

識別子は安定した ID です。表示名では人やチームを結びません。ライブラリの選択は決定的で、時計も乱数も使いません。

## すべての記録

| 欄 | 型 | 意味 |
| --- | --- | --- |
| `recordId` | 文字列 | データセット内で一意 (`spx:game:123`) |
| `eventDate` | 文字列または null | 精度が `day` のとき `YYYY-MM-DD`。それ以外は null |
| `datePrecision` | `day` / `month` / `year` | 年だけの指名や賞は日付を作りません |
| `category` | `EXTRACT_CATEGORIES` | 試合、決勝、サッカー、誕生日、死去、指名、賞など |
| `sport` | 文字列または null | 競技コード、または `soccer` |
| `competition` | 文字列または null | リーグ、大会、賞のコード |
| `league` | 文字列または null | SPXN のリーグコード |
| `source.sourceId` | 文字列 | 出典コード |
| `source.licence` | 文字列 | 出典のライセンス |
| `source.attribution` | 文字列 | 表示が必要なクレジット |
| `source.url` | 文字列または null | 出典ページ |

公開フィードは `nhl_api` と、SPX が所有するとしたライセンスの行を入れません。

## 試合

ホームとアウェイは文字列ではなくオブジェクトです。5大リーグの試合は `gameId`（SPXN の試合 ID）を持ち、`https://spxn.com/<league>/<season>/game/<gameId>-…` へリンクできます。分かるときは `venueId` と `seasonStartYear` もあります。

`TeamRef`:

| 欄 | 型 | 意味 |
| --- | --- | --- |
| `name` | 文字列または null | 表示用の名前 |
| `franchiseId` | 数値または null | フランチャイズ ID |
| `teamSeasonId` | 数値または null | そのシーズンのチーム ID |
| `soccerTeamId` | 文字列または null | サッカーのチーム ID |
| `countryCode` | 文字列または null | `ISO 3166-1` の2文字 |
| `fifaCode` | 文字列または null | FIFA の3文字コード（代表） |
| `flagCode` | 文字列または null | 旗用コード（例 `GB-ENG`） |

サッカーは `soccerTeamId` を入れ、`franchiseId` と `teamSeasonId` は null です。代表は FIFA と旗のコードを持ち、クラブの `fifaCode` は null です。

### 例: 5大リーグの試合

```json
{
  "recordId": "spx:game:1849201",
  "category": "game-on-day",
  "eventDate": "2023-06-03",
  "datePrecision": "day",
  "sport": "ice_hockey",
  "competition": "nhl",
  "league": "nhl",
  "seasonStartYear": 2022,
  "gameId": 1849201,
  "venueId": 88,
  "homeScore": 9,
  "awayScore": 1,
  "home": {
    "name": "Florida Panthers",
    "franchiseId": 33,
    "teamSeasonId": 2104,
    "soccerTeamId": null,
    "countryCode": "US",
    "fifaCode": null,
    "flagCode": "US"
  },
  "away": {
    "name": "Vegas Golden Knights",
    "franchiseId": 54,
    "teamSeasonId": 2125,
    "soccerTeamId": null,
    "countryCode": "US",
    "fifaCode": null,
    "flagCode": "US"
  },
  "source": {
    "sourceId": "wikipedia",
    "licence": "CC BY-SA 4.0",
    "attribution": "Wikipedia contributors",
    "url": null
  }
}
```

決勝は同じチームオブジェクトで、`category` が `championship-final` です。サッカーはその日の試合が `soccer-on-day` と `soccerMatchId` です。

### 例: サッカー代表

```json
{
  "recordId": "spx:soccer-match:904",
  "category": "soccer-on-day",
  "eventDate": "2022-12-18",
  "datePrecision": "day",
  "sport": "soccer",
  "competition": "wc2022",
  "league": "wc",
  "soccerMatchId": 904,
  "home": {
    "name": "Argentina",
    "franchiseId": null,
    "teamSeasonId": null,
    "soccerTeamId": "T-1",
    "countryCode": "AR",
    "fifaCode": "ARG",
    "flagCode": "AR"
  },
  "away": {
    "name": "France",
    "franchiseId": null,
    "teamSeasonId": null,
    "soccerTeamId": "T-9",
    "countryCode": "FR",
    "fifaCode": "FRA",
    "flagCode": "FR"
  }
}
```

`flagCode` は旗の描画に使い、`fifaCode` は FIFA の3文字です。一致するとは限りません。

## 人物

誕生日、死去、指名、賞は `PersonRef` を持ちます。

| 欄 | 型 | 意味 |
| --- | --- | --- |
| `personId` | 数値または null | 人物 ID |
| `qid` | 文字列または null | Wikidata の項目 |
| `name` | 文字列 | 表示用の名前 |
| `leagueCodes` | 文字列の配列 | 所属・指名・受賞のリーグ |
| `franchiseIds` | 数値の配列 | ロスターや指名先、受賞チーム |
| `teamSeasonIds` | 数値の配列 | 対応するシーズンのチーム |

チーム ID はロスター、指名、受賞の行から取り、名前では結びません。

### 例: 誕生日

```json
{
  "recordId": "spx:player-birthday:wikidata:Q0:1963-08-09",
  "category": "player-birthday",
  "eventDate": "1963-08-09",
  "datePrecision": "day",
  "sport": null,
  "competition": null,
  "league": "nhl",
  "person": {
    "personId": 0,
    "qid": "Q0",
    "name": "Example Player",
    "leagueCodes": ["nhl"],
    "franchiseIds": [10],
    "teamSeasonIds": [880]
  },
  "source": {
    "sourceId": "wikidata",
    "licence": "CC0 1.0",
    "attribution": "Wikidata contributors",
    "url": "https://www.wikidata.org/wiki/Q0"
  }
}
```

上の数値は形の説明です。その人物への主張ではありません。

指名は年精度（`eventDate` は null、`draftYear` あり）です。賞は年精度で、そのシーズンの決勝日がただ1日の選手権だけ日精度になります。

## 型

```ts
import { EXTRACT_CATEGORIES, type OnThisDayRecord, type TeamRef, type PersonRef } from "@johnmorrisdotca/meigen-sports";
```

`OnThisDayRecord` は `MeigenRecord` の隣にあります。同梱データは当面 `MeigenRecord` です。新しい試合 JSON が来たら、時計を読まずにこの型へ写します。
