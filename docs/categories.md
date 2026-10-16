[日本語](categories.ja.md) · English

# History tags

These 46 identifiers (`HISTORY_TYPES`) are **tags, not exclusive categories**. Store each fact once (`recordId`). One `OnThisDayRecord` may carry several tags: a championship-winning overtime goal is `championship-win` + `match-result` + `overtime-result`. Do not duplicate the event once per tag.

`category` on the record is the extract family that produced it (`game-on-day`, `championship-final`, …). `tags` are these history-type ids, assigned only from structured fields the extract already holds. Never invent a tag.

Favourites filters match if **any** tag matches. A fact is copied into every matching category shard. Variety (`randomFacts`, demo mix) still counts the fact once, and caps two records per tag.

Public feeds still drop `nhl_api` and “Owned by SPX”. Allowed licences: CC0, CC BY-SA 4.0, CC BY 4.0, Retrosheet.

**Count** is extract-on-disk rows that can evidence the tag (2026-10-16 join at `1f8f0d7`), not the public shard size after licence and richness filters. `0` means no extract yet. Drafts are `0` because the previous SQL timed out; the page-first query is fixed and waiting on DS1.

## John’s priorities

| Tag | Why it is first | DS1 now | Extractor |
| --- | --- | --- | --- |
| `championship-win` | Championship winners | `core.game` finals, `extract_finals` 1,867 | rerun `extract_finals.sql` (series + OT + venue) |
| `scoring-performance` | Game-winning scorers | no participant-level goals | planned; a season GWG total is not a scorer |
| `player-birthday`, `age-at-event` | Birthdays and ages | birthdays 20,440; deaths 3,999 | rerun birthday/death SQL (position, clubs) |
| `career-stat-milestone`, `sport-record` | Career milestones; successive holders (Gretzky then Ovechkin) | no dated crossing events | planned; keep each holder as its own fact |
| `winning-streak`, `result-streak` | Winning and losing streaks | ordered games exist | planned; needs complete ordered results |
| `combat-sport-result` | Boxing champions and title reigns | not in DS1 core | planned; needs sanctioning lineage |
| `athletics-performance`, `sport-record` | Athletics and world records | not in DS1 core | planned; Wikidata/CC0 path |

## Status of the 46 tags

Status: **collected** = convert can attach this tag from extracts already on disk. **partly** = some fields or a subset exist; an extractor rerun or more evidence is needed. **planned** = no extract, do not invent.

