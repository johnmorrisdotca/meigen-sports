[English](categories.md) · 日本語

# 履歴タグ

この46個の識別子（`HISTORY_TYPES`）は、排他的な分類ではなく **タグ** です。事実は1件につき1つの `recordId` に一度だけ保存します。1件の `OnThisDayRecord` に複数のタグを付けられます。優勝が決まった延長の得点なら、`championship-win` と `match-result` と `overtime-result` です。タグごとに同じ出来事を複製しません。

`famous-quotes` は引用の **収集タグ** です（`kind` は `quote`、`types` に `quotation` と `famous-quotes`）。この46個の履歴タグには入りません。[有名な引用](famous-quotes.ja.md) を見てください。

記録の `category` は抽出の種類です（`game-on-day`、`championship-final` など）。`tags` はこの履歴タグで、抽出がすでに持つ欄だけから付けます。根拠のないタグは付けません。

絞り込みは、いずれかのタグが一致すれば当たります。事実は一致する分類シャードのすべてに現れます。多様性（`randomFacts`、デモの混ぜ方）では事実を1回だけ数え、タグごとに最大2件です。

公開フィードは `nhl_api` と「Owned by SPX」を入れません。使えるライセンスは CC0、CC BY-SA 4.0、CC BY 4.0、Retrosheet です。

**件数** は、タグの根拠になり得る抽出ファイル上の行数です（2026-10-16、結合 `1f8f0d7`）。公開シャードの件数（ライセンスと文章の豊かさで減らしたあと）ではありません。`0` は、まだ抽出がないことです。ドラフトが `0` なのは、以前の SQL が時間切れになったためです。ページ先行の問い合わせは直してあり、DS1 での再実行待ちです。

## 優先するもの

| タグ | 先にする理由 | いまの DS1 | 抽出 |
| --- | --- | --- | --- |
| `championship-win` | 優勝 | 決勝 1,867 件 | `extract_finals.sql` を再実行（シリーズ、延長、会場） |
| `scoring-performance` | 決勝点の得点者 | 選手単位の得点なし | 予定。シーズンの GWG 合計は得点者ではありません |
| `player-birthday`、`age-at-event` | 誕生日と年齢 | 誕生日 20,440、死去 3,999 | 誕生日・死去の SQL を再実行 |
| `career-stat-milestone`、`sport-record` | 通算の節目。保持者の交代（Gretzky の次に Ovechkin） | 到達日のある行なし | 予定。保持者ごとに事実を残す |
| `winning-streak`、`result-streak` | 連勝と連敗 | 並んだ試合はある | 予定。欠けることのない並びが必要 |
| `combat-sport-result` | ボクシングの王者と在位 | コアにない | 予定 |
| `athletics-performance`、`sport-record` | 陸上と世界記録 | コアにない | 予定。Wikidata / CC0 |

## 46タグの状態

状態: **収録** = いまある抽出からタグを付けられる。**一部** = 欄や一部の行はあるが、再実行や根拠が足りない。**予定** = 抽出なし。創作しない。

