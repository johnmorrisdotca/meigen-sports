<h1 align="center">Meigen Sports <sub>名言</sub></h1>

<p align="center"><strong>Source-verified sports quotations and dated events in sports history.</strong><br>
A typed data package with no runtime dependencies. Read the included data offline, filter it by date, sport or source, or load versioned static JSON feeds. MIT code; source data keeps its own rights.</p>

<p align="center">
  <a href="https://github.com/johnmorrisdotca/meigen-sports/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/johnmorrisdotca/meigen-sports/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/@johnmorrisdotca/meigen-sports"><img alt="npm" src="https://img.shields.io/npm/v/@johnmorrisdotca/meigen-sports?color=2f5d4a"></a>
  <a href="./LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-2f5d4a"></a>
  <a href="./NOTICE.md"><img alt="Data keeps its own licences" src="https://img.shields.io/badge/data-source%20licences-2f5d4a"></a>
  <img alt="No dependencies" src="https://img.shields.io/badge/dependencies-0-2f5d4a">
  <img alt="TypeScript" src="https://img.shields.io/badge/types-TypeScript-3178c6">
</p>

<p align="center"><a href="https://johnmorrisdotca.github.io/meigen-sports/"><strong>Open the demo →</strong></a> · <a href="./NOTICE.md">Sources</a> · <a href="./docs/record-schema.md">Record schema</a> · <a href="./docs/templates.md">Templates</a> · <a href="./docs/categories.md">History tags</a> · <a href="./docs/history-model.md">History model</a> · <a href="./docs/data-pipeline.md">Pipeline</a></p>

<p align="center">
<img alt="The Meigen Sports demo on a desk: a date, a sport, a quotation and on-this-day facts." src="docs/images/hero-desktop.png" width="720">
</p>

<table align="center">
<tr>
<td align="center" valign="top">
<img alt="The demo on a phone, in English." src="docs/images/hero-phone.png" width="190"><br><em>On a phone</em>
</td>
<td align="center" valign="top">
<img alt="The demo on a phone, in Japanese." src="docs/images/hero-phone-ja.png" width="190"><br><em>In Japanese</em>
</td>
</tr>
</table>

## In 30 seconds

Install the package and read the versioned data bundled with it:

```sh
npm install @johnmorrisdotca/meigen-sports
```

```js
import { historyOnDate, quoteForDate } from "@johnmorrisdotca/meigen-sports";
import history from "@johnmorrisdotca/meigen-sports/history";
import quotes from "@johnmorrisdotca/meigen-sports/quotes";

historyOnDate(history, "2022-11-20", { sports: ["soccer"] }).length; // 1
quoteForDate(quotes, "2026-10-14")?.speaker; // "James Dwight"
```

## What is bundled and what loads from Pages

One build ships both places. The package and the GitHub Pages site are made from the same facts, and `node scripts/check-build.ts` fails a release when they are not the same build (it compares the package version, the data folder and a SHA-256 of the facts manifest).

| | In the npm package, works offline | On GitHub Pages, needs a network |
| --- | --- | --- |
| On-this-day facts | **1,472 facts**: the best three to five for each of the 366 calendar days, chosen by significance and fame and varied by kind, sport, person and club (`@johnmorrisdotca/meigen-sports/offline`) | **29,594 facts** on all 366 days, in static JSON under `data/v1/0.1.0/facts/` (days, teams, players, leagues, sports, tags, 100 `store/` files that together hold every fact), read through the `load*` functions |
| Quotations | 30 (22 Gutenberg excerpts, 8 Wikiquote sports lines tagged `famous-quotes`) | the same 30 in `quotes.json` |
| History starter | 1,052 dated rows on 142 days (`@johnmorrisdotca/meigen-sports/history`; World Cup matches and Wikidata events), kept for compatibility | `all.json`, `days/`, `sports/`, `entities/` |

`today(offline, timeZone, nowIso)` always answers from the package. **The rest of the facts are not in the package: Pages must be reachable for them** (the package is about 0.9 MB packed; the full facts are about 55 MB). A site should load the feeds and fall back to the offline set when they cannot be reached, and say that it did; the demo does exactly that. `data/v1/latest.json` names the current build (`package`, `build`, `offlineRecords`, `factRecords`) and its manifests, so a site can check that the feeds it reads are the build its package was made with.

