# Status of meigen-sports, 2026-10-19

Written by a subagent of Mac Studio for ticket cmvfh0kqd0000i90665rmo7sw. Branch `work/release-0-4`; nothing is tagged or published.

## What was found

- The main checkout (`main` at c9aa8bb, "initialize") is stale and nearly empty. The real history is on `origin/main`: 0.3.4 at 40dd5b4, a straight line from `work/initial` (v0.2.0) through `work/sql-extract`, `work/fetch-resume`, `work/convert-pages` and `work/grok-sentences`. Nothing in those branches is missing from `origin/main`.
- `work/quotes-rights` (also on origin) is the same commit as the "record per-quote word rights" commit in `origin/main` (f2e4898), rebased. It is merged in effect; delete the branch when convenient.
- The six worktrees under `~/Projects/meigen-sports-worktrees/` hold uncommitted edits. Four are older states of files that `origin/main` has since replaced (convert-pages, fetch-resume, sql-extract and most of initial). **`initial` also held work that was never committed anywhere.** It is recovered (below).
- Scratch trees to remove once nobody uses them: convert-pages, fetch-resume, grok-sentences, initial, quotes-rights, sql-extract. Do not delete `initial` before this branch is merged.

## Done (on origin/main before this branch)

| Item | Where |
| --- | --- |
| 1,000-row people list | `data-sources/priority-athletes.csv`, [priority-athletes.md](priority-athletes.md) |
| 29,961 on-this-day facts, all 366 days, club names, P641 sport map | `data/v1/0.1.0/facts/`, `pipeline/convert_extract.py` |
| Wikiquote quotations with per-quote word rights | `data-sources/seed/quotes.json`, `LICENSES/` |
| History sentences and demo form variety, reload test | `src/templates/`, `demo/`, `e2e/` |
| Pages docs, one language per page | `docs/`, `test/docs-language.test.ts` |
| 79 tests, `pnpm check` green | |

## Done in this branch

| Item | Commit area |
| --- | --- |
| Recovered what `initial` never committed: coverage matrix script and docs, open-source notes, list fetchers, bio hand-off SQL and seeds, the 3,703-row athletes list (was 306), `extract_nhl_career_records.sql`; four extractor SQL files with venue, series and overtime fields kept in `pipeline/queries/pending/` | `chore: recover files lost…` |
| Loader paths fixed: `loadLeague`, `loadTeamFacts`, `loadPlayerBucket` read `facts/feeds/…`; test fetches each from disk | `fix(load)` |
| `data/v1/latest.json`; README and docs tell 1,052 history rows from 29,961 facts | `fix(load)`, `docs` |
| Patterns for every statement: 15 kinds, 3+ patterns per kind and language, fragments in `phrases.ts`, `renderHistory`, `renderRun`, no "the" before national sides; 20 new tests | `feat(templates)` |
| No sex selector, no `women-` labels, no para batches or labels; wrong sport items fixed (baseball had been stored as motor racing: 249 rows) | `fix(pipeline)` |
| People 1,000 to 2,000 by country and sport, with sources and a reproducible rule ([people.md](people.md)); 1,001 added | `feat(people)` |
| Version 0.4.0 prepared, CHANGELOG, docs | `chore(release)` |

## Half done

- **Default sentences in the published shards** (`text`, `textJa`) are still written by Python (`pipeline/convert_extract.py`), which carries its own copy of the wording. They match `render` for 221 of 5,493 sampled facts (Japanese separator, "AFL" against "AFL Championship", a series clause only Python adds). To unify: move `honour_of` and `who_of` and the series clause into the data fields, add the series clause to the patterns, then run the shard captions through the patterns and rebuild. Then the Python wording can go.
- **`priority-facts.jsonl`** (970 KB, birth and honour facts for the first list) was recovered but `convert_extract.py` never reads it; the shards cover 7 sport labels and no Wikidata-only person. The 2,000 list is the input for the next shard build.
- **Bio hand-off** (`pipeline/ds1-people/spx-stats/db/.../216_meigen_person_bio.sql`, migration 122, seeds): recovered, never applied. Its numbers now collide with spx-stats (migration 122 is `person_admin`, build 216 is `wnba_from_wikipedia`); renumber at hand-off.
- Four pending extractor SQL files (`pipeline/queries/pending/`): untested; they need a DS1 re-extract by the coordinating session.

## Left

- Tag 0.4.0 after review (Mac Studio). Not tagged here.
- DS1 loads (coordinating session only): archive the raw folders, relabel (`pipeline/ds1-people/fixes/2026-10-19-relabel.sql`), append `pipeline/ds1-people/people-2000-athlete-rows.csv` to the spx-stats seed and run the existing steps. Details: [pipeline/people/README.md](../pipeline/people/README.md) and the hand-off file.
- The wider top tier John asked for (about 20,000 to 40,000 people): `MEIGEN_SEARCH_PAGES` rerun, then a higher `TARGET_TOTAL`. World champions and halls of fame (beyond the NBA 50) and Paralympic medal lists are not separate sources yet.
- Build the shards in the Pages job instead of committing them (57 MB of shards grow git history on every rebuild).
- Review the Japanese added in 0.4.0 (literal English renderings are in [translations.md](translations.md)); nobody who reads Japanese has seen it.
- `pipeline/fetch_wikidata_open.py` and `fetch_wikidata_lists.py` still send SPARQL to query.wikidata.org, whose robots.txt disallows `/sparql`; `fetch_wikidata_lists.py` reads `Special:EntityData`, also disallowed for generic crawlers. The new people pipeline uses only the documented API. Move the old scripts over before running them again.

## Findings for the coordinating session

- Wrong Wikidata items in earlier scripts (Q5369 is baseball, not motor racing; Q6927 is the 20th century; alpine skiing, horse racing, motorcycle racing, Canadian football and the para items pointed at unrelated things). 249 baseball players were stored as `motor_racing` in `legacy_wikidata_meigen.athlete` and `core.person_sport`, and the spx-stats seed has the same rows.
- The seed and DS1 also carry `women-*` and `para-*` batch labels and `para_*` sport codes. Policy and John's decision: no sex or gender, no para label or classification.
- core.person on DS1 has 78,426 rows, 23,208 with a Wikidata id (use-case review): the people list is keyed on ids, never names.

## Checks run on this branch

`pnpm check` (lint, typecheck, 98 tests, build, package check), `pnpm test:readme`, `pnpm test:demo` (9 browser tests), `python3 -I pipeline/people/test_select_people.py` (16 tests), `python3 -I pipeline/people/select_people.py --check`.

## From the README

This network example is not executed by the README check; it requires the static feed URL to be published.

Static feed publication and release storage setup are still being completed. The repository contains generated JSON and a loader, but this README does not promise that the Pages URL is live or that the source archive and curation workflow has been approved and completed.

## From the README's Browser and runtime support

Any current browser, and Node 22 or later. The package is plain data and functions, so it also runs in Deno, Bun, a worker and an edge function. Static loading accepts a caller-provided `fetch`, so the application controls network policy and caching. CI tests Node 22 and 24 on Linux, macOS and Windows, and the demo in Chromium and WebKit at a phone's width and a desk's.
