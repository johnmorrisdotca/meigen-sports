[日本語](priority-athletes.ja.md) · English

# Priority athletes

The master file is [`data-sources/priority-athletes.csv`](../data-sources/priority-athletes.csv). Each later build reads these rows first. The list is **1,000 people**: John’s unique names first. If his unique count is under 1,000, fill the rest in this order (Wikipedia CC BY-SA / Wikidata CC0; never NHL endpoints, ESPN, or Sports Reference):

1. Stanley Cup game-winning / Cup-clinching goal scorers (from the “Winning goal” column of *List of Stanley Cup champions*).
2. Baseball MVPs (AL/NL), famous home-run hitters, Home Run Derby winners.
3. Other notorious or iconic figures in sports we cover (sourced facts only; no gossip, ethnicity, religion, health, sex, family, or politics).
4. Only then, Hall of Fame / awards-list fame if still short.

If John’s unique names already exceed 1,000, all of his are kept. Do not drop John’s names to hit 1,000.

| Column | Meaning |
| --- | --- |
| `name` | The name as listed |
| `sport` | Primary sport slug |
| `qid` | Wikidata id, filled only when the English Wikipedia article is a single person |
| `priority` | `1` = this 1,000 |
| `notes` | Why a fill row was added (`SC GWG`, `MLB MVP`, `HR hitter`, `HR Derby`, `notorious:…`), extra sports, or `ambiguous:…` |

## Dedupe

Same person once.

- Confirmed Wikidata QID: one row, even if the source listed more than one sport.
- No QID yet: same folded name **and** same sport is a duplicate. A shared name with a different sport or era is kept as two rows until a QID proves they are one person. Never guess.

Ambiguous names stay empty and go back to John.

Add a name by appending a CSV row. Do not guess a QID.

Match onto DS1 `core.person` is **QID only** (`core.external_id` source `wikidata`). Same QID updates empty facts; it never makes a second record. Possible duplicates are logged, never merged.

## After this list

Everyone else is ranked by sitelink count, Hall of Fame membership, major awards, records, and Olympic or Paralympic medals. Coverage counts live in [coverage.md](coverage.md) once that ranked extract exists.
