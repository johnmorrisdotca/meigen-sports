#!/usr/bin/env python3
"""Build public on-this-day fact shards from joined DS1 extracts. Does not connect to DS1."""
from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTRACT = Path(os.environ.get(
    "MEIGEN_EXTRACT_DIR",
    str(Path.home() / "Projects/backups/spx-stats/meigen-extract"),
))
OUT = ROOT / "data/v1/0.1.0/facts"
VERSION = "0.1.0"
ERA_START = 1850
QID = re.compile(r"^Q[1-9]\d*$")
PEOPLE_DAY = 40  # facts in a day's people shard (`people/MM-DD.json`)
EVENTS_DAY = 40  # facts in a day's events shard (`events/MM-DD.json`)
EVENT_CATEGORIES = ("competition-start", "competition-end", "sport-event")
# The people and the events the facts are about, with their countries and Wikipedia titles (pipeline/wikidata_links.py); empty when that extract is absent.
LINKS: dict = {"people": {}, "events": {}}
# People whose birth or death date Wikidata holds two or more equal-rank values of (pipeline/audit_dates.py --write-disputed); filled in main().
DISPUTED: dict[str, dict] = {}
TROPHIES: dict = json.loads((Path(__file__).resolve().parent.parent / "data-sources/trophies.json").read_text(encoding="utf-8"))
AWARD_NAMES: dict[str, str] = {}  # award id (`hart-memorial-trophy`) -> the award's name, for the vocabulary's menus
# The namespaces of a fact's tags that get an index of ids (`indexes/<folder>/<value>.json`); sport, league, team and day have theirs already.
TAG_INDEXES = (
    ("country", "countries"), ("birthcountry", "birthcountries"), ("host", "hosts"), ("decade", "decades"), ("award", "awards"),
    ("position", "positions"), ("honour", "honours"), ("series", "series"), ("title", "titles"),
)
# The fields a tag is built from (src/tags.ts `derivedTags`): all that scripts/tags-batch.ts is sent.
TAG_FIELDS = (
    "recordId", "category", "sport", "league", "competition", "eventLabel", "awardName", "countries", "nationality", "home", "away", "hostCountries",
    "birthCountry", "person", "position", "venueId", "eventDate", "draftYear", "seasonStartYear", "phase", "stage", "awards", "championships",
    "championshipName", "hallOfFameYear", "source", "dateDisputed",
)
# Joseon-era general Q704476 (Myong-won Kim); never an athlete fact. The others are items of the priority list that are not the athlete the list
# meant (the Wikidata item of a namesake, or of a politician, an actor or a doctor): Sun Yat-sen, Ronald Ross, the actress Jennifer Jones, the
# comedian George Burns, the politicians Marty Walsh and Jack Marshall, the singer Kim Woo-jin, the musician Paul Brady, the physician Pedro Gil.
BLOCKED_QIDS = {"Q704476", "Q8573", "Q102034", "Q189895", "Q344793", "Q15126384", "Q61100680", "Q284733", "Q648789", "Q7159603"}
BLOCKED = {"nhl_api", "spx_database", "spx_files", "spxn_database"}
NUMBER_WORD = {
    1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
    6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
}
# The sport a league is played in. A person's sport can come from a Wikidata statement about another sport
# (Michael Jordan baseball, Jackie Robinson football); a fact about a league club is about that league's sport.
LEAGUE_SPORT = {
    "mlb": "baseball", "nba": "basketball", "wnba": "basketball", "nhl": "ice-hockey", "nha": "ice-hockey",
    "pcha": "ice-hockey", "wchl": "ice-hockey", "wha": "ice-hockey", "nfl": "american-football",
    "afl": "american-football", "aafc": "american-football", "cfl": "canadian-football",
    "mls": "soccer", "wc": "soccer", "wwc": "soccer",
}
# The Hall of Fame that goes with each sport (core.person.hall_of_fame_year is the person's own sport's hall: DS1 holds it for the
# players of these five leagues only). A sport with no entry here says nothing of a hall.
HALL = {
    "baseball": "Baseball", "ice-hockey": "Hockey", "basketball": "Basketball",
    "american-football": "Pro Football", "canadian-football": "Canadian Football",
}
# An individual award that only one position can win (a Cy Young Award is a pitcher's). The golden suite holds the published data to it
# (scripts/golden.ts, rule "award-fits-position"), so an award that was borrowed from a teammate can never ship again.
AWARD_ORDER = (
    r"^(Major League Baseball|NBA|AP NFL) Most Valuable Player Award$|Hart Memorial|CFL's Most Outstanding Player Award$",
    r"Cy Young|Vezina|Norris|Art Ross|Conn Smythe|NBA Finals Most Valuable|World Series Most Valuable|Super Bowl Most Valuable|Grey Cup Most Valuable"
    r"|Defensive Player of the Year Award$|Offensive Player of the Year|Richard Trophy|Heisman",
    r"Rookie of the Year|Calder|Selke|Ted Lindsay|Rolaids|Hank Aaron|Most Outstanding|Most Improved|Sixth Man",
)
# Wikidata's short description of a person ("American boxer") says what a bare birthday cannot. Gender and para words are never used.
DESCRIPTION_BLOCKED = re.compile(r"female|male|woman|women|girl|\bman\b|\bpara|disab|blind|deaf|wheelchair|transgender|gay|lesbian|sportswoman", re.I)
PARA_SPORT = re.compile(r"^(para|deaflympic|wheelchair|goalball|boccia|sitting)[-_]?", re.I)
NOT_A_SPORT = {"entertainment", "film_stunts", "stunt", "high_wire"}


def slug_of_name(text: str) -> str:
    """"Hart Memorial Trophy" as an id, `hart-memorial-trophy`: the same rule as `slugOf` in src/tags.ts."""
    plain = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")


