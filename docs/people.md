[日本語](people.ja.md) · English

# People list, 2,000 by country and sport

[`data-sources/people.csv`](../data-sources/people.csv) is the list of people the package builds its facts around: the first list of [priority-athletes.md](priority-athletes.md) (1,000 rows, 999 people: one person was listed twice), then 1,001 more added so that a reader from any of 46 countries finds people they know in most sports, not only in the United States. A person is a Wikidata item (QID); names never identify anyone, and each person is listed once.

| Column | Meaning |
| --- | --- |
| `qid` | Wikidata item. Empty only for the first-list rows that still have no item. |
| `name` | English label |
| `sport` | Sport code (for example `judo`, `figure_skating`, `ice_hockey`) |
| `country` | Country of citizenship as an ISO 3166-1 alpha-2 code, empty when none of the 46 countries applies |
| `priority` | `1` = the first list, `2` = added in 0.4.0 |
| `tier` | `existing`, or `A`, `B`, `C`, `H` (below) |
| `sitelinks` | Wikipedia language editions of the person |
| `olympic_medals` | Medal entries found in the Olympic medallist lists for that country and sport |
| `enwiki_title` | English Wikipedia article |
| `birth_on`, `death_on` | Full date, only where Wikidata gives the day; empty otherwise |
| `source` | Where the person comes from: the Wikidata item and the English Wikipedia article |

Never recorded: sex or gender, ethnicity, religion, health (no para label, impairment class or classification code), family, politics.

## Beyond the list

The 2,000 are the people the package was built around. From 0.7.0 the births and deaths of other sports people come from the Wikidata dump (CC0), by Wikipedia editions, in every sport it covers: [coverage of people](coverage-people.md) says how many, by sport and by day, and [the pipeline](data-pipeline.md) how. The same rule holds there: never sex or gender, ethnicity, religion, politics, family or health.

## The rule

The script is `pipeline/people/select_people.py`; run on the same evidence it gives the same list (`--check`).

1. **Candidates** for each country and sport: Wikidata people whose citizenship (P27) is the country (or one of its earlier states: the Soviet Union for Russia, East and West Germany for Germany, Czechoslovakia, Yugoslavia) and whose sport (P641) is the sport, the 50 best-linked per cell; plus the country's Olympic medallists in that sport from English Wikipedia's “List of Olympic medalists in …” (all colours; a team medal counts for each named person). Everyone needs an English Wikipedia article.
2. **Tiers.** A: at least one Olympic medal entry for that country and sport. B: Wikipedia articles in at least 20 languages. C: at least 8 languages, used only while a cell holds fewer than 3 people. H: a member of an honour list read from English Wikipedia before the country rounds (so far the NBA's 50 Greatest Players, 37 of them new).
3. **Score** inside a cell: language editions plus 10 for each medal entry (at most 5 count). Ties go to the lower QID number.
4. **Balance.** The first list counts first. Each country then has a quota of new people (70 for Japan and Canada, 45 for the United States, 55 for Germany, France, Italy and the United Kingdom, 40 for the other seven of the first fourteen, 6 to 12 for the others; `people_config.py`). Inside a country, round 1 takes the best unlisted person of every sport that has none yet, round 2 every sport that has fewer than two, and so on. Countries are served one pick at a time in turn, so none runs out of its quota before another starts. The list stops at 2,000.
5. **Checks with Wikidata claims.** The item must be a human (P31 = Q5); where it states a citizenship, one of the country's; and, unless the person has an Olympic medal entry (tier A), it must name an athletic occupation (P106) and none outside sport (actor, politician, writer, singer, businessperson and the like). Language count alone would otherwise rank a novelist who runs marathons above the athletes of the sport. A person who fails is dropped and the next candidate takes the place; `data-sources/people-rejected.csv` says why (312 were dropped). The cost: an athlete who is also well known as an actor or politician is left out unless a medallist.

## Verified, not remembered

Every sport and country item is read back from Wikidata and compared with its name (`fetch_people.py verify`); an earlier fetch used items that were not the sports they were named after. Two names John gave as examples were checked in the same way: Nicolas Gill (Q3277632, judo, Canada, medal entries in the lists) and Christa Deguchi (Q52133654, judo, Canada; Wikidata spells the first name with a C).

## What came out

2,000 people in 46 countries and 171 sport codes (the first list uses many small ones). The added 1,001: tier A 446, B 231, C 286, H 37; about 99.6 percent have a full birth date. The first fourteen countries get 40 to 70 added people each, the others 6 to 12. Judo, for example, now lists Nicolas Gill, Christa Deguchi and Catherine Beauchemin-Pinard for Canada, and every one of Japan, Canada, Germany, France, Italy and the United Kingdom has people in athletics, figure skating, swimming, gymnastics, soccer, basketball, tennis, cycling, boxing and judo. `data-sources/people-coverage.csv` counts every country and sport.

Wikidata is used as stated, and a few statements are wrong (a few people sit in a sport they only dabbled in). The first list was cleaned of para labels: `para_swimming` and the like became the plain sport, and the person listed twice (futsal and blind football) is listed once.

## What the list is not yet

- World champions and halls of fame are not separate sources; they are caught by the language count only.
- Paralympic medallists are honours like any other, but their lists are not read yet. Nobody is selected by a para flag.
- The wider top tier (about 20,000 to 40,000 people) is a rerun with `MEIGEN_SEARCH_PAGES` raised; see [pipeline/people/README.md](../pipeline/people/README.md).
- Sources: Wikidata is CC0; the Olympic medallist lists are English Wikipedia, CC BY-SA 4.0 (the counts are facts read from them). Never Sports Reference or ESPN.
