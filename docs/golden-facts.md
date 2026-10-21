# Golden facts

A small committed list of famous, well-sourced facts that the published data must hold, with the right date and key details. It runs in `pnpm check` (so in CI, in the Pages workflow and in the release workflow) and on the built site: `node scripts/check-golden.ts site/data/v1/0.1.0/facts`. Any miss fails the release.

## The list

`test/golden/golden-facts.json` has 247 entries.

- **Must hold** (196): births, deaths, title games, World Cup and Women's World Cup finals, award wins and venue openings in hockey, baseball, basketball, American and Canadian football and soccer, and the births and deaths of famous people in athletics, boxing, formula one, golf, gymnastics, swimming and tennis, across three eras (before 1920, 1920 to 1969, 1970 on). Each is matched by Wikidata id or by league and date, and its details are checked: the date, the sport against the league, and the winner named first in a decided game.
- **Known gaps** (51): famous people and events the data does not hold yet, such as a Babe Ruth home run, a draft, Roger Federer's birthday or the two "Battle of the Sexes" matches. The suite lists them and fails if one appears, so it is moved to the must list (the seed's `people` list, then a run of the builder): 50 gaps became must facts when the converter began to read the priority athletes' facts.
- **Never** (16 rules, in `scripts/golden.ts`): no person dated before 1850, a sport that disagrees with the league, no bare "motor-racing" label (a named discipline such as formula one is a real sport), an individual award only for the position that wins it (a Cy Young Award or a Rolaids Relief Man Award for a pitcher, a Vezina Trophy for a goaltender: 148 non-pitchers once carried a Cy Young Award, read through the team-season of the real winner), no athlete born after his club's first season, no death before a birth, no future date, no birthday that says someone "turns" a number or "would have turned", no title claim for any game but the last of a World Series or NBA Finals, no tie wording for a World Cup final, no invented day (January 1, March 1, July 1) for a club or award, no sex or para batch labels, no repeated fact id and no unfinished sentence. Every rule has a bad example in the tests, so a pass means something.

A person's birth or death on January 1 is allowed in the list only when Wikidata (day precision), the introduction of the English Wikipedia article and its infobox name the same day (Pierre de Coubertin, 1863-01-01): January 1 is where a year-only date is often written down. The two 1973 "Battle of the Sexes" matches are two entries because the Wikidata item holds only the first, Riggs against Court on 1973-05-13, while the article's famous match, King against Riggs in the Astrodome, was on 1973-09-20.

Every date, name and winner in the list was fetched from Wikidata (CC0) or read from the infobox of the English Wikipedia article (CC BY-SA 4.0) by `pipeline/golden/build_golden.py`, and a value Wikidata and Wikipedia disagree on stops the build. Each entry names its source and how it was checked. The seed, `pipeline/golden/seed.json`, only says who and what to cover. Run the builder by hand when the list changes; it makes one polite request at a time to the documented APIs.

`pipeline/golden/check_finals.py` does the same for every World Series and NBA Finals the extract holds (201 seasons) and writes `pipeline/golden/finals-check.json`; the converter says a game "won the title" only when its date agrees with it.

## Where each fact is served

Each must entry is looked for in five places: the full dataset (`store/`), the bundled offline set, the day shard, a team feed and a player feed. `test/golden/locked-paths.json` records where each is served today as a floor: a later build may serve it in more places, never fewer. `node scripts/check-golden.ts --lock` rewrites the floor after a change that is meant to move facts. The report printed by the test counts the list by sport, era, kind and path, and the suite fails if a sport the data covers has fewer than ten must entries.

## From the README

This is a sourced collection with coverage gaps, not a complete daily almanac. `test/golden/golden-facts.json` lists 246 famous, source-checked facts the data must hold (and those it is known not to hold yet), with rules for what must never appear; see [docs/golden-facts.md](./docs/golden-facts.md). Quotes have unknown utterance dates and are never assigned invented anniversaries.