This is a sourced collection with coverage gaps, not a complete daily almanac. `test/golden/golden-facts.json` lists 246 famous, source-checked facts the data must hold (and those it is known not to hold yet), with rules for what must never appear; see [docs/golden-facts.md](./docs/golden-facts.md). Quotes have unknown utterance dates and are never assigned invented anniversaries.

## Who it is for

Use Meigen Sports in a site, app or research tool that needs cited historical sports text and dated sports events, with predictable selectors and no runtime database dependency. The API exposes original source links, rights information, stable entity IDs and date roles alongside each record.

## Features

- Source-verified quotations from three historical books and English Wikiquote sports pages, and dated sporting facts from Wikidata and openfootball.
- Deterministic quotation selection and explicit-date history filters; the library does not read the clock or choose randomly.
- Sport, entity, source, kind, type, language and text filters.
- Versioned static JSON shards for calendar days, sports and stable entities, validated by an explicit loader.
- Source rights and provenance travel with each row. The package's MIT code licence does not relicense its data. Source lifecycle and usage notes ship in `data-sources/sources.json` and `data-sources/README.md`.
- Initial coverage includes all 964 matches from 22 FIFA World Cup editions (1930–2022), plus 88 published Wikidata event facts (10 World Cup start/end rows merged into the same-day match). The included sample does not contain collected player milestones or world records.

## Use it in your project

```js
import { historyOnDate, selectRecords } from "@johnmorrisdotca/meigen-sports";
import history from "@johnmorrisdotca/meigen-sports/history";

const soccerHistory = historyOnDate(history, "11-20", { sports: ["soccer"] });
const openfootballOnly = selectRecords(soccerHistory, { includeSources: ["openfootball"] });
```

`date` accepts an exact `YYYY-MM-DD` or a calendar `MM-DD`. An exact date also excludes later records. Empty results are possible and expected where the current dataset has no coverage.

To load a public static shard, supply its base URL, data version and fetch function. The path is appended as `data/v1/<version>/...`; no database credentials or endpoint are involved.

```js no-run
import { loadDay } from "@johnmorrisdotca/meigen-sports/load";

const day = await loadDay("11-20", {
  baseUrl: "https://johnmorrisdotca.github.io/meigen-sports/",
  dataVersion: "0.1.0",
  fetch: globalThis.fetch,
});
day.records.length; // 2
```

This network example is not executed by the README check; it requires the static feed URL to be published.

Static feed publication and release storage setup are still being completed. The repository contains generated JSON and a loader, but this README does not promise that the Pages URL is live or that the source archive and curation workflow has been approved and completed.

## Examples

The snippets under **In 30 seconds** and **Use it in your project** are run by `pnpm test:readme` against the built package. A network load of the public feed is marked `no-run` until Pages is serving that version.

## API

The root export provides `isDate`, `monthDayOf`, `selectRecords`, `historyOnDate`, `quoteForDate`, `EXTRACT_CATEGORIES`, `FACT_CATEGORIES`, on-this-day helpers (`factsFor`, `today`, `calendarDayInZone`, `rankFeed`, `randomFacts`, `tagsOf`, `uniqueRecordIds`, `withCaptions`, `captionFromFact`, `isRichFact`), caption templates (`render`, `renderHistory`, `renderRun`, `templatesFor`, `TEMPLATES`, `TEMPLATE_TYPES`; `renderRun` words a list so that neighbours never repeat), same-event merge (`mergeHistoryEvents`, `finalCaptionFromMatch`, `uniqueHistoryIds`), the core record and feed types, on-this-day consume types (`OnThisDayRecord`, `TeamRef`, `PersonRef`), and `SCHEMA_VERSION` and `VERSION`.

| Import | Contents |
| --- | --- |
| `@johnmorrisdotca/meigen-sports` | Date helpers, deterministic selectors and public types |
| `@johnmorrisdotca/meigen-sports/quotes` | Bundled quotation records |
| `@johnmorrisdotca/meigen-sports/history` | Bundled dated history records (the starter) |
| `@johnmorrisdotca/meigen-sports/offline` | `offline`, the best three to five facts for every calendar day, and `OFFLINE_BUILD`, the build they were chosen from |
| `@johnmorrisdotca/meigen-sports/load` | `loadShard`, `loadDay`, `loadSport`, `loadEntity` and loader types |
| `@johnmorrisdotca/meigen-sports/categories` | `HISTORY_TYPES` and its evidence/readiness descriptions |

