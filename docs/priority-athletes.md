[日本語](priority-athletes.ja.md) · English

# Priority athletes

The master file is [`data-sources/priority-athletes.csv`](../data-sources/priority-athletes.csv). Each later build reads these rows first. The list is **1,000 people**: John’s unique names, then fame-ranked fill if his unique count is under 1,000. If John’s unique names already exceed 1,000, all of his are kept.

| Column | Meaning |
| --- | --- |
| `name` | The name as listed |
| `sport` | Primary sport slug from the parenthetical |
| `qid` | Wikidata id, filled only when the English Wikipedia article for that name (and sport, when the title needs a qualifier) is a single person |
| `priority` | `1` = this priority list |
| `notes` | Extra sports, `ambiguous:…`, `fame-fill`, or why a QID is still empty |

## Dedupe

Same person once.

- Confirmed Wikidata QID: one row, even if the source listed more than one sport.
- No QID yet: same folded name **and** same sport is a duplicate. A shared name with a different sport or era is kept as two rows until a QID proves they are one person. Never guess.

Ambiguous names stay empty and go back to John.

## Cap

After unique John’s names, if the list is short of 1,000, add the highest-evidence names not already on it (Hall of Fame and awards list membership, later sitelinks, records, Olympic and Paralympic medals), across sports and both sexes, until there are 1,000 rows. Do not drop John’s unique names to hit 1,000.

Add a name by appending a CSV row. Do not guess a QID. Re-run `python3 -I pipeline/priority_athletes.py` to fill empty QIDs from Wikipedia `/wiki/` and Wikidata EntityData.

Match onto DS1 `core.person` is **QID only** (`core.external_id` source `wikidata`). Same QID updates empty facts; it never makes a second record. Possible duplicates are logged, never merged.

Sources: Wikidata CC0; English Wikipedia CC BY-SA 4.0. No ESPN, Sports Reference, or NHL endpoints.

## After this list

Everyone else is ranked by sitelink count, Hall of Fame membership, major awards, records, and Olympic or Paralympic medals. The top 1,000 of that ranked set should be complete before the long tail. Coverage counts (top-100 / top-1,000 / top-10,000 per sport) live in [coverage.md](coverage.md) once the ranked extract exists.
