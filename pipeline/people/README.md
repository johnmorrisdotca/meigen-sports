# People list: fetch, select, hand off

Grows the list from 1,000 to 2,000 people, by country and sport, with a stated rule ([docs/people.md](../../docs/people.md)). Nothing here writes DS1, production or any database, and nothing here contacts anything but the Wikimedia APIs.

```sh
python3 -I pipeline/people/test_select_people.py        # the rule, on made-up evidence
python3 -I pipeline/people/fetch_people.py verify       # every country and sport item is what we think it is
python3 -I pipeline/people/fetch_people.py medals       # Olympic medallist lists (English Wikipedia, CC BY-SA)
python3 -I pipeline/people/fetch_people.py cells        # Wikidata search per country and sport (CC0), about 50 minutes
python3 -I pipeline/people/fetch_people.py entities     # labels and language counts for every candidate
python3 -I pipeline/people/select_people.py             # writes data-sources/people.csv; says which chosen people lack claims
python3 -I pipeline/people/fetch_people.py claims       # human check, citizenship, day-precision birth and death dates for the chosen
python3 -I pipeline/people/select_people.py             # repeat the last two steps until nothing is missing
python3 -I pipeline/people/select_people.py --check     # people.csv equals what the evidence gives
```

One request at a time, 1.1 s apart, a User-Agent naming this project, gzip, back-off on errors. Every response is a file under `data-sources/raw/people/` (git-ignored; `MEIGEN_PEOPLE_RAW` moves it); a rerun answers from those files and makes no request. Derived tables go to `data-sources/raw/people-work/`. query.wikidata.org is never used (its robots.txt disallows `/sparql`).

Wider top tier (about 20,000 to 40,000 people with 20 or more language editions, medallists by sport, world champions, hall of fame): `MEIGEN_SEARCH_PAGES=10 python3 -I pipeline/people/fetch_people.py cells` reads ten pages of search hits per cell instead of one, then `entities` and `select_people.py` as above with a higher `TARGET_TOTAL` in `people_config.py`. World champions and halls of fame are not separate sources yet (they are caught by the language count). Paralympic medallists are honours like any other; their lists are not read yet.

## Hand-off to the coordinating session (DS1 loads)

Only the coordinating session writes DS1. In order:

1. Archive `data-sources/raw/people/` and `data-sources/raw/people-work/` to DS1 (`legacy_files.raw_archive`) and Dropbox before anything is loaded.
2. Relabel what earlier loads got wrong: `pipeline/ds1-people/fixes/2026-10-19-relabel.sql` (read its header: baseball players stored as `motor_racing`, `women-` and `para-` batch labels, `para_*` sport codes). Apply the same relabelling to `db/seed/wikidata_meigen_athlete.csv` in spx-stats.
3. Append `pipeline/ds1-people/people-2000-athlete-rows.csv` (new people only, in the seed's own format, batch `people-2000`) to `db/seed/wikidata_meigen_athlete.csv`, then the existing steps: `scripts/wikidata_meigen/load.py`, `fetch_claims.py`, `db/build/215_meigen_people.sql`, `217_person_sport_p641.sql`. Names to check free before any new object: none are created by this hand-off.
4. Nothing in this list stores sex or gender, ethnicity, religion, health (no para label or class), family or politics. Dates are kept only at day precision and only where Wikidata states them.
