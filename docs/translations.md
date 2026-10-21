# Translation and back-translation review

This table records English source copy and the meaning checked in the Japanese version. Code identifiers, proper names, URLs and source titles remain in their original form. Machine or editorial translation does not change source facts or rights.

| English page | Japanese page | Back-translation checked | Review note |
| --- | --- | --- | --- |
| [Data pipeline](data-pipeline.md) | [データパイプライン](data-pipeline.ja.md) | 30 quotations and 1052 dated history rows cover 142 of 366 days; the separate fact feeds hold 29,961 facts for all 366 days, with 224 uncollected; DS1 archive → existing Turso curation → reviewed static files | Quote count 41→30 after per-quote word-rights review; 10 same-event history rows merged 2026-10-16; human review still required before public release |
| [Famous quotes](famous-quotes.md) | [有名な引用](famous-quotes.ja.md) | Wikiquote CC BY-SA covers the page compilation; quoted words stay with the speaker; each row records rightsReasoning; Kaggle unknown-licence dumps stay checklists | Eight justified Wikiquote lines remain; eleven dropped; English source text only |
| [History model](history-model.md) | [履歴モデル](history-model.ja.md) | Player milestones preserve scope and former holders; record claims need authority, conditions and evidence | Examples are explicitly not claims about seed data |
| [Record schema](record-schema.md) | [記録の形](record-schema.ja.md) | Websites consume typed team and person objects, not names parsed from captions; every row has id, date precision, category, tags, source and licence | Tags are non-exclusive; human review still required before public release |
| [History tags](categories.md) | [履歴タグ](categories.ja.md) | Forty-six identifiers are tags, not exclusive categories; one fact is stored once and may carry several | Counts are extract-on-disk until convert writes public shards; human review still required |
| [People list](people.md) | [人物リスト](people.ja.md) | 2,000 people by country and sport; keyed on Wikidata ids; tiers A (Olympic medal entries), B (20+ language editions), C (8+, thin cells only); quotas served in turn; never sex, gender, ethnicity, religion, health, family or politics | Written 2026-10-19; Japanese not yet checked by a person |
| [Sentence templates](templates.md) | [文の型](templates.ja.md) | Fifteen kinds of statement, three or more patterns each; fragments live in phrases.ts; runs never repeat a neighbour; a sentence read on another day than its fact's says the full date and never "today"; a placeholder such as "(none)" is never printed | Written 2026-10-19, dates and placeholders added 2026-10-20; Japanese not yet checked by a person |
| [Open sources](open-sources.md) | [公開データの出典](open-sources.ja.md) | What was dropped: selection by sex, para-* batches and labels, wrong sport items | Written 2026-10-19 |

The Japanese pages are paired to the English originals at the top. Review again whenever either source page changes.

## Japanese sentence patterns added in 0.4.0

Literal English renderings of the patterns the package says in Japanese. They are written for review; a person who reads Japanese has not yet checked them. `{...}` are fields.

