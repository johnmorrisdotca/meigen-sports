[日本語](history-model.ja.md) · English

# History types and player timelines

History families are curated independently of source datasets. `HISTORY_TYPES` in the `/categories` entry point defines thirty families and the evidence each requires. Its readiness flags describe implementation capability, not verified row counts in a live database. A record may carry several family and subtype tags.

Source lifecycle and consumer selection remain independent. An active, frozen or discontinued source can supply useful history. Preserve its original bytes, snapshot, coverage, provenance and reuse terms. Consumers can include or exclude sources and types without deleting the archive. Unclear reuse rights still prevent public export.

## Player history

A player's feed is a timeline of distinct achievements, rather than one mutable career total. Link each event to the player's stable identity and any relevant teams, competitions, seasons, games and previous record holders. Display names alone must never join people. A player can remain associated with a former record after somebody breaks it.

For example, a verified goal that sets a career record would carry both `career-stat-milestone` and `sport-record`. A later player surpassing that record creates another event linked to the previous event and both players. Do not overwrite the earlier achievement. Repeated anniversaries refer to that same historical event; they do not manufacture new achievements.

These are model examples, not verified seed records. No Gretzky, Ovechkin or Lemieux milestone is asserted by this document.

## Statistical scope

Every statistical milestone or record must specify:

- Metric: goals, assists, points, power-play goals, short-handed goals, or another explicit sport-specific metric.
- Competition phase: regular season, playoffs, explicitly combined, or another named phase. Missing scope never means combined.
- Time basis: career, season, postseason edition, series, game or another bounded interval.
- Population: competition, league, team, position, discipline, sex category, age group and weight class where applicable.
- Value, unit, threshold and comparison rule, including whether higher or lower values are better and how ties work.
- Date precision, input coverage and the evidence for the exact achievement date.

Combined regular-season and playoff totals require compatible metric definitions and disjoint, complete inputs. They are a separate statistical scope, not an official record category by default. Never add rates or averages, or count both a traded player's combined row and the component team rows.

Season totals can establish a season-level fact. They cannot establish the game or goal at which a threshold was crossed. A season's game-winning-goals total cannot identify the decisive goal in a particular game. Birthday, age at achievement, debut and retirement are distinct event types.

Baseball uses the same structure with separate metrics such as home runs, hits, strikeouts, stolen bases, wins and saves. Specify regular season versus postseason, career versus season, league versus franchise scope, and metric definitions. Rate records require a documented qualifying threshold. Do not assume the current database has these inputs.

## Record progression

The ingestion contract should retain a stable record definition and separate achievement events:

| Field | Meaning |
| --- | --- |
| `recordDefinitionId` | Stable metric, population, phase, period and conditions definition |
| `achievementId` | Stable identity of this attainment event |
| `holderIds` | One or several verified people or teams |
| `action` | Set, tied, surpassed, ratified, corrected or annulled |
| `value` / `unit` | Comparable result with explicit units and precision |
| `achievedOn` | Actual performance date, with precision |
| `announcedOn` / `ratifiedOn` | Separate authority dates, when known |
| `previousAchievementIds` | Previous comparable achievement events, including joint holders |
| `supersedesAchievementIds` | Corrected assertions; preserve the audit history |
| `authority` / `recognitionStatus` | Recognizing body and provisional, ratified, disputed or annulled status |
| `sourceEvidence` | One or more source snapshots and item identifiers |
| `derivation` | Versioned calculation rule, stable input IDs, coverage and input hashes |

These fields are the planned ingestion model; they are not yet fields guaranteed by the public `MeigenRecord` interface. Its initial export contains reviewed captions, exact dates, entity links, type tags and one primary citation. Do not silently discard additional evidence or precision when introducing the richer export schema: version and validate it first.

Event identity must not depend on a translated caption, provider row number or mutable career total. Deduplicate equivalent evidence across providers while preserving all citations. A record set and subsequently ratified can share an achievement but have separately dated history events. Corrections or annulments change recognition and eligibility without erasing what the archive originally said.

## World and competition records

Use governing-body recognition wherever available, with dated evidence. World, Olympic, national, league, franchise and competition records have separate populations. A maximum in an incomplete imported dataset is only an archive-best performance, never automatically a world record.

Conditions can determine comparability: athletics wind readings, indoor versus outdoor, hand versus electronic timing, equipment rules, swimming course length, relay versus individual events, weight class and disability classification. Preserve conditions and changes to rules. Unknown conditions require review rather than an inferred record claim.

Archived record lists remain useful as historical snapshots. Do not describe the holder in an old snapshot as the current holder without adequate subsequent coverage. Source status, recognition status and current-holder status are three separate properties.

## Refresh and review

Run derivations manually each month as new inputs arrive, with an annual full-history audit. Recompute the affected full player, competition or record scope after corrections or backfills; an append-only last-month query misses changes to old records. No scheduler is installed by this design.

Keep notability and editorial selection as reviewable overlays. A large total, famous name or automatically detected threshold does not itself establish fame, an official record or legal reuse permission. Exact dates lacking evidence stay out of day feeds; unknown day and month must never become January 1.
