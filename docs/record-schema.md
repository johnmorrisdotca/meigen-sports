[日本語](record-schema.ja.md) · English

# Record schema for websites

This is the shape a website should consume for on-this-day facts. It is additive: bundled `MeigenRecord` rows stay captions with citations. Extractor JSON from DS1 already carries the typed objects below so conversion does not parse names out of `text`.

Identity lives on stable ids, never on a display name. The library selectors stay deterministic; they do not read the clock or shuffle rows.

The 46 identifiers in [categories.md](categories.md) are **tags, not exclusive categories**. Store each fact once. Favourites filters, category shards and variety (`randomFacts`, max two per tag) treat `tags` as a set: a fact matches a filter if any tag matches; it is copied into every matching shard; variety still counts the fact once.

## Every record

| Field | Type | Meaning |
| --- | --- | --- |
| `recordId` | string | Stable id, unique inside a dataset (`spx:game:123`) |
| `eventDate` | string or null | `YYYY-MM-DD` when `datePrecision` is `day`; otherwise null |
| `datePrecision` | `day`, `month`, or `year` | Year-only drafts and most awards leave `eventDate` null; never invent 1 January |
| `category` | `EXTRACT_CATEGORIES` | Extract family that produced the row (game, final, soccer, birthday, death, draft, award, franchise, venue, quotation). Not exclusive of `tags`. |
| `tags` | `string[]` | Non-exclusive [history-type](categories.md) ids. One `recordId` is stored once and may carry several (`championship-win` and `overtime-result` on the same championship OT goal). Empty when no history type is evidenced yet. A filter matches if **any** tag matches. |
| `basis` | `source` or `derived` | `source`: a source states the fact. `derived`: computed from statistics; then `derivedRule` and `derivedInputs` are required and published only when those inputs are complete for the scope. |
| `derivedRule` | string | How the derived value is computed. Absent on source facts. |
| `derivedInputs` | `string[]` | Named inputs to that rule. |
| `birthDate` | string or null | Stored once. Age is computed for a requested year. |
| `deathDate` | string or null | Sourced death day, when known. |
| `livingStatus` | `deceased`, `living`, or `unknown` | `unknown` is not living. `living` only when a source confirms it. |
| `birthPlace` | string or null | Sourced place of birth (Wikidata P19 label). Never inferred. |
| `text` / `textJa` | string | Default rendered sentence (`wording: "fixed"`). Fields are the source of truth; see [templates.md](templates.md). |
| `record` | object | Holder, value, scope, phase, date set, date surpassed, previous holder, recognition, and event (`set` / `held` / `equalled` / `surpassed` / `rescinded` / `title-reassigned`). A broken record remains a valid fact. |
| `sport` | string or null | `ref.league.sport_code`, or `soccer` |
| `competition` | string or null | League code, tournament id, or award code |
| `league` | string or null | SPXN league code (`nhl`, `mls`, `wc`) |
| `source.sourceId` | string | `meta.source` code |
| `source.licence` | string | Source licence as stored |
| `source.attribution` | string | Required credit line |
| `source.url` | string or null | Source page when one exists |

Public feeds still drop `nhl_api` ("No licence published") and rows licensed "Owned by SPX". Famous athletes are ranked by Wikidata sitelink count, never by guess. Women’s and para-sport facts come from the same CC0 fetch; empty sport rows are not published as coverage.

## Games

Home and away are objects, not strings. A five-league game also carries `gameId` (SPXN `core.game.game_id`) so a site can link to `https://spxn.com/<league>/<season>/game/<gameId>-…`, plus `venueId` when known and `seasonStartYear`.

`TeamRef`:

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string or null | Label only |
| `franchiseId` | number or null | SPXN `core.franchise.franchise_id` |
| `teamSeasonId` | number or null | SPXN `core.team_season.team_season_id` |
| `soccerTeamId` | string or null | `core.soccer_team.team_id` (`C-…` club, `T-…` national) |
| `countryCode` | string or null | ISO 3166-1 alpha-2 |
| `fifaCode` | string or null | FIFA three-letter code (national teams) |
| `flagCode` | string or null | Hata flag code (ISO 3166-1 or 3166-2, e.g. `GB-ENG`) |

Soccer matches set `soccerTeamId` and leave `franchiseId` / `teamSeasonId` null. National teams fill FIFA and flag codes; clubs leave `fifaCode` null.

### Example: five-league game

```json
{
  "recordId": "spx:game:1849201",
  "category": "game-on-day",
  "tags": ["match-result"],
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

Championship finals use the same team objects with `category` `championship-final`. Soccer on-this-day uses `soccer-on-day` and `soccerMatchId`.

### Example: national soccer teams

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

`flagCode` is what Hata draws. `fifaCode` is the FIFA trigram. They are not always the same.

## People

Birthdays, deaths, drafts and awards carry a `PersonRef`:

| Field | Type | Meaning |
| --- | --- | --- |
| `personId` | number or null | SPXN `core.person.person_id` |
| `qid` | string or null | Wikidata item (`Q3101`) |
| `name` | string | Label only |
| `leagueCodes` | string[] | Leagues from roster, draft or award |
| `franchiseIds` | number[] | Clubs from roster or the drafting / winning team |
| `teamSeasonIds` | number[] | Matching team seasons |

Team ids come from roster, draft or award rows, never from a name match.

### Example: birthday

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

The numbers above are shape only. Do not treat them as a claim about that person.

Drafts are year-precision (`eventDate` null, `draftYear` set). Awards are year-precision unless the award is a championship and that season has exactly one distinct final date.

## TypeScript

```ts
import { EXTRACT_CATEGORIES, type OnThisDayRecord, type TeamRef, type PersonRef } from "@johnmorrisdotca/meigen-sports";
```

`OnThisDayRecord` lives next to `MeigenRecord`. The bundled seed still uses `MeigenRecord`. When new game JSON arrives, conversion maps extractor objects onto this type without reading the clock.

## From the README's API section

Each `MeigenRecord` has a `kind` (`quote` or `history`), exact text, source citation, rights status, sport and type tags, entity references, and date fields. A quotation's `date` and `monthDay` are null when its utterance date is not established. Entity labels are not identity keys; use stable `id` values.

`OnThisDayRecord` is the website consume shape for DS1 extracts: games carry `home` / `away` `TeamRef` objects (franchise, team-season, FIFA and ISO/Hata flag codes), people carry `PersonRef` (SPXN person id, Wikidata QID, leagues, team ids), and every row has `recordId`, date precision, extract `category`, non-exclusive `tags`, sport, competition, source, licence and attribution. The bundled seed still uses `MeigenRecord`. See [docs/record-schema.md](./docs/record-schema.md).

`HISTORY_TYPES` lists forty-six **non-exclusive tags** (not exclusive categories). One fact is stored once and may carry several tags. Catalogue: [docs/categories.md](./docs/categories.md). Readiness labels describe implementation capability, not verified live data counts. The richer player and record progression design in [docs/history-model.md](./docs/history-model.md) is planned and is not part of the current `MeigenRecord` API. `EXTRACT_CATEGORIES` is the extract family that produced the row.