Each `MeigenRecord` has a `kind` (`quote` or `history`), exact text, source citation, rights status, sport and type tags, entity references, and date fields. A quotation's `date` and `monthDay` are null when its utterance date is not established. Entity labels are not identity keys; use stable `id` values.

`OnThisDayRecord` is the website consume shape for DS1 extracts: games carry `home` / `away` `TeamRef` objects (franchise, team-season, FIFA and ISO/Hata flag codes), people carry `PersonRef` (SPXN person id, Wikidata QID, leagues, team ids), and every row has `recordId`, date precision, extract `category`, non-exclusive `tags`, sport, competition, source, licence and attribution. The bundled seed still uses `MeigenRecord`. See [docs/record-schema.md](./docs/record-schema.md).

`HISTORY_TYPES` lists forty-six **non-exclusive tags** (not exclusive categories). One fact is stored once and may carry several tags. Catalogue: [docs/categories.md](./docs/categories.md). Readiness labels describe implementation capability, not verified live data counts. The richer player and record progression design in [docs/history-model.md](./docs/history-model.md) is planned and is not part of the current `MeigenRecord` API. `EXTRACT_CATEGORIES` is the extract family that produced the row.

## Limits

The current feed is sparse: 224 calendar month-days have no history facts. Source coverage and eligible dates are recorded in [data-sources/coverage.json](./data-sources/coverage.json). The collection contains historical book excerpts, Wikiquote sports quotations (CC BY-SA 4.0), 88 published Wikidata event facts and 964 openfootball World Cup match results. It makes no comprehensive player, franchise or world-record claims.

The current API uses exact dates and captions, stable entity references, tags and one primary citation per record. It does not yet expose the planned multi-source record progression, all source evidence, or automatic population from the existing sports database. A year or month alone is not converted into a day. A season total is not treated as evidence for the game where a milestone was reached.

## Theming

The library ships no colours, drawings or CSS. The demo follows the family's cloth switch (`demo/family.css`).

## Accessibility

Quotations are in a `blockquote`. Each record's source is a real link with its licence. The demo's header language switch and help switch are the family's. Nothing in the library moves or plays a sound.

## Browser and runtime support

Any current browser, and Node 22 or later. The package is plain data and functions, so it also runs in Deno, Bun, a worker and an edge function. Static loading accepts a caller-provided `fetch`, so the application controls network policy and caching. CI tests Node 22 and 24 on Linux, macOS and Windows, and the demo in Chromium and WebKit at a phone's width and a desk's.


## Languages

The package data and source quotations are in English. The demo and data/history documentation are available in English and Japanese; the public library labels and historical text remain in their source language.

## Roadmap

- Complete raw archive backup, review and curated static-feed publication.
- Expand history coverage from evidence-backed sources and validated database extracts.
- Finish review of the demo, then complete package, README and browser checks.
- Add a versioned schema before publishing richer player or record-progression fields.

## Architecture

The package separates TypeScript code, bundled JSON and source material. Raw source bytes are stored in the permanent DS1 archive; the 99 retrievals and 95 unique archive hashes have been verified against stored bytes, and local Dropbox backup copies have been verified. Turso curation and public release remain pending, and remote Dropbox sync is unconfirmed. Public readers use versioned static JSON. See [docs/history-model.md](./docs/history-model.md), [data-sources/README.md](./data-sources/README.md) and [pipeline/README.md](./pipeline/README.md).

## The name

*Meigen* (名言, めいげん) means a saying or quotation. Meigen Sports pairs historical sports quotations with dated events in sports history.

## Where it comes from

