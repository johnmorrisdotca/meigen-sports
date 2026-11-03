# Status of meigen-sports, 2026-11-02

Version 0.26.0 on `main`. The work of ticket cmvfh0kqd0000i90665rmo7sw (SPX-610) and the tickets that followed it is finished in this repository: what is left is elsewhere, and is listed at the end. Tags v0.15.1 to v0.19.1 are the coordinating session's to push (v0.12.0, v0.14.4 and v0.14.5 were also never tagged). `pnpm check` is green (285 tests), and so are `pnpm test:readme` and `pnpm test:demo`.

## What changed since the 0.15.0 audit

| Version | What |
| --- | --- |
| 0.15.1 | The shards (`data/v1/0.1.0/facts`, 215 MiB) are not committed any more: `pnpm shards` builds them in 12 seconds from `data-sources/facts` (14 MiB, 100 gzip files). The converter has two stages, extracts to facts and facts to shards; every shard was checked byte for byte against the committed one. |
| 0.15.2 | `fetch_wikidata_open.py` and `fetch_wikidata_lists.py` use the documented Wikidata and MediaWiki APIs through `pipeline/people/wikimedia.py`, not SPARQL or Special:EntityData. |
| 0.16.0 | The 2,000-person list is in the shards: 1,886 of 2,000 have a birth or death fact. `data-sources/people-profiles.csv` holds Wikidata's description, the French and Japanese article titles and the birthplace. |
| 0.17.0 | 255 retired numbers, jersey numbers on 8,270 people, `visualOf` and `GEAR_BY_SPORT`, banners in the demo (senshu-jerseys, devDependency). |
| 0.18.0 | 335 All-Star Games and 290 no-hitters and perfect games. |
| 0.19.0 | Japanese public holidays, the old calendar and rokuyō, computed (`docs/japanese-calendar.md`), in the side columns of `sun` and `roll`. |
| 0.19.1 | Every picture drawn again from the current code and data; `test/pictures.test.ts` fails when one is older than its inputs; every option of `calendarIcon` and `displayMarkup` is documented and tested. |
| 0.19.2 | The demo's header has the family's shared language picker and a theme switch, the address is kept by the shared address state, `release.yml` calls the shared release workflow and `AGENTS.md` is from the family template (kazoku-ui 0.7.3). |
| 0.20.0 | The calendar icons and Japanese calendar functions come from koyomi-calendars. |
| 0.19.3 | A retired number names the club of its day, a final or All-Star Game the building of its year, and a game of the National Association, American Association, Union Association, Players' League or Federal League says its own league, not MLB (`pipeline/extract_dated_names.py`). |
| 0.20.1 | 142 more NHL retirements (397 retired numbers), the early leagues named on a club's identity, the demo's league menu in full names, and a rebuild that stops without a fresh `extract_dated_names.json`. |
| 0.20.2 | Two games the database has corrected are left out until a fresh extract; eight finals no longer say "Kia Forum" before 2021. |
| 0.21.0 | 961 facts of para sports (wheelchair sports, goalball, boccia, the Paralympic Games and the rest): famous people and the editions and team results, the sport's name only, never a class or a word for the body (`docs/para-sports.md`). |
| 0.22.0 | Birth places without gone states ("London", not "London, Roman Empire"), the Allegheny Club identity without a city, a documentation site in English and Japanese, an embed page, and every way of using the package written and tested. |
| 0.23.0 | `squircle`, the eighteenth calendar page, from koyomi-calendars; every count and picture says eighteen. |
| 0.24.0 | 130 facts of NHL and NBA feats from English Wikipedia's complete lists: five or more goals in a game, the 500th goal, 70 or more points in a game; a new kind of sentence, `player-feat`. |
| 0.25.0 | The first full rebuild from the complete extract set of 2026-11-03 (126,810 facts, up from 105,924), made by a converter that refuses a missing, empty or stale input and a guard that compares with the last release; `catalogue.json` and its charts page. |
| 0.26.0 | Famous people and big events win the top picks again (MODULES-249): fame by Wikipedia editions, a retired number and titles, legends held back by no cap, day shards of sixteen and an offline set of three to eight per day; the golden paths of before 0.25.0 are back and cannot be relocked without a ticket; `pickFacts` with `ranked`, `random` and `mixed` modes and a seed, the pool filtered first and ranked after, per-league and per-sport picks on Pages; decade labels in full years (MODULES-248). |

"One wording" (the Python converter's own sentences) was already finished in 0.6.0: `test/captions.test.ts` holds every stored sentence to the library's templates. The 0.4.0 audit's other open items are done or have a ticket below.

## What is left, and where

- **DS1 and production (machine1).** The people hand-off (project spx-stats, ticket cmvfh0kqd0000i90665rmo7sw: migrations 190 and 191, builds 215, 217 and 239, the two loaders, the release) and archiving the raw files (Dropbox hand-off `meigenarchiverawfilesfords1`). Nothing here writes DS1.
- **Data not in the shards.** NHL and NBA milestones from Wikipedia's lists (SPX-858); cycles, 3-home-run games and NFL 400-yard games, which need play-by-play and nflverse weekly files archived first (SPX-859); the wider top tier of 20,000 to 40,000 people (`MEIGEN_SEARCH_PAGES`, a higher `TARGET_TOTAL`); Paralympic medallists and wheelchair sports, which wait for John's decision in the 0.16.0 hand-off; club colours for the banners (the data holds none); 114 people of the list with no fact (30 have no Wikidata id; the others are wrong Wikidata items among the first list, stunt performers, para sports and days on 1 January).
- **spx-stats.** The 2021 Pro Bowl is listed as played (SPX-860). A bad CRC in Dropbox's `gl1871_2025.zip` (gl1923.txt). The bio seeds cover the first list only; the claims fetch for the 873 new people (`scripts/wikidata_meigen/fetch_claims.py`) is not run.
- **Other packages.** kazoku-ui parts on npm (SPX-861 address, SPX-862 theme and language; the demo's own code stays until they exist); dougu-sports gear for boxing, golf, cycling, swimming, athletics, rugby and volleyball (SPX-863).
- **Reading.** Nobody who reads Japanese has checked the Japanese added since 0.4.0 (SPX-864; the English renderings are in `docs/translations.md`).
- **Site use.** spxn.com does not use the facts yet (SPX-865).
- **Branches.** The merged worktrees named in the 0.15.0 audit and the ones made since (`status`, `shards`, `fetchers`, `people2000`, `banners`, `allstar`, `jpcal`, `pictures`) are all merged into `main` and can be removed with `git worktree remove`; `origin/work/quotes-rights` and `origin/work/uses` are duplicates of what `main` holds.

## Checks run on 0.19.3

`pnpm check` (shards, lint, typecheck, 285 tests, build, package check), `pnpm test:readme` (30 examples, 68 exports, 88 pictures), `pnpm test:demo`; CI and Pages on every release commit.
