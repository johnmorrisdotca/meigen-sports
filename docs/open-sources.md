[日本語](open-sources.ja.md) · English

# Open sources and licences

Licence is checked **before** a download. A source that forbids automated collection, or whose data is not CC0 / CC BY-SA 4.0 / CC BY 4.0 / Retrosheet, is skipped. Wikidata (CC0) and Wikipedia (CC BY-SA 4.0, with attribution) are the fallback for every sport. Never ESPN, Sports Reference, or NHL endpoints.

Fetch: `python3 -I pipeline/fetch_wikidata_open.py` (2 s gap, User-Agent `MeigenSports/0.1.0`). Raw SPARQL JSON is gitignored under `data-sources/raw/wikidata/`. Convert-shaped extracts go to `MEIGEN_EXTRACT_DIR`. This package does not write DS1.

## Motor racing

| Series | Source tried | Licence | Decision |
| --- | --- | --- | --- |
| Formula One | [Jolpica](https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md) (Ergast successor) | **CC BY-NC-SA 4.0**, API non-commercial; repository code Apache-2.0 | **Skip** for public facts (NC). Fallback: Wikidata CC0 (`formula-one`, P641 Q1968). |
| NASCAR | Official data portal / feed.nascar.com | Token-licensed; not an open dataset | **Skip**. Fallback: Wikidata `stock-car-racing`. |
| IndyCar / Le Mans / MotoGP | Official result APIs | Not openly licensed | **Skip**. Fallback: Wikidata motorcycle and sports-car racing. |

## Combat, golf, tennis, athletics, Olympics

UFC official stats are not an open dataset (**skip**). Boxing, MMA, golf majors, tennis majors (men and women), athletics, swimming, Olympics and Paralympics: Wikidata CC0 (P641 / P1344 / P166). Wikipedia CC BY-SA only with attribution when a later extract needs prose.

## Women’s leagues

WNBA.com, NWSL, PWHL official sites: not open datasets (**skip**). Wikidata: league and competition membership plus sport (WNBA, NWSL, PWHL, Women’s World Cup). People are never selected by sex (P21); the older `fetch_wikidata_open.py` still does, and [status.md](status.md) lists it as a finding to replace. Women’s World Cup matches already sit in `extract_soccer_on_day` from openfootball (CC0).

## Quotations

English Wikiquote sports pages are CC BY-SA 4.0. Fetch the official API, pin title + revision + URL, sports-related lines only. See [famous-quotes.md](famous-quotes.md). Kaggle datasets: read the stated licence before download; unknown licence or Goodreads/BrainyQuote scrapes are checklists, not ingest. quotes.toscrape.com is a GoodReads tutorial scrape: checklist only.

## Other

Cycling, rugby, cricket, horse racing, alpine skiing: Wikidata CC0. Esports: no verified open structured dump yet; the matrix row stays a hole.

The coverage script writes the same table into [coverage.md](coverage.md) and `data-sources/coverage-matrix.json` (`sources`).

## What was dropped, and why

People are chosen by sport and honours, the same way for everyone. Three things from earlier versions are gone from the pipeline:

- **Selection by sex or gender.** The Wikidata fetch used to add `P21` (sex or gender) to its query and tagged the rows `women-<sport>`. No query uses `P21` now, no row carries a `women-` label (1,158 rows of `athletes.csv` were relabelled with the plain sport), and the policy forbids collecting sex or gender.
- **The para-* batches.** The fetch used to download `para-ice-hockey`, `para-athletics`, `para-swimming` and a Paralympic-games batch, and rows carried a `para-` label. A para label, and any impairment class or classification code, is health data, so none is recorded and nobody is selected by a para flag (149 rows were relabelled). A sport that is a sport in its own right, such as wheelchair basketball, sitting volleyball or wheelchair tennis, is just a sport code. A Paralympic or Olympic medal is just an honour, listed in the same way.
- **Wrong sport items.** Several sport items in the old fetch scripts were not the sports they were named after (Q5369 is baseball, not motor racing; Q6927 is the 20th century; the items for alpine skiing, horse racing, motorcycle racing and Canadian football pointed at a file extension, a village, a song and a film). 249 baseball players had been labelled `motor_racing`. Every id in `pipeline/people/people_config.py` is now read back from Wikidata and compared with its name (`fetch_people.py verify`).

