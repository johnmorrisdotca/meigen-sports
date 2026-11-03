# Ranking and the lists

Every list the package or the Pages feeds hands out is chosen by one function, `rankRecords` in `src/facts.ts` (`rankFeed` is the same over facts that can be put in words). The Python converter and the offline set call it too (`scripts/rank-batch.ts`, `bestOfDay`), so a feed on Pages and the bundled offline set can never disagree about what matters.

## Significance

`significance(fact)` is a pure function of the fact's own fields. A record or a sport record is 100; a title game 95 (98 with a shutout); an award 90; a World Cup final 105, a semi-final 90, a quarter-final 80; a venue opening 100 (the 200 venues the data holds are all well known; the data has no edition count for a building); a club's change of identity 45. A birth or death starts at 30 and gains 45 for a name on the committed priority list (20 when the list's own fill is known to have under twenty Wikipedia language editions), 30 for an individual award the person won himself, 8 for five or more of them and 15 for ten or more (`awardCount`), 25 for a Hall of Fame year (`hallOfFameYear`), 10 for a career honour, 10 for a championship and 6 more for three or more, 20 when a club retired his number (`jerseyRetired`: a club has named him a legend, in a league the world follows in few languages), and for the editions of his Wikipedia page, the one fame every sport shares: 15 for twenty, 28 for thirty, 55 for fifty, 65 for eighty and 75 for a hundred. A phrase that says who someone is (`epithet`) is not an honour and adds nothing; `highlight` adds 10. An event or a competition edition from the dump starts at 30 and gains by the editions of its page (6 for ten, 14 for twenty, 24 for thirty, 55 for fifty, 70 for eighty, 75 for a hundred) and 6 for a winner named, so a Games opening ranks with a person known in fifty languages and a routine race below a stadium's opening. A routine result starts at 20 (0 in the AHL, ECHL, NCAAF, PWHL and NWSL) and gains 25 in the playoffs, 15 for overtime, 12 to 20 for a shutout, 8 for a large margin: it never outranks a famous person or a big event. Among equal scores the better known comes first (more Wikipedia editions), then the more recent.

## Legends

A fact of significance `LEGEND` (85) or more is a legend. The caps below keep a list varied; they never hold a legend back, only the list's own length does (`rankRecords` with `strictSport` holds the sport cap for a legend too: the people and the events of a day, which exist to show many sports). Without this, a day with four famous births in four sports would show two of them and a quiet game would fill the rest. Ten thousand added lower-league games and people once pushed famous people and big events off the day lists (0.25.0); the golden suite (`test/golden/locked-paths.json`, `ever-locked.json`) now keeps every golden fact where it was.

## The caps

A list takes facts in that order and skips a fact that would put a third of one **tag** (`championship-win`, `shutout`, `player-birthday` and the rest) or a third of one **competition** in it (`maxPer`, default 2), a second fact about one **person** (`personMax`, default 1) or a second one about one **club**. A calendar day's list (`rankDay`, which the converter uses for every `days/MM-DD.json` and `bestOfDay` for the offline set) also takes at most three facts of one **sport** (`maxPerSport`), so a day is not all baseball or all basketball. A fact is never listed twice. If the strict list is shorter than the list's minimum (three, when the day or the feed has that many) the one-person and one-club rule relaxes first, then the caps one at a time (the sport cap rises with them, three, four, five), so a quiet day still gets three facts.

A list about one thing does not cap that thing (`exempt`): a tag feed does not cap its tag, a league feed its league, a team feed its club, a player bucket nothing but each person's two best facts.

| List | Size | Caps |
| --- | --- | --- |
| `days/MM-DD.json` | up to 16 | two per tag and competition, three per sport, legends exempt |
| the bundled offline set | three to eight per day | the head of the same ranking, with the same caps: four, a fifth at significance 85 or more, a sixth to an eighth at 90 or more |
| `feeds/sports`, `leagues`, `tags` | up to 40 | eight per tag and competition, the subject of the feed exempt |
| `feeds/teams` | up to 80 | eight per tag and competition, the subject of the feed exempt |
| `feeds/players/NN.json` | up to 40 | each person twice |

Because a list of `n` is the head of a longer list of the same facts, the offline facts for a day are the first facts of that day's shard. `test/ranking.test.ts` holds this, and holds the caps, the minimum and the determinism.

## What a person's fame is made of

Individual awards, club titles, a Hall of Fame year and the priority list reach a birthday through the converter, from facts that name the person himself: `personAward` is the best of his own awards (a fixed order of kinds, then the one he won most, then the earliest), `awardCount` how many he won, `championships` and `championshipName` the titles of the club in the seasons he played, and `hallOfFameYear` the year DS1 or the priority list gives (a sentence says "Baseball Hall of Famer", the hall of his own sport). An award is never read through a team-season: the award row carries the winner's team-season, which once gave every teammate of a Cy Young winner a Cy Young Award. The golden suite's never-rule `award-fits-position` and the converter's own check hold it.

## The day report

`node scripts/day-report.ts [factsDir] [--day MM-DD]` prints a day in full (default October 20) and the spread over all 366 days of facts, sports and kinds per day, for the served day shards, the bundled offline set and every fact held. Run it before and after a change to the ranking or the data.
