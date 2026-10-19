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
| [Sentence templates](templates.md) | [文の型](templates.ja.md) | Fifteen kinds of statement, three or more patterns each; fragments live in phrases.ts; runs never repeat a neighbour; the Python caption copy is a known gap | Written 2026-10-19; Japanese not yet checked by a person |
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
| `draft-selected` | `{draftYear}年の{league}ドラフトで、{name}が指名された…。` | In the {draftYear} {league} draft, {name} was selected. |
| `draft-club-took` | `{clubName}は{draftYear}年の{league}ドラフトで{name}を{pick}で指名した。` | {clubName} selected {name} {pick} in the {draftYear} {league} draft. |
| `venue-in-year` | `{year}年、{venueName}（{city}）が開場した…。` | In {year}, {venueName} ({city}) opened. |
| `venue-first-opened` | `{venueName}は{year}年に開場（{city}）…。` | {venueName} opened in {year} ({city}). |
| `franchise-year-first` | `{year}年、{clubName}の{leagueIdentity}名義が始まった（…）。` | In {year}, the {clubName} {league} identity began. |
| `franchise-identity-began` | `{clubName}（{leagueIdentity}）は{year}年にこの名義で始まった（…）。` | {clubName} ({league}) began under this identity in {year}. |
| `first-year-first` | `{year}年: {name}、{highlight}。` | {year}: {name}, {highlight}. |
| `first-parenthesis` | `{name}: {highlight}（{year}年のこの日）。` | {name}: {highlight} (on this day in {year}). |
| `wcm-beat` | `{winner}が{year}年のワールドカップで{loser}に{result}で勝った（…）。` | {winner} beat {loser} {result} at the {year} World Cup. |
| `wcm-in-the` | `{year}年のワールドカップ: {winner}が{loser}を{result}で破った（…）。` | {year} World Cup: {winner} defeated {loser} {result}. |
| `wcm-lost` | `{loser}は{year}年のワールドカップで{winner}に{result}で敗れた（…）。` | {loser} lost to {winner} {result} at the {year} World Cup. |
| `wcm-draw` | `{team1}と{team2}は{year}年のワールドカップで{score1}対{score2}で引き分けた（…）。` | {team1} and {team2} drew {score} at the {year} World Cup. |
| `wcm-played-to` | `{year}年のワールドカップ: {team1}と{team2}は{score1}対{score2}の引き分けに終わった（…）。` | {year} World Cup: {team1} and {team2} ended in a {score} draw. |
| `wcm-level` | `{team1}と{team2}の一戦は{score1}対{score2}で決着がつかなかった（{year}年のワールドカップ）（…）。` | The match between {team1} and {team2} was undecided at {score} ({year} World Cup). |
| `wcf-won` | `{winner}が{year}年のワールドカップで{loser}に{result}で勝って優勝した。` | {winner} won the {year} World Cup by beating {loser} {result}. |
| `wcf-to-win` | `{year}年のワールドカップ決勝で、{winner}が{loser}に{result}で勝った。` | In the {year} World Cup final, {winner} beat {loser} {result}. |
| `wcf-went-to` | `{year}年のワールドカップの優勝は{winner}。決勝で{loser}に{result}で勝った。` | The {year} World Cup champion is {winner}; in the final it beat {loser} {result}. |
| `start-opened` | `{year}年の{name}が開幕した。` | The {year} {name} opened. |
| `start-curtain` | `{name}（{year}年）が幕を開けた。` | {name} ({year}) raised its curtain. |
| `end-closed` | `{year}年の{name}が閉幕した。` | The {year} {name} closed. |
| `end-curtain` | `{name}（{year}年）が幕を閉じた。` | {name} ({year}) lowered its curtain. |
| `event-on-this-day` | `{label}が、この日に行われた。` | {label} took place on this day. |
| `event-lead-in` | `今日: {label}の開催日。` | Today: the day of {label}. |

Fragments (`phrases.ts`) in Japanese: `（延長）` (extra time), `（PK戦）` (penalty shoot-out), `（PK戦、{score}の引き分け後）` (penalties, after a {score} draw), `（延長の後、PK戦）` (penalties after extra time), `第{n}戦` (game {n}), `{n}歳で` (at age {n}), `全体{n}位` (No. {n} overall).