| Pattern id | Japanese | Literal English |
| --- | --- | --- |
| `death-in-year` | `{year}年のこの日、{name}{whoClause}が{agedJa}死去した。` | On this day in {year}, {name}(...) died, {aged}. |
| `death-anniversary` | `今日は{name}{whoClause}の命日。{year}年に{agedJa}亡くなった。` | Today is the death anniversary of {name}(...). Died in {year}, aged {n}. |
| `game-won-against` | `{winner}は{loser}との試合に{winScore}対{loseScore}で勝った…` | {winner} won the game against {loser} {score}. |
| `game-lost-to` | `{loser}は{winner}に{loseScore}対{winScore}で敗れた…` | {loser} lost to {winner}, {score}. |
| `game-tie-played` | `{home}と{away}は{homeScore}対{awayScore}の引き分けに終わった…` | {home} and {away} ended in a {score} draw. |
| `game-tie-level` | `{home}と{away}の一戦は{homeScore}対{awayScore}で引き分けた…` | The match between {home} and {away} was drawn {score}. |
| `final-went-to` | `{year}年の{title}は{winner}が制し、{loser}に{winScore}対{loseScore}で勝った…` | The {year} {title} was won by {winner}, who beat {loser} {score}. |
| `award-went-to` | `{award}は{winnerName}が受賞した（…）。` | The {award} was won by {winnerName}. |
| `award-named` | `{winnerName}が{award}の受賞者に選ばれた（…）。` | {winnerName} was chosen as the {award} winner. |
| `record-of` | `{scope} {metric}の記録は{holderName}の{value}{unit}…。` | The {scope} {metric} record is {holderName}'s {value} {unit}. |
| `record-colon` | `{scope} {metric}：{holderName}（{value}{unit}）…。` | {scope} {metric}: {holderName} ({value} {unit}). |
| `draft-selected` | `{draftYear}年の{league}ドラフトで、{name}が{club}に{pick}指名された。` | In the {draftYear} {league} draft, {name} was selected by {club} at {pick}. |
| `draft-club-took` | `{clubName}は{draftYear}年の{league}ドラフトで{name}を{pick}指名した。` | {clubName} selected {name} {pick} in the {draftYear} {league} draft. |
| `venue-in-year` | `{year}年、{venueName}（{city}）が開場した…。` | In {year}, {venueName} ({city}) opened. |
| `venue-first-opened` | `{venueName}は{year}年に開場（{city}）…。` | {venueName} opened in {year} ({city}). |
| `franchise-year-first` | `{year}年、{clubName}の{leagueIdentity}名義が始まった（…）。` | In {year}, the {clubName} {league} identity began. |
| `franchise-identity-began` | `{clubName}（{leagueIdentity}）は{year}年にこの名義で始まった（…）。` | {clubName} ({league}) began under this identity in {year}. |
| `first-year-first` | `{year}年：{name}、{highlight}。` | {year}: {name}, {highlight}. |
| `first-parenthesis` | `{name}：{highlight}（{year}年のこの日）。` | {name}: {highlight} (on this day in {year}). |
| `wcm-beat` | `{winner}が{year}年のワールドカップで{loser}に{result}で勝った（…）。` | {winner} beat {loser} {result} at the {year} World Cup. |
| `wcm-in-the` | `{year}年のワールドカップ：{winner}が{loser}を{result}で破った（…）。` | {year} World Cup: {winner} defeated {loser} {result}. |
| `wcm-lost` | `{loser}は{year}年のワールドカップで{winner}に{result}で敗れた（…）。` | {loser} lost to {winner} {result} at the {year} World Cup. |
| `wcm-draw` | `{team1}と{team2}は{year}年のワールドカップで{score1}対{score2}で引き分けた（…）。` | {team1} and {team2} drew {score} at the {year} World Cup. |
| `wcm-played-to` | `{year}年のワールドカップ：{team1}と{team2}は{score1}対{score2}の引き分けに終わった（…）。` | {year} World Cup: {team1} and {team2} ended in a {score} draw. |
| `wcm-level` | `{team1}と{team2}の一戦は{score1}対{score2}で決着がつかなかった（{year}年のワールドカップ）（…）。` | The match between {team1} and {team2} was undecided at {score} ({year} World Cup). |
| `wcf-won` | `{winner}が{year}年のワールドカップで{loser}に{result}で勝って優勝した。` | {winner} won the {year} World Cup by beating {loser} {result}. |
| `wcf-to-win` | `{year}年のワールドカップ決勝で、{winner}が{loser}に{result}で勝った。` | In the {year} World Cup final, {winner} beat {loser} {result}. |
| `wcf-went-to` | `{year}年のワールドカップの優勝は{winner}。決勝で{loser}に{result}で勝った。` | The {year} World Cup champion is {winner}; in the final it beat {loser} {result}. |
| `start-opened` | `{year}年の{name}が開幕した。` | The {year} {name} opened. |
| `start-curtain` | `{name}（{year}年）が幕を開けた。` | {name} ({year}) raised its curtain. |
| `end-closed` | `{year}年の{name}が閉幕した。` | The {year} {name} closed. |
| `end-curtain` | `{name}（{year}年）が幕を閉じた。` | {name} ({year}) lowered its curtain. |
| `event-on-this-day` | `{label}は、この日に行われた。` | {label} took place on this day. |
| `event-lead-in` | `今日は{label}が行われた日。` | Today is the day {label} took place. |

