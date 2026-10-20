# Ranking and the lists

Every list the package or the Pages feeds hands out is chosen by one function, `rankRecords` in `src/facts.ts` (`rankFeed` is the same over facts that can be put in words). The Python converter and the offline set call it too (`scripts/rank-batch.ts`, `bestOfDay`), so a feed on Pages and the bundled offline set can never disagree about what matters.

## Significance

`significance(fact)` is a pure function of the fact's own fields. A record or a sport record is 100; a title game 95; an award 85; a World Cup final 100, a semi-final 90, a quarter-final 80; a venue opening 55; a club's change of identity 45. A birth or death starts at 30 and gains 45 for a name on the committed priority list, 30 for an individual award, 10 for a career honour, 10 for a championship, 15 for twenty or more Wikipedia language editions. A routine result starts at 20 and gains 25 in the playoffs, 15 for overtime, 12 to 20 for a shutout, 8 for a large margin. Among equal scores the more recent fact comes first.

## The caps

A list takes facts in that order and skips a fact that would put a third of one **tag** (`championship-win`, `shutout`, `player-birthday` and the rest) or a third of one **competition** in it (`maxPer`, default 2), a second fact about one **person** (`personMax`, default 1) or a second one about one **club**. A fact is never listed twice. If the strict list is shorter than the list's minimum (three, when the day or the feed has that many) the one-person and one-club rule relaxes first, then the caps one at a time, so a quiet day still gets three facts.

A list about one thing does not cap that thing (`exempt`): a tag feed does not cap its tag, a league feed its league, a team feed its club, a player bucket nothing but each person's two best facts.

| List | Size | Caps |
| --- | --- | --- |
| `days/MM-DD.json` | up to 12 | two per tag and competition |
| the bundled offline set | three to five per day | the head of the same ranking: four, and a fifth only at significance 85 or more |
| `feeds/sports`, `leagues`, `tags`, `teams` | up to 40 | eight per tag and competition, the subject of the feed exempt |
| `feeds/players/NN.json` | up to 40 | each person twice |

Because a list of `n` is the head of a longer list of the same facts, the offline facts for a day are the first facts of that day's shard. `test/ranking.test.ts` holds this, and holds the caps, the minimum and the determinism.
