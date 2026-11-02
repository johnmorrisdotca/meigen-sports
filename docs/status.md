# Status of meigen-sports, 2026-11-02

Version 0.15.0 on `main` (fa28d145). Tags v0.2.0 to v0.15.0 exist except v0.3.1, v0.3.2, v0.12.0, v0.14.4 and v0.14.5, which were never tagged (the coordinating session tags). Written for ticket cmvfh0kqd0000i90665rmo7sw; this page replaces the one written for 0.4.0 (2026-10-19). `pnpm check` is green on 0.15.0 (250 tests, lint, types, build, packed package).

## What is done

| Item | Since | Where |
| --- | --- | --- |
| 1,000-person list, then 2,000 by country and sport (rule, sources, checks) | 0.4.0 | `data-sources/people.csv`, [people.md](people.md), `pipeline/people/` |
| Sentence patterns for every kind of statement, no repeat between neighbours (`renderRun`) | 0.4.0 | `src/templates/`, `test/patterns.test.ts` |
| No sex or gender selector, no `women-` or `para` label, wrong Wikidata sport items fixed | 0.4.0 | `pipeline/`, `test/people.test.ts` |
| One build for the bundled data and Pages; offline set of 366 days; golden suite | 0.5.0 | `scripts/check-build.ts`, [golden-facts.md](golden-facts.md) |
| **One wording**: the Python converter no longer words facts; `scripts/caption-batch.ts` calls the library's templates and `test/captions.test.ts` holds every stored sentence (103,592 facts, English and Japanese) equal to `captionFromFact`. This was the "half done" item of the 0.4.0 page (221 of 5,493 matching), finished in 0.6.0 | 0.6.0 | `pipeline/convert_extract.py` `add_captions`, `test/captions.test.ts` |
| One ranking for feeds and the offline set | 0.6.0 | [ranking.md](ranking.md) |
| **Priority facts** are read by the converter (`data-sources/priority-facts.jsonl`, birthdays and deaths of the first list), with clubs, awards and Hall of Fame years from DS1 (`extract_person_context.json`) | 0.6.1, 0.6.2 | `pipeline/convert_extract.py` `priority_rows` |
| Positions spelled out, finals worded by series result, final context from DS1 | 0.6.3 | `pipeline/queries/extract_final_context.sql` |
| People of every sport from the Wikidata dump of 2026-10-12 (CC0): 44,922 births and deaths in 146 sports; 28,205 events in 185 sports | 0.7.0, 0.8.0 | `pipeline/wikidata_dump_people.py`, `wikidata_dump_events.py`, [coverage-people.md](coverage-people.md) |
| Japanese reviewed twice for naturalness (not by a person who reads Japanese) | 0.8.1, 0.9.0 | [translations.md](translations.md) |
| Tags, countries, links, indexes for every fact | 0.9.0 | `src/tags.ts`, `indexes/` |
| Flags and trophies beside a fact | 0.10.0 | `e2e/marks.demo.ts` |
| Disputed dates marked, not hidden | 0.11.0 | `data-sources/disputed-dates.json` |
| Calendar-page icon themes (seventeen), four display layouts, galleries, tear-off pages, weekend pages | 0.12.0 to 0.15.0 | `src/calendarIcon.ts`, `src/display.ts`, [calendar-icons.md](calendar-icons.md), [display-layouts.md](display-layouts.md) |
| Design note: how a history site and SPXN use the data | 0.14.4 | [uses.md](uses.md) |

The shards hold 103,592 facts (`data/v1/0.1.0/facts/store`); the demo, README and docs are on Pages, one language per page.

## What is still open