def load_links() -> dict:
    path = EXTRACT / "extract_wikidata_links.json"
    if not path.exists():
        print(f"missing {path}: no countries beyond nationality, no Wikipedia links", file=sys.stderr)
        return {"people": {}, "events": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {"people": data.get("people") or {}, "events": data.get("events") or {}}


def load_disputed() -> dict[str, dict]:
    """The people whose published birth or death date Wikidata holds two or more equal-rank values of (`data-sources/disputed-dates.json`, written by
    `pipeline/audit_dates.py --write-disputed`): qid -> {"birth": [days], "death": [days]}. Committed, so a rebuild needs no dump."""
    path = ROOT / "data-sources/disputed-dates.json"
    if not path.exists():
        print(f"missing {path}: no fact is marked date:disputed", file=sys.stderr)
        return {}
    return {p["qid"]: {k: p[k] for k in ("birth", "death") if p.get(k)} for p in json.loads(path.read_text(encoding="utf-8"))["people"]}


def age_on(born: str, day: str) -> int:
    by, bm, bd = map(int, born.split("-"))
    dy, dm, dd = map(int, day.split("-"))
    return dy - by - (1 if (dm, dd) < (bm, bd) else 0)


def mark_disputed(out: dict) -> None:
    """A fact that states a date Wikidata disputes keeps the date it always had and says the others: `dateAlternatives` (its own day: the birth of a birthday fact, the
    death of a death fact), `birthDateAlternatives` / `deathDateAlternatives` (a date it carries that is not its own day), `ageAlternatives` (the ages the dates could give
    instead of `ageYears`), and `dateDisputed`. Nothing is dropped and nothing chosen; a published date that is not one of Wikidata's is a build error."""
    dispute = DISPUTED.get((out.get("person") or {}).get("qid") or "")
    if not dispute:
        return

    def others(kind: str, value: str | None) -> list[str]:
        days = dispute.get(kind)
        if not days or not value:
            return []
        if value not in days:
            raise SystemExit(f"{out['recordId']}: the published {kind} {value} is not one of Wikidata's {days}")
        return [d for d in days if d != value]

    cat = out["category"]
    own = others("birth", out.get("eventDate")) if cat == "player-birthday" else others("death", out.get("eventDate")) if cat == "player-death" else []
    birth = others("birth", out.get("birthDate")) if cat != "player-birthday" else []
    death = others("death", out.get("deathDate")) if cat != "player-death" else []
    ages: list[int] = []
    if out.get("ageYears") is not None and out.get("birthDate") and out.get("deathDate") and (birth or own or death):
        births = dispute.get("birth") or [out["birthDate"]]
        deaths = dispute.get("death") or [out["deathDate"]]
        every = {age_on(b, d) for b in births for d in deaths}
        if out["ageYears"] in every:
            ages = sorted(every - {out["ageYears"]})
    if own:
        out["dateAlternatives"] = own
    if birth:
        out["birthDateAlternatives"] = birth
    if death:
        out["deathDateAlternatives"] = death
    if ages:
        out["ageAlternatives"] = ages
    if own or birth or death:
        out["dateDisputed"] = True


def best_award(awards: list[dict]) -> str | None:
    """The most notable individual award among one person's own awards: a fixed order of kinds, then the one he won most, then the earliest."""
    names = [a.get("name") for a in awards if a.get("name")]
    if not names:
        return None
    counts: dict[str, int] = defaultdict(int)
    first: dict[str, int] = {}
    for a in awards:
        name = a.get("name")
        if not name:
            continue
        counts[name] += 1
        first[name] = min(first.get(name, 9999), a.get("year") or 9999)

    def rank(name: str) -> tuple:
        tier = next((i for i, pattern in enumerate(AWARD_ORDER) if re.search(pattern, name)), len(AWARD_ORDER))
        return (tier, -counts[name], first[name], name)

    return min(counts, key=rank)


def short_description(text: str | None) -> str | None:
    """A Wikidata description such as "American boxer (1942-2016)" without its life years, or None when it is not a plain phrase."""
    d = re.sub(r"\s*\((?:born\s+)?\d{4}(?:\s*[\u2013-]\s*(?:\d{4})?)?\)\s*$", "", text or "").strip()
    d = re.sub(r"\s*\([A-Za-z][^()\d]*\)", "", d).strip()  # "(MMA)", "(track and field)": a gloss, not part of the phrase
    if not d or len(d) > 70 or re.search(r"\d|[()]|\bborn\b", d) or DESCRIPTION_BLOCKED.search(d):
        return None
    return d


CREDIT = {
    "retrosheet": ("https://www.retrosheet.org/", "The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at www.retrosheet.org."),
    "wikidata": ("https://www.wikidata.org/", "Wikidata contributors, CC0."),
    "wikipedia": ("https://en.wikipedia.org/", "Wikipedia contributors, CC BY-SA 4.0."),
    "wikipedia_daily": ("https://en.wikipedia.org/", "Wikipedia contributors, CC BY-SA 4.0."),
    "wikipedia_mls": ("https://en.wikipedia.org/", "Wikipedia contributors, CC BY-SA 4.0."),
    "nflverse": ("https://github.com/nflverse/nflverse-data", "nflverse contributors, CC BY 4.0."),
    "openfootball": ("https://github.com/openfootball/worldcup.json", "openfootball contributors, CC0."),
    "openfootball_mls": ("https://github.com/openfootball", "openfootball contributors, CC0."),
    "openfootball_worldcup": ("https://github.com/openfootball/worldcup.json", "openfootball contributors, CC0."),
    "jfjelstul_worldcup": ("https://github.com/jfjelstul/worldcup", "Joshua C. Fjelstul, The Fjelstul World Cup Database, CC BY-SA 4.0."),
}


def load_records(name: str) -> list:
    path = EXTRACT / name
    if not path.exists():
        print(f"missing {path}", file=sys.stderr)
        return []
    with path.open() as fh:
        data = json.load(fh)
    return data.get("records") or []


def allowed(row: dict) -> bool:
    if row.get("sourceId") in BLOCKED:
        return False
    lic = row.get("licence") or ""
    if lic.startswith("Owned") or lic.startswith("No licence"):
        return False
    if "CC0" in lic or "CC BY-SA" in lic or "CC BY 4.0" in lic:
        return True
    if "retrosheet" in lic.lower():
        return True
    return False


def source_of(row: dict) -> dict:
    code = row.get("sourceId") or "unknown"
    url, attribution = CREDIT.get(code, (row.get("sourceUrl"), (row.get("attribution") or "")[:240]))
    if row.get("sourceUrl"):
        url = row["sourceUrl"]
    lic = row.get("licence") or ""
    if "CC0" in lic:
        licence = "CC0 1.0"
    elif "CC BY-SA" in lic:
        licence = "CC BY-SA 4.0"
    elif "CC BY 4.0" in lic:
        licence = "CC BY 4.0"
    elif "retrosheet" in lic.lower():
        licence = "LicenseRef-Retrosheet"
    else:
        licence = lic
    return {"sourceId": code, "licence": licence, "attribution": attribution, "url": url}


PLACEHOLDER = re.compile(r"\s*[(\uff08]\s*(?:none|null|undefined|n/a|nan)\s*[)\uff09]", re.IGNORECASE)


def clean_label(value):
    """A name without a placeholder for "no value" ("Allegheny Club (none)" is the club Allegheny Club). The library says the same at render time."""
    if not isinstance(value, str):
        return value
    return PLACEHOLDER.sub("", value).strip()


# Wikidata's formal names for the sport ("Bosnian association football player") are not what a reader says: "Bosnian footballer". The same rule is
# in pipeline/wikidata_dump_people.py (the extractor's phrases) and is applied here to every phrase that says who a person is, whoever wrote it.
def plain_words(text):
    if not isinstance(text, str):
        return text

    def say(word: str):
        return lambda m: word.capitalize() if m.group(0)[:1].isupper() else word

    text = re.sub(r"\bassociation football players?\b", say("footballer"), text, flags=re.I)
    text = re.sub(r"\bassociation footballers?\b", say("footballer"), text, flags=re.I)
    return re.sub(r"\bassociation football\b", say("football"), text, flags=re.I)


def team(obj) -> dict | None:
    if not obj:
        return None
    return {
        "name": clean_label(obj.get("name")),
        "franchiseId": obj.get("franchiseId"),
        "teamSeasonId": obj.get("teamSeasonId"),
        "soccerTeamId": obj.get("soccerTeamId"),
        "countryCode": obj.get("countryCode"),
        "fifaCode": obj.get("fifaCode"),
        "flagCode": obj.get("flagCode"),
    }


def year_of(record: dict) -> str | None:
    event = record.get("eventDate") or ""
    if re.match(r"^\d{4}-", event):
        return event[:4]
    for key in ("draftYear", "seasonStartYear", "bornYear"):
        if record.get(key):
            return str(record[key])
    return None


def title_words(r) -> str:  # noqa: ANN001
    """"seven-time World Series winner" from the person's club titles, or ""."""
    try:
        n = int(r.get("championships") or 0)
    except (TypeError, ValueError):
        n = 0
    cup = (r.get("championshipName") or "").strip()
    if n and cup:
        return f"{cup} winner" if n == 1 else f"{NUMBER_WORD.get(n, str(n))}-time {cup} winner"
    return ""


def hall_words(r) -> str:  # noqa: ANN001
    """"Baseball Hall of Famer" for a person DS1 gives a hall of fame year, in the hall of his own sport."""
    hall = HALL.get(r.get("sport") or "")
    return f"{hall} Hall of Famer" if hall and r.get("hallOfFameYear") else ""


def honour_of(r) -> str:  # noqa: ANN001
    existing = (r.get("highlight") or "").strip()
    if existing:
        return existing
    hall = hall_words(r)
    n = r.get("championships") or 0
    cup = (r.get("championshipName") or "").strip()
    try:
        n = int(n)
    except (TypeError, ValueError):
        n = 0
    if hall and n and cup:
        return f"{hall} with {'a' if n == 1 else NUMBER_WORD.get(n, str(n))} {cup} {'title' if n == 1 else 'titles'}"
    if hall:
        return hall
    titles = title_words(r)
    if titles:
        return titles
    award = (r.get("personAward") or r.get("awardName") or "").strip()
    return f"{award} winner" if award else ""


def sport_slug(value: str | None) -> str | None:
    if not value:
        return None
    mapped = {
        "hockey": "ice-hockey", "ice_hockey": "ice-hockey",
        "american_football": "american-football", "canadian_football": "canadian-football",
        "motor_racing": "motor-racing", "formula_one": "formula-one",
        "stock_car_racing": "stock-car-racing", "motorcycle_racing": "motorcycle-racing",
        "sports_car_racing": "sports-car-racing", "horse_racing": "horse-racing",
        "alpine_skiing": "alpine-skiing", "mixed_martial_arts": "mma",
        "wheelchair_basketball": "wheelchair-basketball",
    }
    return mapped.get(value, value.replace("_", "-"))


def history_tags(row: dict) -> list[str]:
    """HISTORY_TYPES ids from held fields only. One fact, several tags; never invent."""
    tags: list[str] = []
    cat = row.get("category")
    hs, aws = row.get("homeScore"), row.get("awayScore")
    stage = str(row.get("stage") or "").lower()
    kind = str(row.get("awardKind") or "").lower()
    if cat in ("game-on-day", "championship-final", "soccer-on-day"):
        home, away = row.get("home") or {}, row.get("away") or {}
        if home.get("name") and away.get("name") and hs is not None and aws is not None:
            tags.append("match-result")
        if cat == "championship-final" or stage in {"final", "championship"}:
            tags.append("championship-win")
        if row.get("wentToOvertime") or row.get("decidedByShootout") or (row.get("overtimePeriods") or 0) > 0:
            tags.append("overtime-result")
        try:
            if hs is not None and aws is not None and min(int(hs), int(aws)) == 0 and max(int(hs), int(aws)) > 0:
                tags.append("shutout")
        except (TypeError, ValueError):
            pass
        if row.get("seriesGameNumber") == 1:
            tags.append("series-start")
        best, hi, lo = row.get("seriesBestOf"), row.get("seriesHigherWins"), row.get("seriesLowerWins")
        try:
            if best and hi is not None and lo is not None:
                need = int(best) // 2 + 1
                if int(hi) >= need or int(lo) >= need:
                    tags.append("series-clinch")
        except (TypeError, ValueError):
            pass
        if cat == "championship-final" and (row.get("seriesBestOf") or row.get("seriesGameNumber")):
            tags.append("historic-cup-series")
    if cat == "player-birthday":
        tags.append("player-birthday")
        if row.get("ageYears") is not None:
            tags.append("age-at-event")
    if cat == "player-death" and row.get("ageYears") is not None:
        tags.append("age-at-event")
    if cat == "draft":
        tags.append("draft-selection")
    if cat == "award":
        tags.append("award-honour")
        if "champion" in kind:
            tags.append("championship-win")
    if cat == "franchise-event":
        tags.append("franchise-identity-change")
    if cat == "venue-opening":
        tags.append("venue-history")
    if cat in ("competition-start", "competition-end", "sport-event"):
        tags.append("competition-boundary")  # a single-day event began and ended that day
    tags.extend(row.get("extraTags") or [])
    seen: set[str] = set()
    out: list[str] = []
    for tag in tags:
        if tag not in seen:
            seen.add(tag)
            out.append(tag)
    return out


FEATURE_MARGIN = {
    "ice-hockey": 6, "ice_hockey": 6, "hockey": 6,
    "soccer": 5,
    "baseball": 10,
    "basketball": 25,
    "american-football": 21, "american_football": 21,
    "canadian-football": 21, "canadian_football": 21,
}
SOCCER_FEATURE_STAGES = {"final", "semi", "quarter", "conference_final", "championship"}


def featured_reasons(row: dict) -> list[str]:
    """A game is featured only for these sourced reasons. Regular-season results are not listed on their own."""
    reasons: list[str] = []
    if row.get("record") or "sport-record" in (row.get("tags") or []):
        reasons.append("record")
    hs, aws = row.get("homeScore"), row.get("awayScore")
    if hs is None or aws is None:
        return reasons
    try:
        hs_i, aws_i = int(hs), int(aws)
    except (TypeError, ValueError):
        return reasons
    phase = str(row.get("phase") or "").lower()
    stage = str(row.get("stage") or "").lower()
    cat = row.get("category")
    playoffish = phase == "playoffs" or stage in SOCCER_FEATURE_STAGES or cat == "championship-final"
    if cat == "championship-final" or stage == "final":
        reasons.append("final")
    best, hi, lo = row.get("seriesBestOf"), row.get("seriesHigherWins"), row.get("seriesLowerWins")
    try:
        if best and hi is not None and lo is not None:
            need = int(best) // 2 + 1
            if int(hi) >= need or int(lo) >= need:
                reasons.append("clincher")
    except (TypeError, ValueError):
        pass
    if playoffish and (row.get("wentToOvertime") or row.get("decidedByShootout") or (row.get("overtimePeriods") or 0) > 0):
        reasons.append("playoff-overtime")
    if playoffish and min(hs_i, aws_i) == 0 and max(hs_i, aws_i) > 0:
        reasons.append("playoff-shutout")
    sport = sport_slug(row.get("sport")) or row.get("sport") or ""
    need_m = FEATURE_MARGIN.get(sport)
    if need_m and abs(hs_i - aws_i) >= need_m:
        reasons.append("big-margin")
    return reasons


def tag_set(row: dict) -> list[str]:
    """The kind of fact: the category and the history types. A namespaced tag (`country:RO`) says what a fact is about and has its own indexes."""
    seen: set[str] = set()
    out: list[str] = []
    for tag in [row.get("category"), *(row.get("tags") or [])]:
        if tag and ":" not in tag and tag not in seen:
            seen.add(tag)
            out.append(tag)
    return out


# A championship decided over several games. The tally is counted from the final round's own games in the extract and kept only when it
# agrees with the league's format: the series winner has exactly the wins that format needs, the loser fewer, and the games are the two
# clubs' alone. A series that does not agree (the extract holds an extra or a missing game) states no tally and is not worded as the title.
SERIES_LEAGUES = {"mlb", "nba"}


def series_wins_needed(league: str | None, season: int | None) -> int | None:
    """Wins that clinch the final round: the best-of-seven World Series and NBA Finals (best of nine in 1903 and 1919-21). None for a league whose format is not held here."""
    if league == "mlb":
        return 5 if season in (1903, 1919, 1920, 1921) else 4
    if league == "nba":
        return 4
    return None


def series_tally(games: list[dict], league: str | None, season: int | None) -> dict | None:
    """{seriesWinnerWins, seriesLoserWins, seriesGames} counted from every game of one final round, or None when the count does not agree with the format."""
    played = sorted(
        (g for g in games if (g.get("home") or {}).get("name") and (g.get("away") or {}).get("name")
         and g.get("homeScore") is not None and g.get("awayScore") is not None),
        key=lambda g: (g.get("eventDate") or "", g.get("gameId") or 0),
    )
    need = series_wins_needed(league, season)
    if need is None or len(played) < need:
        return None
    last = played[-1]
    if last["homeScore"] == last["awayScore"]:
        return None
    won, lost = (last["home"], last["away"]) if last["homeScore"] > last["awayScore"] else (last["away"], last["home"])
    wid, lid = won.get("franchiseId"), lost.get("franchiseId")
    if wid is None or lid is None or wid == lid:
        return None
    wins: dict = defaultdict(int)
    for g in played:
        if g["homeScore"] == g["awayScore"]:
            continue
        side = g["home"] if g["homeScore"] > g["awayScore"] else g["away"]
        wins[side.get("franchiseId")] += 1
    if set(wins) - {wid, lid} or any(
        g[side].get("franchiseId") not in (wid, lid) for g in played for side in ("home", "away")
    ):
        return None
    if wins[wid] != need or wins[lid] >= need:
        return None
    return {"seriesWinnerWins": wins[wid], "seriesLoserWins": wins[lid], "seriesGames": len(played)}


def final_context_fields(ctx: dict) -> dict:
    """The venue, the winner's regular-season record and the title number from extract_final_context.sql, each only when it is well formed.
    The sentence leaves out a clause whose field is missing, so a malformed value is dropped here rather than guessed."""
    out: dict = {}
    for key in ("venueName", "venueCity"):
        value = ctx.get(key)
        if isinstance(value, str) and value.strip():
            out[key] = value.strip()
    count = lambda v: isinstance(v, int) and not isinstance(v, bool) and v >= 0  # noqa: E731
    rec = ctx.get("winnerRecord")
    if isinstance(rec, dict) and count(rec.get("wins")) and count(rec.get("losses")):
        out["winnerRecord"] = {k: rec[k] for k in ("wins", "losses", "ties", "otLosses") if k in rec and count(rec[k])}
    number = ctx.get("winnerTitleNumber")
    if count(number) and number > 0:
        out["winnerTitleNumber"] = number
    return out


def finalize(row: dict) -> dict | None:
    """The fact as a shard row, without its sentence: the sentences are written by the library (see add_captions)."""
    source = source_of(row)
    if not source["url"]:
        return None
    basis = row.get("basis") or "source"
    out = {
        "recordId": row["recordId"],
        "category": row["category"],
        "tags": history_tags(row),
        "basis": basis,
        "eventDate": row.get("eventDate"),
        "datePrecision": row.get("datePrecision") or "day",
        "sport": LEAGUE_SPORT.get(str(row.get("league") or "").lower()) or sport_slug(row.get("sport")) or row.get("sport"),
        "competition": row.get("competition") or row.get("league"),
        "league": row.get("league"),
        "source": source,
    }
    if basis == "derived":
        if not row.get("derivedRule") or not row.get("derivedInputs"):
            return None
        out["derivedRule"] = row["derivedRule"]
        out["derivedInputs"] = list(row["derivedInputs"])
    for key in (
        "home", "away", "venueId", "venueName", "venueCity", "venueCountry", "gameId", "soccerMatchId",
        "seasonStartYear", "homeScore", "awayScore", "phase", "stage", "wentToOvertime",
        "decidedByShootout", "overtimePeriods", "seriesGameNumber", "roundLabel", "seriesBestOf",
        "seriesHigherWins", "seriesLowerWins", "seriesWinnerTeamSeasonId", "person", "position",
        "clubNames", "clubName", "bornYear", "ageYears", "highlight", "draftYear", "round",
        "overallPick", "awardName", "awardKind", "winnerName", "birthDate", "deathDate", "birthPlace", "livingStatus",
        "announcedDate", "awardDate", "ratifiedDate", "featuredReasons", "record",
        "sitelinks", "priorityAthlete", "nationality", "epithet", "eventLabel", "eventPlace",
        "championships", "championshipName", "personAward", "awardCount", "hallOfFameYear",
        "seriesWinnerWins", "seriesLoserWins", "seriesGames", "winnerRecord", "winnerTitleNumber", "awards",
    ):
        if row.get(key) not in (None, [], ""):
            out[key] = row[key]
    for key in ("epithet", "highlight"):
        if out.get(key):
            out[key] = plain_words(out[key])
    if out.get("clubName"):
        out["clubName"] = clean_label(out["clubName"])
    if out.get("clubNames"):
        out["clubNames"] = [n for n in (clean_label(n) for n in out["clubNames"]) if n]
    if out.get("home"):
        out["home"] = team(out["home"])
    if out.get("away"):
        out["away"] = team(out["away"])
    mark_disputed(out)
    attach_links(out)
    hint = trophy_hint(out)
    if hint:
        out["trophy"] = hint
    return out


def trophy_hint(out: dict) -> str | None:
    """The emblem that draws the trophy a fact is about (data-sources/trophies.json): the person's best award if dougu has that very trophy, else the title he won, else any
    award of his it has, else its plain cup; None for a fact about no award and no title. An id with a name is a likeness of that trophy, `trophy:cup` is generic."""
    awards = TROPHIES["awards"]
    best = slug_of_name(out["personAward"]) if out.get("personAward") else None
    if out.get("category") == "award" and out.get("awardName"):
        best = slug_of_name(out["awardName"])
    title = slug_of_name(out["championshipName"]) if (out.get("championships") or 0) > 0 and out.get("championshipName") else None
    ordered = [awards.get(best)] if best else []
    ordered += [TROPHIES["titles"].get(title)] if title else []
    ordered += [awards.get(slug) for slug in sorted(out.get("awards") or [])]
    exact = next((t for t in ordered if t), None)
    if exact:
        return exact
    return TROPHIES["generic"] if (out.get("awards") or title or best) else None


def attach_links(out: dict) -> None:
    """The Wikidata item a fact is about (its person, or its event), the item's Wikipedia titles, and, for a person, his countries, the one flag when it is
    unambiguous and his birth country; for an event, the countries it was held in. Only what the dump holds: a fact whose person has no Q id gets nothing."""
    qid = (out.get("person") or {}).get("qid")
    link = None
    if qid and QID.match(qid):
        link = LINKS["people"].get(qid)
        out["wikidata"] = qid
        if link:
            if link.get("c"):
                out["countries"] = list(link["c"])
            if link.get("f"):
                out["flag"] = link["f"]
            if link.get("b"):
                out["birthCountry"] = link["b"]
    elif out.get("category") in EVENT_CATEGORIES:
        event = (out.get("recordId") or "").split(":")[2:3]
        if event and QID.match(event[0]):
            qid = event[0]
            link = LINKS["events"].get(qid)
            out["wikidata"] = qid
            if link and link.get("e"):
                out["hostCountries"] = list(link["e"])
    if link and link.get("w"):
        out["wikipedia"] = {k: link["w"][k] for k in ("en", "fr", "ja") if link["w"].get(k)}


def add_captions(rows: list[dict]) -> list[dict]:
    """Say each fact with the library's own templates (scripts/caption-batch.ts): one source of wording, not a second copy here.

    A fact the templates cannot say from the fields it holds is dropped, as a fact without a sentence always was."""
    done = subprocess.run(
        ["node", str(ROOT / "scripts/caption-batch.ts")], input=json.dumps(rows, ensure_ascii=False),
        capture_output=True, text=True, check=False, cwd=ROOT,
    )
    if done.returncode != 0:
        raise SystemExit(f"caption-batch failed: {done.stderr}")
    said = json.loads(done.stdout)
    kept = []
    for row in rows:
        words = said.get(row["recordId"])
        if not words or not words.get("text"):
            continue
        row["text"] = words["text"]
        if words.get("textJa"):
            row["textJa"] = words["textJa"]
        if words.get("dateNote"):
            row["dateNote"] = words["dateNote"]
        if words.get("dateNoteJa"):
            row["dateNoteJa"] = words["dateNoteJa"]
        kept.append(row)
    return kept


def name_letters(name: str) -> set[str]:
    """The files a person is in: the first letter of the first word of his name and of the last (a to z, else `_`). The same rule as `nameLetters` in src/load.ts."""
    folded = "".join(c for c in unicodedata.normalize("NFKD", name) if not unicodedata.combining(c)).lower()
    words = re.findall(r"[^\W_]+", folded)
    out = set()
    for word in (words[0], words[-1]) if words else ("_",):
        out.add(word[0] if "a" <= word[0] <= "z" else "_")
    return out


def stamp_tags(rows: list[dict]) -> None:
    """Add each fact's namespaced tags (`country:RO`, `sport:handball`, `decade:1960s`, ...) to its `tags`, as the library's own `derivedTags` gives them
    (scripts/tags-batch.ts): the vocabulary is in src/tags.ts and nowhere here."""
    sent = {row["recordId"]: {k: row[k] for k in TAG_FIELDS if k in row} for row in rows}
    done = subprocess.run(
        ["node", str(ROOT / "scripts/tags-batch.ts")], input=json.dumps(sent, ensure_ascii=False),
        capture_output=True, text=True, check=False, cwd=ROOT,
    )
    if done.returncode != 0:
        raise SystemExit(f"tags-batch failed: {done.stderr}")
    tags = json.loads(done.stdout)
    for row in rows:
        row["tags"] = [*[t for t in row.get("tags") or [] if ":" not in t], *tags[row["recordId"]]]


def name_map(rows: list[dict], persons: list[dict] | None = None) -> dict[int, str]:
    votes: dict[tuple[int, str], int] = defaultdict(int)
    # A club no game names is named by a person who played for it alone: one franchise id and one club ("Gregg Popovich ... San Antonio Spurs (1996-2024)").
    for row in persons or []:
        ids = ((row.get("person") or {}).get("franchiseIds")) or []
        clubs = [n for n in (row.get("clubNames") or []) if n]
        if len(ids) == 1 and len(clubs) == 1:
            votes[(ids[0], re.sub(r"\s*\(\d{4}(?:[\u2013-]\d{4})?\)$", "", clubs[0]))] += 1
    for row in rows:
        for side in ("home", "away"):
            obj = row.get(side) or {}
            fid, name = obj.get("franchiseId"), obj.get("name")
            if fid is not None and name:
                votes[(fid, name)] += 1
        if row.get("category") == "rename-or-move" and row.get("franchiseId") and row.get("label"):
            votes[(row["franchiseId"], row["label"])] += 1
    best: dict[int, tuple[int, str]] = {}
    for (fid, name), n in votes.items():
        cur = best.get(fid)
        if cur is None or n > cur[0] or (n == cur[0] and name < cur[1]):
            best[fid] = (n, name)
    return {fid: name for fid, (_, name) in best.items()}


def shard(records: list[dict]) -> str:
    payload = {"schemaVersion": 1, "dataVersion": VERSION, "records": records}
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"


def write_shard(rel: str, records: list[dict], files: dict, allow_empty: bool = False) -> None:
    if not records and not allow_empty:
        return
    records = sorted(records, key=lambda r: (r.get("eventDate") or "", r["recordId"]))
    body = shard(records)
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    files[rel] = {"sha256": hashlib.sha256(body.encode()).hexdigest(), "bytes": len(body.encode()), "records": len(records)}


def load_priority_qids() -> set[str]:
    path = ROOT / "data-sources/priority-athletes.csv"
    qids: set[str] = set()
    if not path.exists():
        return qids
    with path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            qid = (row.get("qid") or "").strip()
            if qid.startswith("Q"):
                qids.add(qid)
    return qids


PRIORITY_QIDS = load_priority_qids()


def is_sport_person(row: dict) -> bool:
    """Publish deaths/birthdays of sourced athletes from 1850 on. Drop 1602-era non-athletes."""
    person = row.get("person") or {}
    qid = person.get("qid")
    if qid in BLOCKED_QIDS:
        return False
    year = year_of(row)
    if year:
        try:
            if int(year) < ERA_START:
                return False
        except ValueError:
            return False
    if row.get("sport") or row.get("league") or person.get("leagueCodes") or person.get("franchiseIds"):
        return True
    if qid and qid in PRIORITY_QIDS:
        return True
    return False


def person_key(row: dict) -> str | None:
    person = row.get("person") or {}
    if person.get("personId") is not None:
        return f"p:{person['personId']}"
    if person.get("qid"):
        return f"q:{person['qid']}"
    return None


def team_keys(row: dict) -> list[str]:
    keys = []
    for side in (row.get("home"), row.get("away")):
        if not side:
            continue
        if side.get("franchiseId") is not None:
            keys.append(f"f:{side['franchiseId']}")
        elif side.get("soccerTeamId"):
            keys.append(f"s:{side['soccerTeamId']}")
    for fid in (row.get("person") or {}).get("franchiseIds") or []:
        keys.append(f"f:{fid}")
    return keys


def event_merge_key(row: dict) -> str | None:
    date = row.get("eventDate")
    if not date:
        return None
    if row.get("gameId") is not None:
        return f"game:{row['gameId']}"
    if row.get("soccerMatchId") is not None:
        return f"soccer:{row['soccerMatchId']}"
    person = row.get("person") or {}
    ident = person.get("personId") if person.get("personId") is not None else person.get("qid")
    cat = row.get("category")
    if ident and cat in {"player-death", "player-birthday", "award", "draft"}:
        return f"{cat}:{ident}:{date}"
    home = (row.get("home") or {}).get("name")
    away = (row.get("away") or {}).get("name")
    if home and away and cat in {"game-on-day", "championship-final", "soccer-on-day"}:
        teams = "|".join(sorted(n.lower() for n in (home, away) if n))
        comp = row.get("competition") or row.get("league") or ""
        return f"{date}|{comp}|{teams}"
    return None


def merge_same_event(chosen: dict[str, dict]) -> tuple[dict[str, dict], int]:
    """One fact, many tags. Same game, soccer match, person-day, or teams+date+competition."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for rec in chosen.values():
        key = event_merge_key(rec)
        if key:
            groups[key].append(rec)
    merged = 0
    out = dict(chosen)
    for rows in groups.values():
        if len(rows) < 2:
            continue
        rows.sort(key=lambda r: (r.get("category") != "championship-final", r["recordId"]))
        keeper = dict(rows[0])
        tags = list(keeper.get("tags") or [])
        reasons = list(keeper.get("featuredReasons") or [])
        for extra in rows[1:]:
            for tag in extra.get("tags") or []:
                if tag not in tags:
                    tags.append(tag)
            for reason in extra.get("featuredReasons") or []:
                if reason not in reasons:
                    reasons.append(reason)
            out.pop(extra["recordId"], None)
            merged += 1
        keeper["tags"] = tags
        if reasons:
            keeper["featuredReasons"] = reasons
        out.pop(rows[0]["recordId"], None)
        out[keeper["recordId"]] = keeper
    return out, merged


RANK_FIELDS = (
    "recordId", "category", "tags", "eventDate", "competition", "league", "sport", "person", "home", "away", "featuredReasons", "winnerName",
    "stage", "phase", "priorityAthlete", "personAward", "awardCount", "hallOfFameYear", "highlight", "championships", "sitelinks", "record",
)


def rank_lists(facts_by_id: dict, specs: list[dict]) -> dict[str, list[str]]:
    """Rank every feed with the library's own ranking (scripts/rank-batch.ts): one significance, one set of caps, none here."""
    used = {rid for spec in specs for rid in spec["ids"]}
    records = {rid: {k: facts_by_id[rid][k] for k in RANK_FIELDS if k in facts_by_id[rid]} for rid in used}
    done = subprocess.run(
        ["node", str(ROOT / "scripts/rank-batch.ts")], input=json.dumps({"records": records, "lists": specs}, ensure_ascii=False),
        capture_output=True, text=True, check=False, cwd=ROOT,
    )
    if done.returncode != 0:
        raise SystemExit(f"rank-batch failed: {done.stderr}")
    return json.loads(done.stdout)


def write_index(rel: str, ids: list[str], files: dict) -> None:
    uniq = sorted(set(ids))
    payload = {"schemaVersion": 1, "dataVersion": VERSION, "ids": uniq}
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    files[rel] = {"sha256": hashlib.sha256(body.encode()).hexdigest(), "bytes": len(body.encode()), "records": len(uniq)}


def store_bucket(record_id: str) -> str:
    return f"{int(hashlib.sha256(record_id.encode()).hexdigest()[:4], 16) % 100:02d}"


def shuffle(records: list[dict], seed: str) -> list[dict]:
    copy = records[:]
    h = 2166136261
    for ch in seed:
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    state = h or 1
    for i in range(len(copy) - 1, 0, -1):
        state = (state ^ (state >> 15)) & 0xFFFFFFFF
        state = (state * (1 | state)) & 0xFFFFFFFF
        j = state % (i + 1)
        copy[i], copy[j] = copy[j], copy[i]
    return copy


def person_record(row: dict, context: dict, awards_by_person: dict, person_awards: dict, names: dict, priority: dict) -> dict:
    """A birthday or death row with the career context that is really the person's: his clubs (rosters and statistics), his own best award,
    his club titles and his Hall of Fame year. The extract's own `personAward` is dropped: see main()."""
    person = dict(row.get("person") or {})
    pid, qid = person.get("personId"), person.get("qid")
    ctx = context.get(pid) or {}
    rec = {k: v for k, v in row.items() if k not in ("personAward", "awardCount")}
    if ctx:
        cp = ctx.get("person") or {}
        for key in ("leagueCodes", "franchiseIds", "teamSeasonIds"):
            if cp.get(key):
                person[key] = cp[key]
        rec["person"] = person
        for key in ("championships", "championshipName"):
            rec[key] = ctx.get(key)
        if ctx.get("clubNames"):
            rec["clubNames"] = ctx["clubNames"]
        if ctx.get("hallOfFameYear"):
            rec["hallOfFameYear"] = ctx["hallOfFameYear"]
        if not rec.get("league") and len(person.get("leagueCodes") or []) == 1:
            rec["league"] = person["leagueCodes"][0]
    extract_clubs = [n for n in (rec.get("clubNames") or []) if n]
    rec["clubNames"] = extract_clubs or [names[i] for i in (person.get("franchiseIds") or []) if i in names]
    league = str(rec.get("league") or "").lower()
    rec["sport"] = LEAGUE_SPORT.get(league) or sport_slug(rec.get("sport")) or rec.get("sport")
    if rec.get("position") in (None, ""):
        rec.pop("position", None)
    award = awards_by_person.get(pid)
    if award:
        rec["personAward"] = award
    own = ctx.get("awardCount") or len(person_awards.get(pid) or [])
    if own:
        rec["awardCount"] = own
    ids = sorted({slug_of_name(a["name"]) for a in person_awards.get(pid) or [] if a.get("name")} - {""})
    for a in person_awards.get(pid) or []:
        if a.get("name") and slug_of_name(a["name"]):
            AWARD_NAMES.setdefault(slug_of_name(a["name"]), a["name"])
    if ids:
        rec["awards"] = ids
    info = priority.get(qid) or {}
    for key in ("sitelinks", "hallOfFameYear"):
        if info.get(key) and not rec.get(key):
            rec[key] = info[key]
    return rec


def give_honour(rec: dict, priority: dict) -> None:
    """Set `highlight`: the career honour the facts hold, else (for a priority person with no club or position) his Wikidata description."""
    honour = honour_of(rec)
    if not honour:
        info = priority.get((rec.get("person") or {}).get("qid")) or {}
        if info.get("highlight") and not rec.get("position") and not rec.get("clubNames"):
            honour = info["highlight"]
    if honour:
        rec["highlight"] = honour


PRIORITY_SEED = ROOT / "pipeline/ds1-people/spx-stats/db/seed"
MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def states_date(text: str, iso: str) -> bool:
    """Whether a Wikipedia lead says the day in words ("1 January 1863" or "January 1, 1863")."""
    y, m, d = (int(x) for x in iso.split("-"))
    flat = re.sub(r"\s+", " ", (text or "").replace("\u00a0", " "))
    return f"{d} {MONTH_NAMES[m - 1]} {y}" in flat or f"{MONTH_NAMES[m - 1]} {d}, {y}" in flat


def priority_rows(taken: dict[tuple[str, str, str], str]) -> list[dict]:
    """Birthdays and deaths of the priority athletes (data-sources/priority-facts.jsonl, built by pipeline/facts_from_priority.py from Wikidata, CC0),
    as converter rows. The file's own sentences are not used: the library words every fact. What it adds is people DS1 has no club season for
    (boxing, tennis, athletics, wrestling, golf, soccer, cricket and the rest) and fame (sitelinks, a Wikidata description, a Hall of Fame year).

    Left out: a fact the extract already holds (same person, kind and day: the DS1 row keeps its clubs), a para or deaflympic sport (John's rule),
    a sport that is not one (stunts, entertainment), a person with nothing sayable beyond name and year, and a birth or death on 1 January that
    English Wikipedia's lead does not state in words (Wikidata alone cannot tell a real 1 January from a year-only date written as one)."""
    path = ROOT / "data-sources/priority-facts.jsonl"
    if not path.exists():
        return []
    def table(name: str) -> dict[str, dict]:
        file = PRIORITY_SEED / name
        if not file.exists():
            return {}
        with file.open(newline="", encoding="utf-8") as fh:
            return {r["qid"]: r for r in csv.DictReader(fh)}
    bios, pages = table("wikidata_meigen_bio.csv"), table("wikidata_meigen_wiki_page.csv")
    out: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        cat = r.get("category")
        if cat not in ("player-birthday", "player-death") or r.get("datePrecision") != "day" or not r.get("eventDate"):
            continue
        person = r.get("person") or {}
        qid, name = person.get("qid"), person.get("name")
        raw_sport = r.get("sport") or ""
        if not qid or not name or PARA_SPORT.match(raw_sport) or raw_sport in NOT_A_SPORT:
            continue
        day = r["eventDate"]
        if (cat, qid, day) in taken:
            continue
        bio = bios.get(qid, {})
        if day.endswith("-01-01") and not states_date((pages.get(qid) or {}).get("lead_text", ""), day):
            continue
        sport = sport_slug(raw_sport)
        row = {
            "recordId": r["recordId"], "category": cat, "eventDate": day, "datePrecision": "day", "sport": sport, "league": None,
            "competition": None, "person": {"personId": None, "qid": qid, "name": name, "leagueCodes": [], "franchiseIds": [], "teamSeasonIds": []},
            "sourceId": "wikidata", "licence": "CC0 1.0", "attribution": "Wikidata contributors, CC0.", "sourceUrl": f"https://www.wikidata.org/wiki/{qid}",
            "priorityAthlete": True, "birthPlace": r.get("birthPlace"),
        }
        if bio.get("sitelinks", "").isdigit():
            row["sitelinks"] = int(bio["sitelinks"])
        if (bio.get("hof_year") or "").isdigit():
            row["hallOfFameYear"] = int(bio["hof_year"])
        description = short_description(bio.get("description_en"))
        if description:
            row["highlight"] = description
        if cat == "player-birthday":
            row["birthDate"] = day
            row["deathDate"] = r.get("deathDate")
            row["livingStatus"] = "deceased" if r.get("deathDate") else "unknown"
        else:
            row["deathDate"] = day
            row["livingStatus"] = "deceased"
            born = r.get("birthDate")
            if born and re.match(r"^\d{4}-\d{2}-\d{2}$", born):
                by, bm, bd = map(int, born.split("-"))
                dy, dm, dd = map(int, day.split("-"))
                row.update({
                    "birthDate": born, "bornYear": by, "ageYears": dy - by - (1 if (dm, dd) < (bm, bd) else 0),
                    "derivedRule": "Completed years from sourced birthDate to sourced death eventDate (last birthday before death).",
                    "derivedInputs": ["birthDate", "eventDate"],
                })
        out.append(row)
    return out


def load_dump_people() -> tuple[list[dict], dict, dict[str, int], dict[str, str]]:
    """Births and deaths of sports people from the Wikidata dump (pipeline/wikidata_dump_people.py): the rows, the dump's provenance, and the
    edition count of every person in the filtered file who has at least three (the fame the package ranks by), and the phrase built for a person whose own
    description is not fit to show. Empty when the extract is absent."""
    path = EXTRACT / "extract_wikidata_dump_people.json"
    if not path.exists():
        print(f"missing {path}", file=sys.stderr)
        return [], {}, {}, {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("records") or [], data.get("meta") or {}, data.get("sitelinks") or {}, data.get("builtPhrases") or {}


def add_dump_people(chosen: dict[str, dict], rows: list[dict]) -> int:
    """Add the dump's births and deaths of people the package does not already hold for that kind (a person with a birthday fact from DS1,
    the priority list or an earlier extract keeps it). The rows come with their words and Q id; nothing is worded here."""
    held = {(rec.get("category"), (rec.get("person") or {}).get("qid")) for rec in chosen.values() if rec.get("category") in ("player-birthday", "player-death")}
    added = 0
    for row in rows:
        qid = (row.get("person") or {}).get("qid")
        if not qid or qid in BLOCKED_QIDS or (row["category"], qid) in held:
            continue
        rec = {**row, "basis": "source", "clubNames": []}
        rec["sport"] = sport_slug(rec.get("sport"))
        if not is_sport_person(rec):
            continue
        chosen[row["recordId"]] = rec
        held.add((row["category"], qid))
        added += 1
    return added


def load_dump_events() -> tuple[list[dict], dict]:
    """Events and competition editions from the Wikidata dump (pipeline/wikidata_dump_events.py): the rows and the dump's provenance. Empty when the extract is absent."""
    path = EXTRACT / "extract_wikidata_dump_events.json"
    if not path.exists():
        print(f"missing {path}", file=sys.stderr)
        return [], {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("records") or [], data.get("meta") or {}


def add_dump_events(chosen: dict[str, dict], rows: list[dict]) -> int:
    """Add the dump's events: each with the Q id of its item in its record id, its name, its place and its winner as Wikidata states them."""
    added = 0
    for row in rows:
        if row["recordId"] in chosen or row["category"] not in EVENT_CATEGORIES or not row.get("eventLabel"):
            continue
        rec = {k: v for k, v in row.items() if k != "entityId"}
        rec["sport"] = sport_slug(rec.get("sport"))
        chosen[row["recordId"]] = rec
        added += 1
    return added


def main() -> int:
    if not EXTRACT.is_dir():
        print(f"EXTRACT dir missing: {EXTRACT}", file=sys.stderr)
        return 1
    LINKS.update(load_links())
    DISPUTED.update(load_disputed())
    games = [r for r in load_records("extract_games_on_day.json") if allowed(r) and r.get("status") == "final"]
    finals = [r for r in load_records("extract_finals.json") if allowed(r)]
    soccer = [r for r in load_records("extract_soccer_on_day.json") if allowed(r)]
    birthdays = load_records("player-birthday-candidates.json")
    deaths = load_records("extract_deaths.json")
    awards = [r for r in load_records("extract_awards_season.json") if allowed(r)]
    venues = load_records("extract_venue_openings.json")
    franchise = [r for r in load_records("extract_franchise_events.json") if allowed(r)]
    drafts = [r for r in load_records("extract_drafts.json") if allowed(r)]
    names = name_map(games + finals + franchise)
    for extra in ("extract_wikidata_famous.json",):
        for row in load_records(extra):
            if not allowed(row):
                continue
            cat = row.get("category")
            if cat in {"player-birthday", "wikidata-birthday"}:
                birthdays.append({**row, "category": "player-birthday"})
            elif cat in {"player-death", "wikidata-death"}:
                deaths.append({**row, "category": "player-death"})
            elif cat in {"award", "wikidata-award"}:
                awards.append({**row, "category": "award"})
    # Individual awards belong to the person a row names. A person's own awards come from the awards extract (rows that name him) and
    # from the person-context extract (core.award_winner.person_id), never from the birthday and death extracts' `personAward`: those were
    # read through the team-season, so every teammate of a Cy Young winner carried a Cy Young Award (148 published facts, 0.6.0).
    context = {r["person"]["personId"]: r for r in load_records("extract_person_context.json") if (r.get("person") or {}).get("personId")}
    person_awards: dict[int, list[dict]] = defaultdict(list)
    for row in awards:
        person = row.get("person") or {}
        if person.get("personId") and row.get("awardName") and row.get("awardKind", "person_award") == "person_award":
            person_awards[person["personId"]].append({"name": row["awardName"], "year": row.get("seasonStartYear")})
    for pid, ctx in context.items():
        if ctx.get("awards"):
            person_awards[pid] = [{"name": a.get("name"), "year": a.get("year")} for a in ctx["awards"]]
    priority_info = {r["person"]["qid"]: r for r in priority_rows({})}
    awards_by_person = {pid: best_award(rows) for pid, rows in person_awards.items() if best_award(rows)}
    birth_by_id = {((r.get("person") or {}).get("personId")): r for r in birthdays if (r.get("person") or {}).get("personId")}
    death_by_id = {((r.get("person") or {}).get("personId")): r for r in deaths if (r.get("person") or {}).get("personId")}
    death_by_qid = {((r.get("person") or {}).get("qid")): r for r in deaths if (r.get("person") or {}).get("qid")}
    death_ids = set(death_by_id)

    chosen: dict[str, dict] = {}
    for row in games:
        if not ((row.get("home") or {}).get("name") and (row.get("away") or {}).get("name") and row.get("homeScore") is not None):
            continue
        rec = {**row, "category": "game-on-day"}
        reasons = featured_reasons(rec)
        if not reasons:
            continue
        rec["featuredReasons"] = reasons
        rec["basis"] = "source"
        chosen[row["recordId"]] = rec
    # The extract lists every game of each final round. Only the last game of a round is the one that
    # the title; the earlier games are playoff games of that round and must not be called the title game.
    # pipeline/golden/finals-check.json holds what English Wikipedia says about each MLB and NBA title series; a season
    # where the extract's last game is not that series' last game (seven NBA seasons) names no title game at all.
    checks = json.loads((ROOT / "pipeline/golden/finals-check.json").read_text(encoding="utf-8"))["seasons"]
    clinchers: dict[tuple, str] = {}
    for row in finals:
        if not ((row.get("home") or {}).get("name") and row.get("homeScore") is not None):
            continue
        key = (row.get("league"), row.get("seasonStartYear"))
        order = (row.get("eventDate") or "", row.get("gameId") or 0)
        if key not in clinchers or order > clinchers[key][0]:
            clinchers[key] = (order, row["recordId"])
    rounds: dict[tuple, list] = defaultdict(list)
    for row in finals:
        rounds[(row.get("league"), row.get("seasonStartYear"))].append(row)
    # What the archive holds beyond the game itself, per title game (extract_final_context.sql): the winner's regular-season record, which
    # title this was for its franchise (only where the archive's list of that league's champions is complete) and the venue's name and city.
    final_context = {r["gameId"]: r for r in load_records("extract_final_context.json") if r.get("gameId") is not None}
    for row in finals:
        if not ((row.get("home") or {}).get("name") and row.get("homeScore") is not None):
            continue
        check = checks.get(f"{row.get('league')}:{row.get('seasonStartYear')}")
        key = (row.get("league"), row.get("seasonStartYear"))
        # The final round of these leagues is a series. Only games of an allowed source are counted, so a season whose games are partly
        # SPX's own (not published) cannot add up to its format and is not worded as a title either.
        multi = row.get("league") in SERIES_LEAGUES
        tally = series_tally(rounds[key], row.get("league"), row.get("seasonStartYear")) if multi else None
        if check and not check["agrees"]:
            rec = {**row, "category": "game-on-day"}
            rec["featuredReasons"] = featured_reasons(rec) or ["playoffs"]
        elif clinchers[key][1] == row["recordId"] and multi and tally is None:
            # A series whose games do not add up to its format is not worded as the title: its last game is an ordinary playoff game.
            rec = {**row, "category": "game-on-day"}
            rec["featuredReasons"] = featured_reasons(rec) or ["playoffs"]
        elif clinchers[key][1] == row["recordId"]:
            rec = {**row, "category": "championship-final", **(tally or {})}
            rec.update(final_context_fields(final_context.get(row.get("gameId")) or {}))
            rec["featuredReasons"] = featured_reasons(rec) or ["final"]
        else:
            rec = {**row, "category": "game-on-day"}
            rec["featuredReasons"] = featured_reasons(rec) or ["playoffs"]
        rec["basis"] = "source"
        gid = row.get("gameId")
        if gid is not None:
            chosen.pop(f"spx:game:{gid}", None)
        chosen[row["recordId"]] = rec
    for row in soccer:
        if not ((row.get("home") or {}).get("name") and row.get("homeScore") is not None):
            continue
        rec = {**row, "category": "soccer-on-day"}
        reasons = featured_reasons(rec)
        if not reasons:
            continue
        rec["featuredReasons"] = reasons
        rec["basis"] = "source"
        chosen[row["recordId"]] = rec
    for row in birthdays:
        person = row.get("person") or {}
        if not person.get("name") or not row.get("eventDate"):
            continue
        rec = person_record(row, context, awards_by_person, person_awards, names, priority_info)
        rec.update({"category": "player-birthday", "basis": "source", "birthDate": row.get("eventDate")})
        pid = person.get("personId")
        qid = person.get("qid")
        dead = (pid in death_ids) or (qid in death_by_qid)
        rec["livingStatus"] = "deceased" if dead else "unknown"
        drow = (pid and death_by_id.get(pid)) or (qid and death_by_qid.get(qid)) or None
        if drow and drow.get("eventDate"):
            rec["deathDate"] = drow["eventDate"]
        give_honour(rec, priority_info)
        if qid and qid in PRIORITY_QIDS:
            rec["priorityAthlete"] = True
        if not is_sport_person(rec):
            continue
        chosen[row["recordId"]] = rec
    for row in deaths:
        person = row.get("person") or {}
        if not person.get("name") or not row.get("eventDate"):
            continue
        rec = person_record(row, context, awards_by_person, person_awards, names, priority_info)
        rec.update({"category": "player-death", "basis": "source", "livingStatus": "deceased"})
        pid = person.get("personId")
        born = birth_by_id.get(pid)
        if born and born.get("eventDate") and row.get("eventDate"):
            by, bm, bd = map(int, born["eventDate"].split("-"))
            dy, dm, dd = map(int, row["eventDate"].split("-"))
            rec["ageYears"] = dy - by - (1 if (dm, dd) < (bm, bd) else 0)
            rec["bornYear"] = by
            rec["birthDate"] = born["eventDate"]
            rec["derivedRule"] = "Completed years from sourced birthDate to sourced death eventDate (last birthday before death)."
            rec["derivedInputs"] = ["birthDate", "eventDate"]
        give_honour(rec, priority_info)
        qid = person.get("qid")
        if qid and qid in PRIORITY_QIDS:
            rec["priorityAthlete"] = True
        if not is_sport_person(rec):
            continue
        chosen[row["recordId"]] = rec
    taken: dict[tuple[str, str, str], str] = {}
    for rec in chosen.values():
        q = (rec.get("person") or {}).get("qid")
        if q and rec.get("category") in ("player-birthday", "player-death"):
            taken[(rec["category"], q, rec["eventDate"])] = rec["recordId"]
    priority_added = 0
    for row in priority_rows(taken):
        rec = {**row, "basis": "source", "clubNames": []}
        rec["sport"] = sport_slug(rec.get("sport"))
        if hall_words(rec):
            rec["highlight"] = hall_words(rec)
        if not rec.get("highlight"):
            continue
        if not is_sport_person(rec):
            continue
        chosen[row["recordId"]] = rec
        priority_added += 1
    dump_rows, dump_meta, dump_sitelinks, dump_phrases = load_dump_people()
    dump_added = add_dump_people(chosen, dump_rows)
    # A priority person's phrase is his Wikidata description. Where the description is not fit to show (a misspelling: "associaton fooball player")
    # the phrase built from his occupation and country takes its place; an honour ("Baseball Hall of Famer") stays.
    rephrased = 0
    for rec in chosen.values():
        qid = (rec.get("person") or {}).get("qid")
        if rec.get("priorityAthlete") and qid in dump_phrases and rec.get("highlight") and "Hall of Famer" not in rec["highlight"] and rec["highlight"] != dump_phrases[qid]:
            rec["highlight"] = dump_phrases[qid]
            rephrased += 1
    event_rows, event_meta = load_dump_events()
    events_added = add_dump_events(chosen, event_rows)
    for row in awards:
        if not row.get("eventDate") or not (row.get("winnerName") or (row.get("person") or {}).get("name")) or not row.get("awardName"):
            continue
        chosen[row["recordId"]] = {**row, "category": "award", "basis": "source", "awardDate": row.get("eventDate")}
    for row in venues:
        name = row.get("displayName")
        if not name or not row.get("eventDate"):
            continue
        rec = {**row, "category": "venue-opening", "venueName": name, "basis": "source"}
        if row.get("clubNames"):
            rec["clubNames"] = [n for n in row["clubNames"] if n]
        if row.get("highlight"):
            rec["highlight"] = row["highlight"]
        if row.get("venueCity"):
            rec["venueCity"] = row["venueCity"]
        chosen[row["recordId"]] = rec
    for row in franchise:
        if row.get("category") != "rename-or-move":
            continue
        # Jan 1, Mar 1 and Jul 1 are where the source puts an identity it dates only by year or season: no real day.
        if (row.get("eventDate") or "").endswith(("-01-01", "-03-01", "-07-01")):
            continue
        label = (row.get("label") or "").strip()
        if not label or label.lower() in {"mlb", "nhl", "nba", "nfl", "cfl"}:
            continue
        rec = {**row, "category": "franchise-event", "clubName": label, "basis": "source"}
        if row.get("venueCity"):
            rec["venueCity"] = row["venueCity"]
        chosen[row["recordId"]] = rec
    for row in drafts:
        person = row.get("person") or {}
        if not person.get("name") or not row.get("draftYear"):
            continue
        chosen[row["recordId"]] = {**row, "category": "draft", "basis": "source"}
    for row in load_records("extract_nhl_career_records.json"):
        if not allowed(row):
            continue
        rec = {**row, "category": row.get("category") or "milestone", "basis": "derived"}
        if not rec.get("derivedRule") or not rec.get("derivedInputs"):
            continue
        chosen[rec["recordId"]] = rec

    # The bug that gave 148 non-pitchers a Cy Young Award: an award on a fact must be one of that person's own, by the row that names him.
    for rec in chosen.values():
        award, pid = rec.get("personAward"), (rec.get("person") or {}).get("personId")
        if award and award not in {a.get("name") for a in person_awards.get(pid, [])}:
            raise SystemExit(f"{rec['recordId']}: personAward {award!r} is not one of person {pid}'s own awards")
    shaped = [done for done in (finalize(row) for row in chosen.values()) if done]
    facts = add_captions(shaped)
    dropped = len(chosen) - len(facts)
    by_id = {row["recordId"]: row for row in facts}
    by_id, merged_events = merge_same_event(by_id)
    facts = list(by_id.values())
    stamp_tags(facts)

    if OUT.exists():
        for old in OUT.rglob("*.json"):
            old.unlink()
    files: dict = {}
    by_day, by_sport, by_league, by_cat = defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list)
    by_team, by_fifa, by_player = defaultdict(list), defaultdict(list), defaultdict(list)
    teams_index, players_index = {}, {}
    picker_names = name_map(games + finals + franchise, [r for r in facts if r.get("person")])
    for row in facts:
        day = (row.get("eventDate") or "")[5:]
        if day:
            by_day[day].append(row)
        if row.get("sport"):
            by_sport[row["sport"]].append(row)
        if row.get("league"):
            by_league[row["league"]].append(row)
        for tag in tag_set(row):
            by_cat[tag].append(row)
        for side in (row.get("home"), row.get("away")):
            if not side:
                continue
            if side.get("franchiseId"):
                by_team[side["franchiseId"]].append(row)
                teams_index[side["franchiseId"]] = {
                    "franchiseId": side["franchiseId"], "name": side.get("name"),
                    "sport": row.get("sport"), "league": row.get("league"),
                }
            if side.get("fifaCode"):
                by_fifa[side["fifaCode"]].append(row)
        person = row.get("person") or {}
        if person.get("personId"):
            bucket = f"{person['personId'] % 100:02d}"
            by_player[bucket].append(row)
            players_index[person["personId"]] = {
                "personId": person["personId"], "qid": person.get("qid"),
                "name": person.get("name"), "leagueCodes": person.get("leagueCodes") or [],
            }
        for fid in person.get("franchiseIds") or []:
            by_team[fid].append(row)
            if fid not in teams_index:
                teams_index[fid] = {"franchiseId": fid, "name": picker_names.get(fid), "sport": row.get("sport"), "league": row.get("league")}

    calendar = [(date(2024, 1, 1) + timedelta(days=i)).strftime("%m-%d") for i in range(366)]
    covered = sorted(d for d in by_day if by_day[d])
    by_store: dict[str, list] = defaultdict(list)
    for row in facts:
        by_store[store_bucket(row["recordId"])].append(row)
    for bucket, rows in by_store.items():
        write_shard(f"store/{bucket}.json", list({r["recordId"]: r for r in rows}.values()), files)
    def uniq_of(rows: list[dict]) -> list[dict]:
        return list({r["recordId"]: r for r in rows}.values())

    def competitions(rows: list[dict]) -> list[str]:
        return sorted({f"competition:{r.get('competition') or r.get('league') or r.get('category')}" for r in rows})

    def tags_in(rows: list[dict]) -> list[str]:
        return sorted({t for r in rows for t in tag_set(r)})

    def clubs_in(rows: list[dict]) -> list[str]:
        return sorted({f"f:{i}" for r in rows for i in ((r.get("person") or {}).get("franchiseIds") or [])}
                      | {f"f:{t['franchiseId']}" for r in rows for t in (r.get("home"), r.get("away")) if t and t.get("franchiseId")})

    # Every list is ranked by the library (scripts/rank-batch.ts). A day's list is the mixed kind: at most two facts of a tag and two
    # of a competition and three of a sport (`rankDay`). A feed about one thing (a sport, league, tag, club or a bucket of people) is deeper, with at most eight of
    # a tag or competition, and is never capped on what it is about: a tag feed does not cap its tag, a league feed its league,
    # a team feed its club; a player bucket lists each person up to twice and caps nothing else.
    specs: list[dict] = []
    for day in calendar:
        rows = uniq_of(by_day.get(day, []))
        specs.append({"key": f"day:{day}", "ids": [r["recordId"] for r in rows], "n": 12, "day": True})
    for sport, rows in by_sport.items():
        rows = uniq_of(rows)
        specs.append({"key": f"sport:{sport}", "ids": [r["recordId"] for r in rows], "n": 40, "options": {"maxPer": 8, "exempt": competitions(rows)}})
    for league, rows in by_league.items():
        rows = uniq_of(rows)
        specs.append({"key": f"league:{league}", "ids": [r["recordId"] for r in rows], "n": 40, "options": {"maxPer": 8, "exempt": competitions(rows)}})
    for cat, rows in by_cat.items():
        rows = uniq_of(rows)
        specs.append({"key": f"tag:{cat}", "ids": [r["recordId"] for r in rows], "n": 40, "options": {"maxPer": 8, "exempt": [cat]}})
    by_namespace: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for row in facts:
        for tag in row.get("tags") or []:
            if ":" in tag:
                namespace, value = tag.split(":", 1)
                by_namespace[namespace][value].append(row)
    for code, rows in by_namespace["country"].items():
        rows = uniq_of(rows)
        # A country's people are births and deaths in a hundred sports: sixteen of a kind, so the forty reach into games, events and venues too.
        specs.append({"key": f"country:{code}", "ids": [r["recordId"] for r in rows], "n": 40, "options": {"maxPer": 16, "exempt": [*competitions(rows)]}})
    for fid, rows in by_team.items():
        rows = uniq_of(rows)
        specs.append({"key": f"team:{fid}", "ids": [r["recordId"] for r in rows], "n": 40, "options": {"maxPer": 8, "exempt": [f"f:{fid}", *competitions(rows)]}})
    for bucket, rows in by_player.items():
        rows = uniq_of(rows)
        specs.append({"key": f"player:{bucket}", "ids": [r["recordId"] for r in rows], "n": 40, "options": {"personMax": 2, "exempt": [*tags_in(rows), *competitions(rows), *clubs_in(rows)]}})
    # The people of a day, across sports: births and deaths only, at most three of one sport, so a day lists footballers, runners, boxers and
    # skaters and not only the five leagues. The day's own list (`days/`) is mixed and holds two births and two deaths at most.
    people_by_day: dict[str, list[dict]] = defaultdict(list)
    for row in facts:
        if row.get("category") in ("player-birthday", "player-death") and row.get("eventDate"):
            people_by_day[row["eventDate"][5:]].append(row)
    for day in calendar:
        rows = uniq_of(people_by_day.get(day, []))
        specs.append({"key": f"people:{day}", "ids": [r["recordId"] for r in rows], "n": PEOPLE_DAY, "options": {"maxPer": PEOPLE_DAY, "personMax": 1, "maxPerSport": 3}})
    events_by_day: dict[str, list[dict]] = defaultdict(list)
    for row in facts:
        if row.get("category") in EVENT_CATEGORIES and row.get("eventDate"):
            events_by_day[row["eventDate"][5:]].append(row)
    for day in calendar:
        rows = uniq_of(events_by_day.get(day, []))
        specs.append({"key": f"events:{day}", "ids": [r["recordId"] for r in rows], "n": EVENTS_DAY, "options": {"maxPer": EVENTS_DAY, "personMax": 1, "maxPerSport": 3}})
    deaths = [r["recordId"] for r in facts if r.get("category") == "player-death"]
    specs.append({"key": "showcase-deaths", "ids": deaths, "n": 8})
    specs.append({"key": "sample", "ids": [r["recordId"] for r in shuffle(facts, "meigen-sample-0.1.0")], "n": 400, "options": {"maxPer": 60, "personMax": 1, "minimum": 400}})
    by_id_all = {r["recordId"]: r for r in facts}
    ranked = rank_lists(by_id_all, specs)
    feed_of = lambda key: [by_id_all[rid] for rid in ranked[key]]  # noqa: E731
    days_lt3 = []
    for day in calendar:
        rows = uniq_of(by_day.get(day, []))
        feed = feed_of(f"day:{day}")
        feed_ids = [r["recordId"] for r in feed]
        if len(feed_ids) != len(set(feed_ids)):
            print(f"duplicate fact id in days/{day}.json", file=sys.stderr)
            return 1
        if len(feed) < 3:
            days_lt3.append(day)
        write_shard(f"days/{day}.json", feed, files, allow_empty=True)
        write_index(f"indexes/days/{day}.json", [r["recordId"] for r in rows], files)
    for day in calendar:
        write_shard(f"people/{day}.json", feed_of(f"people:{day}"), files, allow_empty=True)
        write_shard(f"events/{day}.json", feed_of(f"events:{day}"), files, allow_empty=True)
    for sport, rows in by_sport.items():
        write_index(f"indexes/sports/{sport}.json", [r["recordId"] for r in uniq_of(rows)], files)
        write_shard(f"feeds/sports/{sport}.json", feed_of(f"sport:{sport}"), files)
    for league, rows in by_league.items():
        write_index(f"indexes/leagues/{league}.json", [r["recordId"] for r in uniq_of(rows)], files)
        write_shard(f"feeds/leagues/{league}.json", feed_of(f"league:{league}"), files)
    for cat, rows in by_cat.items():
        write_index(f"indexes/tags/{cat}.json", [r["recordId"] for r in uniq_of(rows)], files)
        write_shard(f"feeds/tags/{cat}.json", feed_of(f"tag:{cat}"), files)
    for namespace, folder in TAG_INDEXES:
        for value, rows in by_namespace[namespace].items():
            write_index(f"indexes/{folder}/{value}.json", [r["recordId"] for r in uniq_of(rows)], files)
    for code, rows in by_namespace["country"].items():
        write_shard(f"feeds/countries/{code}.json", feed_of(f"country:{code}"), files)
    for fid, rows in by_team.items():
        write_index(f"indexes/teams/f-{fid}.json", [r["recordId"] for r in uniq_of(rows)], files)
        write_shard(f"feeds/teams/f-{fid}.json", feed_of(f"team:{fid}"), files)
    for code, rows in by_fifa.items():
        write_index(f"indexes/teams/fifa-{code}.json", [r["recordId"] for r in uniq_of(rows)], files)
    for bucket, rows in by_player.items():
        write_index(f"indexes/players/{bucket}.json", [r["recordId"] for r in uniq_of(rows)], files)
        write_shard(f"feeds/players/{bucket}.json", feed_of(f"player:{bucket}"), files)
    write_shard("sample.json", feed_of("sample") or facts[:400], files)
    famous_rank: dict[str, int] = {}
    for extra in ("extract_wikidata_famous.json",):
        for row in load_records(extra):
            qid = ((row.get("person") or {}).get("qid"))
            sits = row.get("sitelinks") or 0
            if qid and sits > famous_rank.get(qid, 0):
                famous_rank[qid] = sits
    top_famous = {qid for qid, _ in sorted(famous_rank.items(), key=lambda kv: -kv[1])[:80]}
    showcase = [r for r in facts if (r.get("person") or {}).get("qid") in {"Q209518", "Q311374"}]
    showcase += [r for r in facts if (r.get("person") or {}).get("qid") in top_famous and r.get("category") == "player-birthday"]
    showcase += feed_of("showcase-deaths")
    showcase += [r for r in facts if "sport-record" in (r.get("tags") or []) or r.get("record")]
    write_shard("feeds/showcase.json", list({r["recordId"]: r for r in showcase}.values()), files)
    # Who a reader can look up by name: every person a fact is about, with the ids of his facts, in one file for each first letter of his name
    # (`index/names/a.json`), so a picker reads one small file and then the facts by id (`loadFactsById`). A name is a label, never identity: the Q id is.
    people_by_key: dict[str, dict] = {}
    for row in facts:
        person = row.get("person") or {}
        key = person.get("qid") or (f"p{person['personId']}" if person.get("personId") else None)
        if not key or not person.get("name"):
            continue
        entry = people_by_key.setdefault(key, {"n": person["name"], "q": person.get("qid"), "p": person.get("personId"), "ids": []})
        entry["ids"].append(row["recordId"])
    by_letter: dict[str, list[dict]] = defaultdict(list)
    for entry in people_by_key.values():
        entry["ids"] = sorted(set(entry["ids"]))
        # In the file of the first letter of his first name and of his last (a reader types either): `nameLetters` in src/load.ts says the same.
        for letter in name_letters(entry["n"]):
            by_letter[letter].append(entry)
    for letter, entries in sorted(by_letter.items()):
        entries.sort(key=lambda e: (e["n"], e["q"] or "", e["p"] or 0))
        body = json.dumps({"schemaVersion": 1, "dataVersion": VERSION, "people": entries}, ensure_ascii=False, separators=(",", ":")) + "\n"
        (OUT / "index/names").mkdir(parents=True, exist_ok=True)
        (OUT / f"index/names/{letter}.json").write_text(body, encoding="utf-8")
        files[f"index/names/{letter}.json"] = {"sha256": hashlib.sha256(body.encode()).hexdigest(), "bytes": len(body.encode()), "records": len(entries)}
    index = {
        "schemaVersion": 1,
        "dataVersion": VERSION,
        "teams": sorted(teams_index.values(), key=lambda t: (t.get("name") or "", t["franchiseId"])),
        "players": sorted(players_index.values(), key=lambda p: (p.get("name") or "", p["personId"])),
    }
    index_body = json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n"
    (OUT / "index").mkdir(parents=True, exist_ok=True)
    (OUT / "index/picker.json").write_text(index_body, encoding="utf-8")
    files["index/picker.json"] = {
        "sha256": hashlib.sha256(index_body.encode()).hexdigest(),
        "bytes": len(index_body.encode()),
        "records": len(index["teams"]) + len(index["players"]),
    }
    # What a reader can filter by, with the number of facts of each: one small file (`index/vocabulary.json`) for a demo's menus, so none reads a whole index to list its values.
    folders = {namespace: folder for namespace, folder in TAG_INDEXES} | {"sport": "sports", "league": "leagues"}
    vocabulary = {"schemaVersion": 1, "dataVersion": VERSION, **{
        folder: dict(sorted(((v, len({r["recordId"] for r in rows})) for v, rows in by_namespace[namespace].items()), key=lambda kv: (-kv[1], kv[0])))
        for namespace, folder in folders.items()
    }}
    for row in facts:
        if row.get("category") == "award" and row.get("awardName") and slug_of_name(row["awardName"]):
            AWARD_NAMES.setdefault(slug_of_name(row["awardName"]), row["awardName"])
    vocabulary["trophies"] = {"generic": TROPHIES["generic"], "awards": {s: TROPHIES["awards"].get(s, TROPHIES["generic"]) for s in sorted(vocabulary["awards"])},
                              "titles": {s: TROPHIES["titles"].get(s, TROPHIES["generic"]) for s in sorted(vocabulary["titles"])}}
    vocabulary["awardNames"] = {slug: AWARD_NAMES[slug] for slug in sorted(vocabulary["awards"]) if slug in AWARD_NAMES}
    vocabulary_body = json.dumps(vocabulary, ensure_ascii=False, separators=(",", ":")) + "\n"
    (OUT / "index/vocabulary.json").write_text(vocabulary_body, encoding="utf-8")
    files["index/vocabulary.json"] = {"sha256": hashlib.sha256(vocabulary_body.encode()).hexdigest(), "bytes": len(vocabulary_body.encode()), "records": len(vocabulary) - 4}
    # The clubs alone (a few kilobytes), for a picker that has no use for the 10,000 players of picker.json.
    teams_body = json.dumps({"schemaVersion": 1, "dataVersion": VERSION, "teams": index["teams"]}, ensure_ascii=False, separators=(",", ":")) + "\n"
    (OUT / "index/teams.json").write_text(teams_body, encoding="utf-8")
    files["index/teams.json"] = {"sha256": hashlib.sha256(teams_body.encode()).hexdigest(), "bytes": len(teams_body.encode()), "records": len(index["teams"])}
    manifest = {
        "schemaVersion": 1,
        "dataVersion": VERSION,
        "records": len(facts),
        "droppedThin": dropped,
        "coveredDays": len(covered),
        "missingDays": [d for d in calendar if d not in by_day],
        "categories": {k: len({r["recordId"] for r in v}) for k, v in sorted(by_cat.items())},
        "tags": {ns: {"values": len(values), "facts": len({r["recordId"] for rows in values.values() for r in rows})} for ns, values in sorted(by_namespace.items())},
        "countries": dict(sorted(((c, len({r["recordId"] for r in rows})) for c, rows in by_namespace["country"].items()), key=lambda kv: (-kv[1], kv[0]))),
        "uniqueRecords": len({r["recordId"] for r in facts}),
        "mergedSameEvent": merged_events,
        "daysWithFewerThan3": days_lt3,
        "featuredMargin": FEATURE_MARGIN,
        "peopleDay": PEOPLE_DAY,
        "eventsDay": EVENTS_DAY,
        "sources": {
            **({"wikidataDump": {**dump_meta, "factsAdded": sum(1 for row in facts if row["recordId"].startswith("wikidata:player-"))}} if dump_meta else {}),
            **({"wikidataDumpEvents": {**event_meta, "factsAdded": sum(1 for row in facts if row["recordId"].startswith("wikidata:") and row.get("category") in EVENT_CATEGORIES)}} if event_meta else {}),
        },
        "extractOnDisk": {
            "game-on-day": 392898, "championship-final": 1867, "soccer-on-day": 10423,
            "player-birthday": 20532, "player-death": 4028, "award": 5181,
            "franchise-event": 1207, "venue-opening": 203, "draft": len(drafts),
        },
        "files": files,
        "teams": len(teams_index),
        "players": len(players_index),
    }
    man_body = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    (OUT / "manifest.json").write_text(man_body, encoding="utf-8")
    summary = {
        "priorityAdded": priority_added, "wikidataDumpAdded": dump_added, "wikidataDumpEventsAdded": events_added, "priorityRephrased": rephrased,
        "records": len(facts), "droppedThin": dropped, "coveredDays": len(covered),
        "daysWithFewerThan3": len(days_lt3), "uniqueRecords": len({r["recordId"] for r in facts}),
        "mergedSameEvent": merged_events,
        "oct16": len(by_day.get("10-16") or []),
        "files": len(files) + 1, "categories": manifest["categories"],
        "bytes": sum(m["bytes"] for m in files.values()) + len(man_body.encode()),
        "teams": len(teams_index), "players": len(players_index),
    }
    print(json.dumps(summary, indent=2))
    if days_lt3:
        print(f"days with fewer than 3 feed-ready facts: {len(days_lt3)}", file=sys.stderr)
    oct16 = len(by_day.get("10-16") or [])
    if oct16 < 3:
        print(f"10-16 feed-ready {oct16} < 3", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