Fragments (`phrases.ts`) in Japanese: `（延長）` (extra time), `（PK戦）` (penalty shoot-out), `（PK戦、{score}の引き分け後）` (penalties, after a {score} draw), `（延長の後、PK戦）` (penalties after extra time), `（第{n}戦）` (game {n}), `{n}歳で` (at age {n}), `全体{n}位` (No. {n} overall).

## Japanese sentence patterns and fragments added in 0.6.7

For a fact read on a day that is not its own. `{date}` is the full date at its precision (`1945年7月4日`, `1945年7月`, `1945年`); `{dateOn}` is the same with に (on its own day, only the year: `1945年に`); `{leadIn}` and `{dateLead}` are the date followed by a comma (`1945年7月4日、`; `{dateLead}` is empty on the fact's own day). Not yet checked by a person who reads Japanese.

| Pattern id | Japanese | Literal English |
| --- | --- | --- |
| `birthday-in-year` | `{name}{whoClause}は{dateOn}生まれた{diedParenJa}。` | {name}(...) was born on {date} (died {year}). |
| `birthday-lead` | `{leadIn}{name}{whoClause}が生まれた。` | On {date}, {name}(...) was born. |
| `birthday-place-dated` | `{leadIn}{name}は{birthPlace}で生まれた。` | On {date}, {name} was born in {place}. |
| `birthday-deceased-dated` | `{name}{whoClause}は{dateOn}生まれた（{deathYear}年死去）。` | {name}(...) was born on {date} (died {year}). |
| `death-dated` | `{name}{whoClause}が{dateOn}{agedJa}死去した。` | {name}(...) died on {date}, aged {n}. |
| `death-lead` | `{leadIn}{name}{whoClause}が{agedJa}死去した。` | On {date}, {name}(...) died, aged {n}. |
| `first-dated` | `{leadIn}{name}：{highlight}。` | On {date}, {name}: {highlight}. |
| `first-dated-paren` | `{name}：{highlight}（{date}）。` | {name}: {highlight} ({date}). |
| `event-took-place-dated` | `{label}は{dateOn}行われた。` | {label} took place on {date}. |

The other Japanese patterns (a game, a final, an award, a record, a World Cup match, a competition's start or end, an event) now open with `{dateLead}`, for example `1945年7月4日、Pittsburgh PiratesがNew York Giantsに16対4で勝利した（MLB）。` (On July 4, 1945, Pittsburgh Pirates beat New York Giants 16–4 (MLB).), and a venue or franchise pattern says `{dateOn}` where it said the year (`League Parkが1884年5月1日に開場した…`: League Park opened on May 1, 1884). New fragments in `phrases.ts`: `{0}に` (on or in {0}), `{0}ごろに` (around {0}), `{0}、` (a date as a lead), `{0}ごろ、` (around {0}, as a lead).

## Japanese added in 0.7.0

Literal English renderings of the Japanese added with the births and deaths of sports people. Written for review; a person who reads Japanese has not yet checked them.

| Where | Japanese | Literal English |
| --- | --- | --- |
| Demo, heading of the day's people | この日の人物（競技をまたいで） | The day's people (across sports) |
| Demo, its text | 選んだ日に生まれた、または亡くなったスポーツ選手などを、最大40人、同じ競技は3人まで表示します。出典は Wikidata（CC0）です。上で競技を選ぶと、その競技の人物だけを表示します。 | Shows people of sport who were born or died on the chosen day, at most 40, at most three of one sport. The source is Wikidata (CC0). Choosing a sport above shows only that sport's people. |
| Record schema, a birth or death's fields | 誕生日と死去には、出典に値があるときだけ次の欄が付きます。 | A birth or death carries the following fields only when the source holds a value. |
| `epithet` | その人が何者かを表す短い句（例: `Brazilian footballer`）。クラブ・ポジション・`highlight` がない記録で使います。栄誉ではなく、重要度には加わりません。 | A short phrase that says who the person is. Used in a record with no club, position or `highlight`. It is not an honour and adds nothing to significance. |
| `highlight` | 経歴上の栄誉（例: `Hockey Hall of Famer`）。 | A career honour. |
| `sitelinks` | Wikidata が数える、その人のウィキペディア（と姉妹プロジェクト）のページ数。一覧の並びはこの知名度で決まります。 | The number of Wikipedia (and sister-project) pages Wikidata counts for the person. The lists are ordered by this fame. |
| `nationality` | 代表した国、または国籍のある国の ISO 3166-1 alpha-2 コード。 | The ISO 3166-1 alpha-2 code of the country he represented or holds citizenship of. |
| Record schema, the dump's records | Wikidata のダンプから加えた誕生日と死去の記録 ID は `wikidata:<category>:<Q id>:<date>` です。出典は `wikidata`（CC0 1.0）で、性別、民族、宗教、政治、家族、健康に関する情報は一切持ちません。 | The record id of a birth or death added from the Wikidata dump is `wikidata:<category>:<Q id>:<date>`. The source is `wikidata` (CC0 1.0), and it holds no information on sex, gender, ethnicity, religion, politics, family or health. |

## Japanese added in 0.8.0

Literal English renderings of the Japanese added with the events and competition editions of every sport. Written for review; a person who reads Japanese has not yet checked them. `{...}` are fields: `{eventLabel}` the event's name, `{placeIn}` the place in parentheses, `{wonBy}` "The winner is X."

| Where | Japanese | Literal English |
| --- | --- | --- |
| `start-event` | `{dateLead}{eventLabel}{placeIn}が始まった。` | {date} {event} began (place). |
| `start-event-opened` | `{dateLead}{eventLabel}{placeIn}が開幕した。` | {date} {event} opened (place). |
| `start-event-curtain` | `{dateLead}{eventLabel}{placeIn}が幕を開けた。` | {date} the curtain rose on {event} (place). |
| `end-event` | `{dateLead}{eventLabel}{placeIn}が終わった。{wonByTitle}` | {date} {event} ended (place). The winner is X. |
| `end-event-closed` | `{dateLead}{eventLabel}{placeIn}が閉幕した。{wonByTitle}` | {date} {event} closed (place). The winner is X. |
| `end-event-curtain` | `{dateLead}{eventLabel}{placeIn}が幕を閉じた。{wonByTitle}` | {date} the curtain fell on {event} (place). The winner is X. |
| `event-held` | `{dateLead}{eventLabel}{placeIn}が行われた。{wonBy}` | {date} {event} took place (place). The winner is X. |
| `event-was-held` | `{dateLead}{eventLabel}{placeIn}が開催された。{wonBy}` | {date} {event} was held (place). The winner is X. |
| `event-was-staged` | `{dateLead}{eventLabel}{placeIn}が催された。{wonBy}` | {date} {event} was staged (place). The winner is X. |
| fragment `wonBy` | 勝者は{0}。 | The winner is {0}. |
| fragment `wonByTitle` (end of a competition) | 優勝は{0}。 | The champion is {0}. |
| Demo, heading of the day's events | この日の大会・試合（競技をまたいで） | The day's competitions and matches (across sports) |
| Demo, its text | 選んだ日に始まった、または終わった大会と、その日に行われた試合・大会を、最大40件、同じ競技は3件まで表示します。出典は Wikidata（CC0）で、開催地と勝者は Wikidata に記載があるときだけ示します。上で競技を選ぶと、その競技のものだけを表示します。 | Shows competitions that began or ended on the chosen day, and matches and competitions held on it, at most 40, at most three of one sport. The source is Wikidata (CC0); the place and the winner are shown only when Wikidata states them. Choosing a sport above shows only that sport's. |
| Record schema, events | 大会や試合（`category` が `competition-start`、`competition-end`、`sport-event`）には、`eventLabel`（Wikidata の名称）、`eventPlace`（項目に開催地があるときの開催地）、`winnerName`（項目に勝者があるときの勝者。代表チームは国名）が付き、並びは `sitelinks` で決まります。文は、始まった・終わった・行われたと言い、開催地、勝者の順に添えます。 | An event or match (`category` ...) carries `eventLabel` (Wikidata's name), `eventPlace` (the place, when the item has one), `winnerName` (the winner, when the item has one; a national team by its country), and is ordered by `sitelinks`. The sentence says began, ended or took place, then adds the place, then the winner. |

## Japanese revised in 0.8.1

Written after a Japanese review (the reviewer is not a native speaker; a person who reads Japanese has not yet checked these). Literal English renderings.

| Where | Japanese | Literal English |
| --- | --- | --- |
| Context in parentheses on a fact's own day | `（NHL、1990年）` (was `（NHL、1990）`) | (NHL, 1990) |
| `stage` fragment | `（プレーオフ）`, `（準々決勝）`, `（準決勝）`, `（決勝）`, `（グループステージ）`, `（カンファレンス決勝）`, `（エキシビション）`, `（2次リーグ）` (was `、playoffs`) | (playoffs), (quarter-final), (semi-final), (final), (group stage), (conference final), (exhibition), (second group stage) |
| `gameNumber` fragment | `（第{n}戦）` (was `第{n}戦` after the verb) | (game {n}) |
| World Cup round | `（第7節）`, `（ラウンド16）`, `（準々決勝）`, `（準決勝）`, `（1回戦）`, `（3位決定戦）` (was the English round name) | (matchday 7), (round of 16), (quarter-final), (semi-final), (first round), (third-place match) |
| `birthday-years-ago` | `{name}{whoClause}は{yearsAgo}年前の今日、生まれた。` | {name}(...) was born {n} years ago today. |
| `birthday-years-ago-highlight` | `{yearsAgo}年前の今日：{name}（{highlight}）が生まれた。` | {n} years ago today: {name} ({highlight}) was born. |
| `franchise-began` | `{leagueIdentity}の{clubName}は、{dateOn}発足した{cityIn}。` (was `{clubName}のこの{leagueIdentity}名義が…始まる`; 名義 means the name on a registration) | {league} club {club} was founded {date}. |
| `draft-picked`, `draft-selected` | `{draftYear}年の{league}ドラフトで、{name}が{clubBy}{pick}指名された。` (`Edmonton Oilersに全体1位で`; `clubBy` is `{club}に`, `overallPick` is `全体{n}位で`) | In the {year} {league} draft, {name} was selected by {club} at No. {n} overall. |
| `draft-club-took` | `…{name}を{pick}指名した。` | {club} selected {name} at No. {n} overall. |
| Colon in a sentence | full-width `：` everywhere | |
| Demo, `todayFew` | この日の事実は3件未満です。 | There are fewer than 3 facts for this day. |
| Demo, end of `sourceNote` | 権利を確認しないまま使ったりしません。 | nor use them without checking the rights. |
| Demo, end of `favIntro` | 各事実は1度だけ保存されます。 | Each fact is stored only once. |
| Demo, label `todayDots` | この日の出来事 (was この日の事実) | The day's events (a label; the body copy keeps 事実) |

## Japanese revised in 0.9.0

Written after a Japanese review (the reviewer is not a native speaker; a person who reads Japanese has not yet checked these). Literal English renderings.

| Where | Japanese | Literal English |
| --- | --- | --- |
| `birthday-years-ago` (the year is said too) | `{name}{whoClause}は{yearsAgo}年前の今日、{year}年に生まれた。` | {name}(...) was born {n} years ago today, in {year}. |
| `birthday-of` | `今日は{name}{whoClause}の誕生日（{year}年生まれ）。` | Today is {name}'s birthday (born {year}). |
| `birthday-years-ago-highlight` (the colon is a comma) | `{yearsAgo}年前の今日（{year}年）、{name}（{highlight}）が生まれた。` | {n} years ago today ({year}), {name} ({highlight}) was born. |
| `birthday-turns` (living people only) | `{name}は今日{yearsAgo}歳になる（{year}年生まれ）。` | {name} turns {n} today (born {year}). |
| `event-on-this-day` | `{label}は{year}年のこの日に行われた。` | {label} was held on this day in {year}. |
| `event-lead-in` | `今日は{label}が行われた日（{year}年）。` | Today is the day {label} was held ({year}). |
| An event whose name holds no year, on its own day | `1995年、Channel One Russia（Moscow）が始まった。` (the place follows the name, not the verb) | In 1995, Channel One Russia (Moscow) began. |
| A Games named for a year other than the one it was held in | `2021年、2020年大会のSummer Olympicsが始まった。` | In 2021, the 2020 edition of the Summer Olympics began. |
| A person with a club and no position | `Gregg Popovich（San Antonio Spurs）は…` | Gregg Popovich (San Antonio Spurs) ... |
| Baseball's playoffs | `（ポストシーズン）` (hockey and basketball keep `（プレーオフ）`) | (postseason) |
| Demo, filters | 指定なし, 国, 年代, 賞・トロフィー, 栄誉, チーム, 人物 | Any, Country, Decade, Award or trophy, Honour, Club, Person |
| Demo, `favOnlyDay` | 上で選んだ日の出来事だけ | Only the day chosen above |
| Demo, placeholders | チーム名を入力, 姓または名（英字）を入力 | Type a club's name, Type a first or last name (Latin letters) |
| Demo, `favShown` | {n}件中{m}件を表示 | Showing {m} of {n} |
| Demo, honours | 受賞者, 優勝経験者, 殿堂入り | Award winner, Champion (has won the title), Hall of Famer |
| Demo, links | ウィキペディア, ウィキペディア（英語版） where only the English article exists, ウィキデータ | Wikipedia, Wikipedia (English edition), Wikidata |
| Demo, `favIntro` | 競技、リーグ、履歴タグ、国、年代、賞、栄誉、年のほか、名前で選んだチームや人物、上で選んだ日を組み合わせて絞り込めます。表示されるのは、すべての条件に合う事実だけです。選んだ条件はURLに残るので、この画面をそのまま共有できます。 | You can narrow down by combining sport, league, history tag, country, decade, award, honour and year, plus a club or person chosen by name and the day chosen above. Only facts that match every condition are shown. The chosen conditions stay in the URL, so the screen can be shared as it is. |

The reviewer would join the stage and the league in one pair of parentheses (`（MLBポストシーズン）` for `（ポストシーズン）（MLB）`); that is left as it is, for a person who reads Japanese to decide.

## Japanese added in 0.10.0

Not yet checked by a person who reads Japanese. Literal English renderings.

| Where | Japanese | Literal English |
| --- | --- | --- |
| Demo, the two switches on the card | 国旗, トロフィー | Flags, Trophies |
| Demo, the flag's `alt` | the name of the country in Japanese from Hata (`カナダ`, `アメリカ合衆国`) | Canada, United States |