1. **Shards are committed.** `data/v1` is 5,443 tracked files and 215 MiB in the working tree (not the 57 MB of the 0.4.0 page): `facts/store` 110 MiB, `facts/indexes` 36, `facts/feeds` 20, `facts/people` 18, `facts/events` 13, `facts/index` 11, the rest 7. The repository's pack is 149 MiB and grows with every rebuild. The inputs of a rebuild (`extract_*.json`, 546 MB, from DS1 and the Wikidata dump) live only on machine1 (`~/Projects/backups/spx-stats/meigen-extract`), not in git.
2. **The 2,000 list is only partly in the shards.** 1,713 of the 2,000 Wikidata ids have a birth or death fact (most through the dump); 287 have none, and 276 of the 1,953 with a full birth date have no birthday fact. `priority-facts.jsonl` covers the first list only, and `convert_extract.py` does not read `people.csv`.
3. **Old fetchers use disallowed endpoints.** `pipeline/fetch_wikidata_open.py` sends SPARQL to query.wikidata.org and `fetch_wikidata_lists.py` reads `Special:EntityData`; both are disallowed by robots.txt for generic crawlers. The people pipeline (`pipeline/people/`) uses only the documented API.
4. **Bio hand-off to DS1 was never applied.** `pipeline/ds1-people/spx-stats/db/migrations/122_meigen_person_bio.sql` and `db/build/216_meigen_person_bio.sql` collide with spx-stats (122 is `person_admin`, 216 is `wnba_from_wikipedia`; the next free migration number is 190 and build numbers run to 238). DS1 loads of the 2,000 list (relabel, seed rows, `load.py`, `fetch_claims.py`, builds 215 and 217) are the coordinating session's.
5. **Four pending extractor SQL files** (`pipeline/queries/pending/`: awards by season, finals, games on a day, soccer on a day) are untested and need a DS1 re-extract.
6. **Japanese nobody has read.** Everything added since 0.4.0 has an English rendering in [translations.md](translations.md); no person who reads Japanese has checked it.
7. **The wider top tier** (about 20,000 to 40,000 people): `MEIGEN_SEARCH_PAGES` rerun and a higher `TARGET_TOTAL`. World champions and halls of fame beyond the NBA 50 are caught only by the language count; Paralympic medallists are honours like any other and their lists are not read yet.
8. **Tags not pushed:** v0.12.0, v0.14.4 and v0.14.5 (the coordinating session tags when CI on the commit is green).

## Worktrees and branches (nothing deleted)

Every worktree is clean (no uncommitted change) and every local branch is an ancestor of `origin/main`, so each can be removed with `git worktree remove` and `git branch -d` when nobody uses it.

| Worktree (`~/Projects/meigen-sports-worktrees/…`) | Branch | State |
| --- | --- | --- |
| `align` | `fix/calendar-align` | merged, 2 behind main (0.14.5) |
| `calendar-icons` | `feat/calendar-icons` | merged, 13 behind (0.14.0) |
| `docs` | `docs/showcase` | merged, 11 behind (0.14.1) |
| `ja-label` | `fix/ja-label` | merged, 9 behind (0.14.2) |
| `layouts` | `fix/compact-sort` | merged, 7 behind (0.14.3) |
| `uses` | `docs/uses` | merged, 5 behind (0.14.4) |
| `tearoff` | `work/tearoff` | equal to main (0.15.0) |
| the main checkout `~/Projects/meigen-sports` | `main` at 40dd5b4c | 92 commits behind `origin/main`, clean; fast-forward it before reading it |

Local branch `feat/layouts` (no worktree) is merged. Remote branches: `origin/work/bundle-050` and `origin/work/release-0-4` are merged. `origin/work/quotes-rights` (fbe0ed2d) is the same change as f2e48984 on `main`, rebased, so it is merged in effect. `origin/work/uses` (86a6d663) is an earlier, longer copy of `docs/uses.md`; `main` has the shortened one (4196bc18). Both remote branches can be deleted (GitHub work here is pushes to `main` only, so the coordinating session or John does it). The six scratch trees named in the 0.4.0 page (convert-pages, fetch-resume, grok-sentences, initial, quotes-rights, sql-extract) are gone.

## Findings for the coordinating session

- core.person on DS1 had 78,426 rows, 23,208 with a Wikidata id (use-case review): the people list is keyed on ids, never names.
- The policy stands: no sex or gender, ethnicity, religion, health (no para label or class), family or politics; sources are Wikidata (CC0) and English Wikipedia (CC BY-SA, credited), never Sports Reference or ESPN.
- The spx-stats seed and DS1 may still carry `women-*` and `para-*` batch labels and `para_*` sport codes from the earlier loads; `pipeline/ds1-people/fixes/2026-10-19-relabel.sql` is the fix and has not been applied.

## Checks run

`pnpm check` on 0.15.0: lint, typecheck, 250 tests, build, package check (pass).