The initial quotations are excerpts from James Dwight's *Lawn-tennis* (1886), Walter Camp's *American Football* (1891) and Pindar's odes in Ernest Myers's 1904 edition, plus 8 sports quotations from English Wikiquote at pinned revisions (page compilation CC BY-SA 4.0; quoted words justified per row; see [docs/famous-quotes.md](./docs/famous-quotes.md)). The dated facts come from exact-day Wikidata statements and all 964 results in openfootball's 22 World Cup edition files (1930–2022). Full source-specific terms, credits and original notices are in [NOTICE.md](./NOTICE.md) and [LICENSES/](./LICENSES/).

## The family

<!-- family:start (made by scripts/family-readme.mjs from scripts/family-template.mjs; change those, not this) -->
Meigen Sports is one of twenty-nine packages, each made for the same site, each at
[github.com/johnmorrisdotca](https://github.com/johnmorrisdotca). The code of every one is MIT.

- [Korokoro](https://github.com/johnmorrisdotca/korokoro) (コロコロ): dice, with notation, exact odds, real sounds and the dice of many games. [Demo](https://johnmorrisdotca.github.io/korokoro/).
- [Kyuubu](https://github.com/johnmorrisdotca/kyuubu) (キューブ): a turning cube for the browser, 2×2 to 7×7, with record solves to replay. [Demo](https://johnmorrisdotca.github.io/kyuubu/).
- [Hitotsu](https://github.com/johnmorrisdotca/hitotsu) (一つ): a colour-card shedding game for two to eight, with the house rules people play. [Demo](https://johnmorrisdotca.github.io/hitotsu/).
- [Toranpu](https://github.com/johnmorrisdotca/toranpu) (トランプ): a deck of playing cards, card games with computer players, and solitaires. [Demo](https://johnmorrisdotca.github.io/toranpu/).
- [Tane](https://github.com/johnmorrisdotca/tane) (種): seeded random numbers and daily seeds, the same in every browser and on every server. [Demo](https://johnmorrisdotca.github.io/tane/).
- [Narabe](https://github.com/johnmorrisdotca/narabe) (並べ): one rules engine for abstract board games, from gomoku and Reversi to Go and checkers. [Demo](https://johnmorrisdotca.github.io/narabe/).
- [Tenka](https://github.com/johnmorrisdotca/tenka) (天下): world conquest for two to six, on a map of the real world. [Demo](https://johnmorrisdotca.github.io/tenka/).
- [Kumimoji](https://github.com/johnmorrisdotca/kumimoji) (組み文字): a crossword tile race, in English and Japanese kana. [Demo](https://johnmorrisdotca.github.io/kumimoji/).
- [Tsunagi](https://github.com/johnmorrisdotca/tsunagi) (繋ぎ): a line-joining logic puzzle whose every level has exactly one answer. [Demo](https://johnmorrisdotca.github.io/tsunagi/).
- [Jarajara](https://github.com/johnmorrisdotca/jarajara) (ジャラジャラ): mahjong tiles drawn as SVG, stacked layouts, and the matching solitaire Awase. [Demo](https://johnmorrisdotca.github.io/jarajara/).
- [Suido](https://github.com/johnmorrisdotca/suido) (水道): a pipe puzzle: turn the pieces until the water reaches every drain. [Demo](https://johnmorrisdotca.github.io/suido/).
- [Domino](https://github.com/johnmorrisdotca/domino) (ドミノ): dominoes and Mexican Train. [Demo](https://johnmorrisdotca.github.io/domino/).
- [Kotoba](https://github.com/johnmorrisdotca/kotoba) (言葉): word lists and word-game rules in English, French, German and Japanese. [Demo](https://johnmorrisdotca.github.io/kotoba/).
- [Sugoroku](https://github.com/johnmorrisdotca/sugoroku) (双六): backgammon and its variants, with the doubling cube and match play. [Demo](https://johnmorrisdotca.github.io/sugoroku/).
- [Kazu](https://github.com/johnmorrisdotca/kazu) (数): grid number puzzles: Sudoku and its variants, Futoshiki and Skyscrapers. [Demo](https://johnmorrisdotca.github.io/kazu/).
- [Meikyuu](https://github.com/johnmorrisdotca/meikyuu) (迷宮): mazes on squares, hexagons, triangles and circles, made from a seed and drawn through with a finger or the mouse. [Demo](https://johnmorrisdotca.github.io/meikyuu/).
- [Hikidashi](https://github.com/johnmorrisdotca/hikidashi) (引き出し): a drawer of small Japanese text tools: era dates, kanji numerals, readings and sentence difficulty. [Demo](https://johnmorrisdotca.github.io/hikidashi/).
- [Chizu](https://github.com/johnmorrisdotca/chizu) (地図): maps of the world and of countries' regions, in English and Japanese, with a quiz and callouts. [Demo](https://johnmorrisdotca.github.io/chizu/).
- [Bushu](https://github.com/johnmorrisdotca/bushu) (部首): find a kanji by the parts it is made of. [Demo](https://johnmorrisdotca.github.io/bushu/).
- [Tobiishi](https://github.com/johnmorrisdotca/tobiishi) (飛び石): peg solitaire with nine boards and seeded solvable challenges. [Demo](https://johnmorrisdotca.github.io/tobiishi/).
- [Jirai](https://github.com/johnmorrisdotca/jirai) (地雷): minesweeper on shaped grids with verified no-guess boards. [Demo](https://johnmorrisdotca.github.io/jirai/).
- [Gunjin](https://github.com/johnmorrisdotca/gunjin) (軍人): five hidden-rank strategy games with pass-the-device play. [Demo](https://johnmorrisdotca.github.io/gunjin/).
- [Karakuri](https://github.com/johnmorrisdotca/karakuri) (からくり): eight hyper-casual puzzle games, some of them physics: draw a shield, pull pins, cut ropes, slide blocks, pour tubes. [Demo](https://johnmorrisdotca.github.io/karakuri/).
- [Houseki](https://github.com/johnmorrisdotca/houseki) (宝石): gem and stone matching puzzles: falling triplets, stone collapse, colour chains and gem swap. [Demo](https://johnmorrisdotca.github.io/houseki/).
- [Kyogijo Stadiums](https://github.com/johnmorrisdotca/kyogijo-stadiums) (競技場): sports fields, rinks, courts and ballparks drawn to scale as SVG, with each team and the score on them. [Demo](https://johnmorrisdotca.github.io/kyogijo-stadiums/).
- [Taisen Brackets](https://github.com/johnmorrisdotca/taisen-brackets) (対戦): a sport-agnostic tournament bracket, drawn as SVG, from a list of ties. [Demo](https://johnmorrisdotca.github.io/taisen-brackets/).
- [Dougu Sports](https://github.com/johnmorrisdotca/dougu-sports) (道具): sports emblems as SVG: trophies, medals, crests, and the ball and gear of every sport, with optional 3D turning. [Demo](https://johnmorrisdotca.github.io/dougu-sports/).
- [Senshu Jerseys](https://github.com/johnmorrisdotca/senshu-jerseys) (選手): sports jerseys, sweaters, kits, caps, helmets and retired-number banners as SVG, front and back, with optional 2.5D turning. [Demo](https://johnmorrisdotca.github.io/senshu-jerseys/).
- [Meigen Sports](https://github.com/johnmorrisdotca/meigen-sports) (名言): sports quotations and on-this-day history. [Demo](https://johnmorrisdotca.github.io/meigen-sports/). Not on npm yet.

**This package is Meigen Sports.** The demos of all twenty-nine share one header and footer, so each links the rest.
<!-- family:end -->

## Development

```sh
pnpm install
pnpm check          # lint, types, tests, the build and the packed package
pnpm dev            # the demo on http://127.0.0.1:7400/
pnpm test:demo      # the demo in a real browser
pnpm test:readme    # the README's and the docs' examples
pnpm screenshots    # retake the README's pictures
```

This package owns local ports 7400 to 7499 (see [CONTRIBUTING.md](./CONTRIBUTING.md)).

## Contributing

Bug reports and ideas go in the [issues](https://github.com/johnmorrisdotca/meigen-sports/issues); read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## Changes

See [CHANGELOG.md](./CHANGELOG.md).

## Credits

Every source is credited in [NOTICE.md](./NOTICE.md), with original notices in [LICENSES/](./LICENSES/).

## Licence

The code is [MIT](./LICENSE). Source data keeps its own licence, named in [NOTICE.md](./NOTICE.md), with its text in [LICENSES/](./LICENSES/).
