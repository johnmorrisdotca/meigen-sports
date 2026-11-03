#!/usr/bin/env python3
"""NHL and NBA milestones read from English Wikipedia's complete lists (CC BY-SA 4.0), as extract_milestones.json in MEIGEN_EXTRACT_DIR.

  python3 -I pipeline/extract_milestones.py

Three lists, each a table of one row to a game or goal:
  - List of players with five or more goals in an NHL game
  - List of NHL players with 500 goals (the date of each 500th goal, the club, the career game, the goaltender's club)
  - List of NBA single-game scoring leaders (every regular-season game of 60 or more points; the extract keeps 70 or more)

Fetched politely: one request at a time, a pause of over a second, a User-Agent that names the project, and every response kept as a file in
MEIGEN_EXTRACT_DIR/raw/wikipedia-milestones/ (outside git; the coordinating session archives it to DS1 and Dropbox). Wikipedia is a green source. Nothing is read from the
pages' references (they link to sites that are barred, such as ESPN); only the tables are parsed, and a name is a label, never an identity.
The 600th goal, and any 4-goal NHL game, have no complete list on Wikipedia, so they are not here.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "people"))
from wikimedia import ENWIKI, Client  # noqa: E402

EXTRACT = Path(os.environ.get("MEIGEN_EXTRACT_DIR", str(Path.home() / "Projects/backups/spx-stats/meigen-extract")))
RAW = EXTRACT / "raw" / "wikipedia-milestones"
PAGES = {
    "five-goals": "List of players with five or more goals in an NHL game",
    "career-goals": "List of NHL players with 500 goals",
    "points": "List of NBA single-game scoring leaders",
}
MONTHS = {name: number for number, name in enumerate(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"], 1)}
PLAYOFF_COLOUR = "#efffbf"
NBA_MIN_POINTS = 70
HIDE = "\x00"


def strip_noise(text: str) -> str:
    """The wikitext without comments and references: a reference holds links to sites that are never read."""
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"<ref[^>]*/>", "", text)
    return re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)


def hide_bars(text: str) -> str:
    """Every `|` inside {{ }} or [[ ]] is hidden, so a template or a link is never cut into cells."""
    out: list[str] = []
    depth = 0
    i = 0
    while i < len(text):
        two = text[i:i + 2]
        if two in ("{{", "[["):
            depth += 1
            out.append(two)
            i += 2
        elif two in ("}}", "]]"):
            depth = max(0, depth - 1)
            out.append(two)
            i += 2
        else:
            out.append(HIDE if text[i] == "|" and depth else text[i])
            i += 1
    return "".join(out)


ATTRIBUTES = re.compile(r"""^\s*(?:[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s|]+)\s*)+\|(?!\|)""")


def tables(text: str) -> list[list[tuple[str, list[str]]]]:
    """Each table of the page as rows of (the row's attributes, its cells); a header row has no `|` cells and is left out."""
    found = []
    for body in re.findall(r"^\{\|.*?^\|\}", hide_bars(strip_noise(text)), flags=re.S | re.M):
        rows = []
        for match in re.finditer(r"^\|-([^\n]*)\n(.*?)(?=^\|-|^\|\})", body, flags=re.S | re.M):
            attrs, chunk = match.group(1), match.group(2)
            cells = []
            for line in re.split(r"\n(?=\|)", chunk.strip("\n")):
                if not line.startswith("|"):
                    continue
                for cell in re.split(r"\|\|", line[1:]):
                    attr = ATTRIBUTES.match(cell)
                    cells.append((cell[attr.end():] if attr else cell).replace(HIDE, "|").strip())
            if cells:
                rows.append((attrs, cells))
        found.append(rows)
    return found


def date_of(cell: str) -> str | None:
    """`{{dts|1917|12|19}}`, `{{dts|2016|1|10}}` or `{{dts|2025|October|29|format=mdy}}` as `1917-12-19`."""
    match = re.search(r"\{\{dts\|([^}]*)\}\}", cell)
    if not match:
        return None
    parts = [p.strip() for p in match.group(1).split("|") if "=" not in p]
    if len(parts) < 3 or not parts[0].isdigit():
        return None
    month = int(parts[1]) if parts[1].isdigit() else MONTHS.get(parts[1].lower(), 0)
    if not (parts[2].isdigit() and 1 <= month <= 12 and 1 <= int(parts[2]) <= 31):
        return None
    return f"{int(parts[0]):04d}-{month:02d}-{int(parts[2]):02d}"


def name_of(cell: str) -> str | None:
    """`{{sortname|Joe|Malone}}` as `Joe Malone`; a third part is the article's title (`Ian Turnbull (ice hockey)`, `Jaromír Jágr`) and gives the name without its bracket."""
    match = re.search(r"\{\{sortname\|([^}]*)\}\}", cell, flags=re.I)
    if not match:
        return None
    parts = [p.strip() for p in match.group(1).split("|")]
    positional = [p for p in parts if "=" not in p]
    if len(positional) >= 3 and positional[2]:
        name = re.sub(r"\s*\([^)]*\)$", "", positional[2])
    elif len(positional) >= 2:
        name = f"{positional[0]} {positional[1]}"
    else:
        return None
    return name.strip() or None


def link_text(cell: str) -> str | None:
    """The words of the first link in a cell: `[[Chicago Blackhawks|Chicago Black Hawks]]` is `Chicago Black Hawks`."""
    match = re.search(r"\[\[([^\]|]*)(?:\|([^\]]*))?\]\]", cell)
    if not match:
        return None
    return (match.group(2) or match.group(1)).strip() or None


def number_of(cell: str) -> int | None:
    match = re.search(r"\d[\d,]*", re.sub(r"\[\[[^\]|]*\|(\d+)\]\]", r"\1", cell))
    return int(match.group(0).replace(",", "")) if match else None


def five_goal_games(text: str) -> list[dict]:
    """The table of the five-goal page: name, club, date, goals. A row coloured as a playoff game is one."""
    rows = []
    for attrs, cells in max(tables(text), key=len):
        if len(cells) < 4:
            continue
        player, club, day, goals = name_of(cells[0]), link_text(cells[1]), date_of(cells[2]), number_of(cells[3])
        if player and club and day and goals and goals >= 5:
            rows.append({"kind": "goals-in-game", "league": "nhl", "player": player, "club": club, "date": day, "amount": goals, "playoffs": PLAYOFF_COLOUR in attrs.lower()})
    return rows


def goaltender_club(cell: str) -> tuple[str | None, bool]:
    """The club's name as the list writes it for the goaltender (`(Senators)`, `(empty Canucks net)`), and whether the goal was into an empty net."""
    empty = "empty" in re.sub(r"\[\[[^\]]*\]\]", "", cell).lower()
    return link_text(cell.split("(", 1)[1]) if "(" in cell else None, empty


def five_hundredth_goals(text: str) -> list[dict]:
    """The 500th goals, from the big table (rank, flag, player, goals, games, date, club, game number, goaltender) and from the table of the latest season (order, flag, player, club, game number, date, goaltender)."""
    rows = []
    for table in tables(text):
        for _attrs, cells in table:
            at = next((i for i, c in enumerate(cells) if "{{sortname" in c.lower()), None)
            day = next((date_of(c) for c in cells if "{{dts" in c), None)
            club_at = next((i for i, c in enumerate(cells) if at is not None and i > at and c.startswith("[[")), None)
            if at is None or day is None or club_at is None or club_at + 1 >= len(cells):
                continue
            player, club, game_number = name_of(cells[at]), link_text(cells[club_at]), number_of(cells[club_at + 1])
            goalie = next((c for c in reversed(cells) if "(" in c and "[[" in c and "{{dts" not in c), None)
            opponent, empty = goaltender_club(goalie) if goalie else (None, False)
            if player and club and game_number:
                rows.append({"kind": "career-goal", "league": "nhl", "player": player, "club": club, "date": day, "amount": 500, "gameNumber": game_number,
                             "opponent": opponent, "emptyNet": empty})
    return list({(r["player"], r["date"]): r for r in rows}.values())


def high_scoring_games(text: str) -> list[dict]:
    """The NBA table: rank, points, player, date, team, opponent, score. A tied game leaves out its rank and points (a row span), so the row before gives them. Games of 70 points or more."""
    rows = []
    points = None
    for _attrs, cells in max(tables(text), key=len):
        shifted = "{{sortname" in cells[0].lower()
        if len(cells) < 5 + (0 if shifted else 2):
            continue
        if not shifted:
            points = number_of(cells[1])
        base = 0 if shifted else 2
        player, day, club, opponent = name_of(cells[base]), date_of(cells[base + 1]), link_text(cells[base + 2]), link_text(cells[base + 3])
        score = re.search(r"(\d+)\s*[\u2013\u2014-]\s*(\d+)", cells[base + 4])
        if not (points and player and day and club and opponent and score) or points < NBA_MIN_POINTS:
            continue
        rows.append({"kind": "points-in-game", "league": "nba", "player": player, "club": club, "opponent": opponent, "date": day, "amount": points,
                     "clubScore": int(score.group(1)), "opponentScore": int(score.group(2))})
    return rows


def with_counts(rows: list[dict]) -> list[dict]:
    """How many times the same player did the same kind of thing by that day (the lists are complete, so `nth` is a count and never a guess)."""
    seen: dict[tuple, int] = {}
    out = []
    for row in sorted(rows, key=lambda r: (r["date"], r["player"])):
        key = (row["kind"], row["player"])
        seen[key] = seen.get(key, 0) + 1
        out.append({**row, "nth": seen[key]})
    return out


def fetch(client: Client) -> dict[str, dict]:
    pages = {}
    for key, title in PAGES.items():
        body = client.get(ENWIKI, action="query", prop="revisions", rvprop="ids|timestamp|content", rvslots="main", titles=title, redirects="1")
        page = body["query"]["pages"][0]
        revision = page["revisions"][0]
        pages[key] = {"title": page["title"], "revision": revision["revid"], "timestamp": revision["timestamp"], "text": revision["slots"]["main"]["content"]}
    return pages


def build(pages: dict[str, dict]) -> dict:
    rows = with_counts(five_goal_games(pages["five-goals"]["text"])) + with_counts(five_hundredth_goals(pages["career-goals"]["text"])) + with_counts(high_scoring_games(pages["points"]["text"]))
    for row in rows:
        page = pages[{"goals-in-game": "five-goals", "career-goal": "career-goals", "points-in-game": "points"}[row["kind"]]]
        row["source"] = f"enwiki:{page['title']}@{page['revision']}"
    return {
        "category": "player-milestone", "source": "wikipedia", "licence": "CC BY-SA 4.0", "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "pages": [{"title": p["title"], "revision": p["revision"], "timestamp": p["timestamp"]} for p in pages.values()],
        "records": rows,
    }


def main() -> int:
    out = build(fetch(Client(RAW, gap=1.2)))
    EXTRACT.mkdir(parents=True, exist_ok=True)
    (EXTRACT / "extract_milestones.json").write_text(json.dumps(out, ensure_ascii=False) + "\n", encoding="utf-8")
    counts: dict[str, int] = {}
    for row in out["records"]:
        counts[row["kind"]] = counts.get(row["kind"], 0) + 1
    print(json.dumps({**counts, "extract": str(EXTRACT / "extract_milestones.json")}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