| 識別子 | 意味 | データの出所 | 状態 | 件数 |
| --- | --- | --- | --- | --- |
| `championship-win` | クラブまたは代表が優勝した | 決勝抽出。サッカーの `stage=final` | 収録 | 決勝 1,867 |
| `historic-cup-series` | 大会と結果があるカップ・シリーズ | シリーズ欄のある決勝 | 一部 | 決勝の再実行待ち |
| `playoffs-start` | その大会のプレーオフ初戦 | 試合のフェーズ | 予定 | 0（初戦を推測しない） |
| `season-boundary` | 開幕または最終戦 | 欠けることのない日程 | 予定 | 0 |
| `series-start` | シリーズの第1戦 | `seriesGameNumber=1` | 一部 | 試合・決勝の再実行待ち |
| `series-clinch` | シリーズの決着またはスイープ | `seriesBestOf` と勝敗 | 一部 | 試合・決勝の再実行待ち |
| `match-result` | 両チームと最終得点がある試合 | 試合、決勝、サッカー | 収録 | 392,898 + 10,423 + 1,867 |
| `overtime-result` | 延長またはシュートアウトの結果 | `wentToOvertime` など | 一部 | 試合・決勝の再実行待ち |
| `shutout` | 一方が0点の確定結果 | 試合の得点 | 収録 | 得点のある試合から |
| `score-margin` | 範囲を決めた得点差 | 得点はあるが範囲は未定義 | 予定 | 0（全試合には付けない） |
| `winning-streak` | 決めた規則での連勝 | 並んだ試合 | 予定 | 0 |
| `first-recorded-game` | 収録範囲での初試合・初勝利 | 欠けることのない並び | 予定 | 0 |
| `franchise-founded` | 独立した創設日 | 初試合では足りない | 予定 | 0 |
| `franchise-folded` | 独立した消滅 | 最終試合では足りない | 予定 | 0 |
| `franchise-identity-change` | 日付のある改名・移転（1月1日ではない） | フランチャイズ抽出 | 収録 | 1,116（公開は一部） |
| `venue-history` | 開場、改名、初の行事 | 会場抽出 | 収録 | 203 |
| `player-birthday` | 確認した誕生日と人物 ID | 誕生日候補 | 収録 | 20,440 |
| `age-at-event` | 誕生日と出来事日から出した年齢 | 死去と誕生日の結合 | 一部 | 死去 3,999 |
| `player-career-boundary` | デビューまたは最後に確認した出場 | 欠けることのない出場 | 予定 | 0 |
| `player-retirement` | 日付のある引退。最終試合ではない | 取引 | 予定 | 0 |
| `draft-selection` | 年、巡、順位、クラブ、人物 | `core.draft_pick` / 収穫 | 一部 | 0（SQL は修正済み、未再実行） |
| `award-honour` | 賞の回と受賞者 | 賞の抽出 | 収録 | 5,181（日付があるのは 160） |
| `season-stat-milestone` | 入力が揃ったシーズン統計 | 選手のシーズン統計 | 予定 | 0 |
| `career-stat-milestone` | 入力が揃った通算統計 | 通算と到達日 | 予定 | 0 |
| `competition-boundary` | 大会の開始または終了 | 同梱の Wikidata | 収録 | 同梱のみ |
| `scoring-performance` | 選手単位の得点（決勝点を含む） | ボックス / 事象 | 予定 | 0 |
| `result-streak` | 連敗、未勝利、無敗 | 並んだ結果 | 予定 | 0 |
| `combat-sport-result` | 試合結果または王座の在位 | ボクシングの系譜 | 予定 | 0 |
| `athletics-performance` | 種目、ラウンド、結果、順位 | 競技会の結果 | 予定 | 0 |
| `sport-record` | 前の保持者がある記録の更新 | 権威と公認 | 予定 | 0 |
| `transfer-trade-signing` | 日付のある移籍、トレード、期限付き | 取引 | 予定 | 0 |
| `roster-selection-milestone` | 代表またはロスター選出 | ロスター | 予定 | 0 |
| `coaching-management` | 就任または退任 | 監督の記録 | 予定 | 0 |
| `rivalry-meeting` | ダービーまたは初対戦 | 対戦の履歴 | 予定 | 0 |
| `comeback-upset` | 決めた点差または番狂わせの規則 | 途中経過の得点 | 予定 | 0 |
| `qualification-promotion` | 出場権、昇格、降格 | 順位表 | 予定 | 0 |
| `ranking` | 最高位または1位の期間 | ランキング | 予定 | 0 |
| `participation-longevity` | 連続出場、最年少、最年長 | 出場の記録 | 予定 | 0 |
| `non-scoring-performance` | アシスト、セーブ、奪三振、守備 | ボックス統計 | 予定 | 0 |
| `exceptional-achievement` | 完全試合、ノーヒット、最高点 | 公式の偉業 | 予定 | 0 |
| `rules-format-change` | 日付のある規則や方式の採用 | リーグの記録 | 予定 | 0 |
| `league-federation-history` | 創設、合併、拡張 | リーグの歴史 | 予定 | 0 |
| `sporting-first` | 確認した初出場または初メダル | 根拠のある「初めて」 | 予定 | 0 |
| `ceremony-recognition` | 背番号の永久欠番、殿堂 | 式典 | 予定 | 0 |
| `attendance-audience` | 確認した観客数または視聴 | 入場 | 予定 | 0 |
| `cancelled-postponed` | 中止、延期、ロックアウト | 試合の状態 | 予定 | 0 |

引用は別の `kind` であり、この46個には入りません。

## 編集の10案との対応

順位は先に着手した3つから。待たずに始めています。

1. **試合と決勝の豊かな文**（着手済み）— `match-result`、`championship-win`、`overtime-result`。シリーズ、会場、延長は再実行待ち。
2. **お気に入り**（着手済み）— 組み合わせる絞り込み。分類はいずれかのタグ。シャードは `recordId` を共有。
3. **デモの記念日の枠**（着手済み）— 閲覧者の地域の今日、豊かな事実を3件。
4. 記録と保持者の交代 — `sport-record`、`career-stat-milestone`（予定）。
5. デビューと最終戦 — `player-career-boundary`（予定）。
6. 節目 — シーズンと通算（予定）。誕生日と年齢は一部あり。
7. 連勝連敗 — `winning-streak`、`result-streak`（予定）。
8. 逆転と番狂わせ — `comeback-upset`（予定）。
9. ライバル — `rivalry-meeting`（予定）。
10. 初めて、トレード、会場、引用、チーム/選手のフィード、ロゴ — 会場は収録。トレードと初めては予定。引用は `MeigenRecord`。チームと選手のシャードは ID を使う。

1月1日を創作しません。年だけの指名や賞は `eventDate` を空のままにします。

## 存命か死去かが分からないとき

文は焼き込まず [型](templates.ja.md) から作ります。誕生日の既定は存命でも死去でも正しいです（「YEAR年のこの日に生まれた」「今日からN年前に生まれた」）。「今日N歳になる」は出典が `livingStatus: living` のときだけ。「YEAR年死去」は出典が死去を述べるときだけ。「N歳になっていた」は使いません。死去日が無いことは不明であり、存命ではありません。

## 有名選手（すべての競技）

「有名」は根拠で並べます。Wikidata の言語版リンク数、次に賞と殿堂。推測しません。取得スクリプトはホッケー、野球、バスケットボール、アメフトとカナディアンフットボール、サッカー（男女）、テニス、ボクシング、陸上、ゴルフ、モータースポーツ、クリケット、オリンピックとパラリンピックから上位500人を残します。穴はそのままです。
