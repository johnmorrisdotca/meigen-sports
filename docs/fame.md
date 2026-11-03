[日本語](fame.ja.md) · English

# The fame list: 2,000 people ranked by world fame

[`data-sources/priority-people.csv`](../data-sources/priority-people.csv) lists 2,000 people ([priority people](priority-people.md)) and ranks every one of them, 1 to 2000, by a score that anyone can recompute from the same file. The rank is the package's fame signal: `significance` reads it (`fameRank` on a birth or a death), the showcase feed takes its 80 first birthdays from it, and `catalogue.json` publishes it (the first 100 on [the catalogue page](https://johnmorrisdotca.github.io/meigen-sports/catalogue.html), all 2,000 in the file under `fame`).

## The score

A whole number, from the columns of the file and the weights in [`data-sources/fame-rule.json`](../data-sources/fame-rule.json):

```
score = editions
      + 2 * min(olympic_medals, 5)
      + 4 * min(world_titles, 3)
      + 8 * min(hall_of_fame, 2)
```

| Part | What it is | Where it comes from |
| --- | --- | --- |
| `editions` | Language editions of the person's Wikipedia article. The first and by far the biggest part: it runs from 1 to 197. | Wikidata sitelinks (CC0), read on 3 November 2026 |
| `olympic_medals` | Olympic medals, any colour, at most 5 count (2 points each, at most 10). 578 people have one. | English Wikipedia's lists of Olympic medallists (CC BY-SA 4.0), as the list was chosen |
| `world_titles` | Wikidata "award received" items that name a world champion, at most 3 count (4 points each, at most 12). 30 people have one. | Wikidata (CC0) |
| `hall_of_fame` | Wikidata "award received" items that are a hall of fame, at most 2 count (8 points each, at most 16). 356 people have one. | Wikidata (CC0) |

The bonus can add at most 38 points, so a person known in 100 languages is never passed by one known in 60. Olympic medals are counted, not golds: the lists give no colour, and Wikidata's participation statements are too uneven to count golds (Michael Phelps has none). World titles and halls of fame are only as complete as Wikidata is (it is thin for some sports): a missing statement gives no points, never a penalty.

**Ties.** Equal scores are ordered by the person's place in the first list (`old_rank`, 1 to 999), then by Wikidata number. The old order is only a tie-break, never a floor: 232 of the first 999 sit at or above their old place and 767 below it, and 187 of the people added later are in the first 500.

**No score.** 39 people cannot be scored and keep the place they had in the first list (`fame_note` says why): 30 have no Wikidata item yet, and 9 are listed under the item of another person of the same name (a politician, an actress; the converter blocks the same nine). They are listed, not ranked by guess.

## The spread

The ranking is checked for crowding by country and sport (the country is the one the person plays for in Wikidata, else the first citizenship among the list's 46 countries). The rule, in [`fame-rule.json`](../data-sources/fame-rule.json): in each block of 100 ranks, up to the 2,000th, one sport may hold at most 35 places and one country at most 45; a person who would break it waits for the next place where he fits. **Nobody was moved**: the score alone stays inside the limits (`pipeline/people/fame.py check` and `test/fame.test.ts` fail if a block breaks them).

| Ranks | Countries (most) | Sports (most) | Different countries / sports |
| --- | --- | --- | --- |
| 1-20 | United States 6, Argentina 2, Germany 2, Brazil 2, France 2 | soccer 8, tennis 4, boxing 2 | 10 / 9 |
| 1-100 | United States 37, Germany 7, Brazil 5, Spain 4, Netherlands 4, United Kingdom 4, Russia 4 | soccer 32, tennis 21, boxing 7, basketball 7, athletics 7, Formula One 5 | 29 / 17 |
| 1-500 | United States 151, Canada 31, Germany 23, Russia 22, United Kingdom 21 | soccer 69, athletics 61, tennis 50, basketball 49, professional wrestling 34 | 46 / 52 |
| 1-2000 | United States 414, Canada 192, Japan 102, United Kingdom 89, France 86 | ice hockey 163, basketball 121, baseball 121, athletics 102, soccer 77 | 46 / 171 |

The top of the list is the world's: soccer and tennis lead because they are known in the most languages, and the United States is about a third of the first hundred and a fifth of all 2,000. Four of the first hundred have a country outside the list's 46 (Portugal, for one). The list is John's first 999 names plus 1,001 chosen by country and sport; people he did not pick and who are not in it (a famous cricketer of a country with no quota) are not ranked at all.

## The first twenty

| Rank | Name | Sport | Score |
| --- | --- | --- | --- |
| 1 | Lionel Messi | soccer | 197 |
| 2 | Cristiano Ronaldo | soccer | 186 |
| 3 | Muhammad Ali | boxing | 164 |
| 4 | Michael Schumacher | Formula One | 153 |
| 5 | Pelé | soccer | 151 |
| 6 | Roger Federer | tennis | 148 |
| 7 | Diego Maradona | soccer | 148 |
| 8 | Jackie Chan | stunts | 147 |
| 9 | Novak Djokovic | tennis | 135 |
| 10 | Rafael Nadal | tennis | 135 |
| 11 | Michael Jordan | basketball | 130 |
| 12 | Edmund Hillary | mountaineering | 130 |
| 13 | Usain Bolt | athletics | 125 |
| 14 | Zinedine Zidane | soccer | 123 |
| 15 | Serena Williams | tennis | 121 |
| 16 | Mike Tyson | boxing | 119 |
| 17 | Kylian Mbappé | soccer | 119 |
| 18 | Ronaldo Nazário | soccer | 115 |
| 19 | Franz Beckenbauer | soccer | 115 |
| 20 | The Rock | professional wrestling | 112 |

Jackie Chan, Buster Keaton and Harry Houdini are in John's first list under a stunt sport; the facts do not publish stunts or entertainment, so they rank but have no birthday fact.

## How the rank is used

- `significance` of a birth or a death adds 50 for ranks 1-100, 45 to 300, 38 to 700, 28 to 1,200 and 18 to 2,000 (`fameRank`; a fact without one that is marked `priorityAthlete` keeps the old flat 45). The editions of the person's page still add up to 75 on top ([ranking](ranking.md)).
- `meta.topFamous` of the facts names the 80 first people of the list and `feeds/showcase.json` carries their birthdays. The old `extract_wikidata_famous.json` (a fetch of about 500 famous people, a subset of this list) is retired.
- `priorityAthlete` is true for every fact of a person on the list; `fameRank` is his place.

## Reproduce

```sh
python3 -I pipeline/people/fame.py fetch    # Wikidata, one request at a time (64 requests for the 2,000); files kept under MEIGEN_PEOPLE_RAW
python3 -I pipeline/people/fame.py rank     # writes fame_score and fame_rank
python3 -I pipeline/people/fame.py check    # the file is what the columns give and the spread holds
python3 -I pipeline/people/test_fame.py
```

Never used: sex or gender, ethnicity, religion, health, family, politics. Sources: Wikidata (CC0) and the English Wikipedia medallist lists (CC BY-SA 4.0). Never Sports Reference or ESPN.