| Identifier | Meaning | Data source | Status | Count |
| --- | --- | --- | --- | --- |
| `championship-win` | A club or nation won a championship | `extract_finals`; soccer `stage=final` | collected | 1,867 finals |
| `historic-cup-series` | A cup or playoff series with edition and result | finals with series fields | partly | waits on finals rerun |
| `playoffs-start` | First playoff game of a competition | `core.game` phase | planned | 0 (do not guess game 1) |
| `season-boundary` | Season opener or finale | complete schedule | planned | 0 |
| `series-start` | First game of a series | `seriesGameNumber=1` | partly | waits on games/finals rerun |
| `series-clinch` | Series decided or swept | `seriesBestOf` + wins | partly | waits on games/finals rerun |
| `match-result` | Played game with both teams and a final score | games, finals, soccer | collected | 392,898 + 10,423 + 1,867 |
| `overtime-result` | Result that went to overtime or a shootout | `wentToOvertime` / shootout | partly | waits on games/finals rerun |
| `shutout` | Completed result, one side scored 0 | scores on game rows | collected | from scored games |
| `score-margin` | Bounded scoring-margin comparison | scores exist; no editorial bound | planned | 0 (do not tag every game) |
| `winning-streak` | Consecutive wins under an explicit policy | ordered `core.game` | planned | 0 |
| `first-recorded-game` | First recorded game or win in coverage | complete ordered results | planned | 0 |
| `franchise-founded` | Independent founding date | not first recorded game | planned | 0 |
| `franchise-folded` | Independent dissolution | not last recorded game | planned | 0 |
| `franchise-identity-change` | Dated rename or move (not 1 January) | `extract_franchise_events` | collected | 1,116 (subset published) |
| `venue-history` | Opening, rename or first event | `extract_venue_openings` | collected | 203 |
| `player-birthday` | Verified birth date and person id | birthday candidates | collected | 20,440 |
| `age-at-event` | Age from birth date and event date | death + birthday join | partly | deaths 3,999 |
| `player-career-boundary` | Debut or last known appearance | complete appearances | planned | 0 |
| `player-retirement` | Dated retirement, not last game | transactions | planned | 0 |
| `draft-selection` | Draft year, round, pick, club, person | `core.draft_pick` / harvest | partly | 0 (SQL fixed, not rerun) |
| `award-honour` | Award edition and recipient | `extract_awards_season` | collected | 5,181 (160 with a day) |
| `season-stat-milestone` | Season statistic with complete inputs | player season stats | planned | 0 |
| `career-stat-milestone` | Career statistic with complete inputs | career totals + crossing date | planned | 0 |
| `competition-boundary` | Competition begins or ends | bundled Wikidata seed | collected | bundled seed only |
| `scoring-performance` | Participant-level scoring (incl. GWG) | box / event log | planned | 0 |
| `result-streak` | Losing, winless or unbeaten streak | ordered results | planned | 0 |
| `combat-sport-result` | Bout result or title reign | boxing lineage | planned | 0 |
| `athletics-performance` | Discipline, round, result, placing | meet results | planned | 0 |
| `sport-record` | Record progression with former holder | authority + ratification | planned | 0 |
| `transfer-trade-signing` | Dated trade, signing or loan | transactions | planned | 0 |
| `roster-selection-milestone` | National or squad selection | rosters | planned | 0 |
| `coaching-management` | Appointment or departure | coaching records | planned | 0 |
| `rivalry-meeting` | Derby or first meeting | pair history | planned | 0 |
| `comeback-upset` | Explicit deficit or upset rule | in-game scores | planned | 0 |
| `qualification-promotion` | Qualification, promotion, relegation | tables | planned | 0 |
| `ranking` | Ranking peak or weeks at number one | ranking lists | planned | 0 |
| `participation-longevity` | Appearance streak, youngest, oldest | appearance logs | planned | 0 |
| `non-scoring-performance` | Assists, saves, strikeouts, defence | box stats | planned | 0 |
| `exceptional-achievement` | Perfect game, no-hitter, maximum | official feat records | planned | 0 |
| `rules-format-change` | Dated rule or format adoption | league minutes | planned | 0 |
| `league-federation-history` | Founding, merger, expansion | league history | planned | 0 |
| `sporting-first` | Verified first participation or medal | firsts with evidence | planned | 0 |
| `ceremony-recognition` | Jersey retirement, Hall of Fame | ceremonies | planned | 0 |
| `attendance-audience` | Verified crowd or broadcast figure | attendance | planned | 0 |
| `cancelled-postponed` | Cancelled, postponed, lockout | game status | planned | 0 |

Quotation is a separate `kind`, not one of these 46.

## Folded into the 10 editor ideas

Ranked; work started at the top three without waiting.

1. **Rich game and final sentences** (started) — `match-result`, `championship-win`, `overtime-result`; needs the games/finals rerun for series, venue and OT.
2. **My favourites** (started) — combinable filters; a category filter matches any tag; shards per tag share `recordId`.
3. **Anniversary framing in the demo** (started) — today in the visitor’s time zone, three rich facts.
4. Records and successive holders — `sport-record`, `career-stat-milestone` (planned).
5. Debuts and last games — `player-career-boundary` (planned).
6. Milestones — season and career tags (planned); birthday/age partly in hand.
7. Streaks — `winning-streak`, `result-streak` (planned).
8. Upsets and comebacks — `comeback-upset` (planned).
9. Rivalries — `rivalry-meeting` (planned).
10. Firsts, trades, venues, quotes, per-team/player feeds, logos — venues collected; trades/firsts planned; quotes remain `MeigenRecord`; team/player shards use franchise and person ids.

Never invent 1 January. Year-only drafts and awards leave `eventDate` null.

## Living or dead unknown

Sentences come from [templates](templates.md), not a baked English string. Neutral birthday defaults are true whether the person is living or not (“was born on this day in YEAR”, “was born N years ago today”). “Turns N” only if a source sets `livingStatus: living`. “(died YEAR)” only if a source states death. Never “would have turned”. Missing a death date is `unknown`, not living.

## Famous players (all sports)

Rank “famous” by evidence: Wikidata sitelink count, then awards and Hall of Fame membership when those rows exist. Never guess a ranking. The fetch `pipeline/fetch_wikidata_open.py` keeps the top 500 sitelink athletes across hockey, baseball, basketball, American and Canadian football, soccer (men’s and women’s), tennis, boxing, athletics, golf, motor racing, cricket, Olympics and Paralympics. Holes stay holes.
