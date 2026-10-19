#!/usr/bin/env python3
"""Build public on-this-day fact shards from joined DS1 extracts. Does not connect to DS1."""
from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import sys
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
# Joseon-era general Q704476 (Myong-won Kim); never an athlete fact.
BLOCKED_QIDS = {"Q704476"}
BLOCKED = {"nhl_api", "spx_database", "spx_files", "spxn_database"}
NUMBER_WORD = {
    1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
    6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
}
LEAGUE = {
    "nhl": "NHL", "nba": "NBA", "mlb": "MLB", "nfl": "NFL", "cfl": "CFL", "mls": "MLS",
    "wc": "World Cup", "wwc": "Women's World Cup", "afl": "AFL", "aafc": "AAFC",
    "nha": "NHA", "pcha": "PCHA", "wchl": "WCHL", "wha": "WHA",
}
CHAMPIONSHIP_TITLE = {
    "mlb": "World Series", "nhl": "Stanley Cup", "nba": "NBA Finals", "cfl": "Grey Cup",
    "wc": "World Cup", "wwc": "Women's World Cup", "afl": "AFL Championship",
    "aafc": "AAFC Championship", "nha": "NHA Championship", "pcha": "PCHA Championship",
    "wchl": "WCHL Championship", "wha": "Avco World Trophy", "mls": "MLS Cup",
}
CHAMPIONSHIP_TITLE_JA = {
    "World Series": "ワールドシリーズ", "Stanley Cup": "スタンレー・カップ",
    "NBA Finals": "NBAファイナル", "NFL Championship": "NFL選手権",
    "Super Bowl": "スーパーボウル", "Grey Cup": "グレイ・カップ",
    "World Cup": "ワールドカップ", "Women's World Cup": "女子ワールドカップ",
    "AFL Championship": "AFL選手権", "AAFC Championship": "AAFC選手権",
    "NHA Championship": "NHA選手権", "PCHA Championship": "PCHA選手権",
    "WCHL Championship": "WCHL選手権", "Avco World Trophy": "AVCOトロフィー",
    "MLS Cup": "MLSカップ",
}
GENERIC_ROUND = {"", "final", "championship", "championship-final", "regular", "playoffs", "championship_final"}
PROVINCE_PREFIX = (
    "Newfoundland and Labrador", "Prince Edward Island", "British Columbia",
    "Alberta", "Ontario", "Quebec", "Manitoba", "Saskatchewan",
    "Nova Scotia", "New Brunswick", "Newfoundland",
)
YEAR_SPAN = re.compile(r"\s*\((\d{4})(?:[–-](\d{4}))?\)$")
CAREER_HIGHLIGHT = re.compile(
    r"cup|championship|finals|world series|grey cup|super bowl|all-time|leading|record|champion",
    re.I,
)
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


def team(obj) -> dict | None:
    if not obj:
        return None
    return {
        "name": obj.get("name"),
        "franchiseId": obj.get("franchiseId"),
        "teamSeasonId": obj.get("teamSeasonId"),
        "soccerTeamId": obj.get("soccerTeamId"),
        "countryCode": obj.get("countryCode"),
        "fifaCode": obj.get("fifaCode"),
        "flagCode": obj.get("flagCode"),
    }


def league_label(record: dict) -> str:
    code = record.get("league") or record.get("competition") or ""
    return LEAGUE.get(code, code.upper() if code else "")


def strip_club_years(name: str) -> str:
    return YEAR_SPAN.sub("", name).strip()


def is_province_club(name: str) -> bool:
    bare = strip_club_years(name)
    return any(bare == prefix or bare.startswith(f"{prefix} ") for prefix in PROVINCE_PREFIX)


def public_club_name(names, fallback: str = "") -> str:  # noqa: ANN001
    cleaned = [n.strip() for n in (names or []) if n and n.strip()]
    if not cleaned:
        return strip_club_years(fallback)

    def span(name: str) -> int:
        match = YEAR_SPAN.search(name)
        if not match:
            return 0
        start = int(match.group(1))
        end = int(match.group(2) or match.group(1))
        return end - start

    ranked = sorted(
        cleaned,
        key=lambda name: (is_province_club(name), -span(name), strip_club_years(name)),
    )
    return strip_club_years(ranked[0])


def championship_title(record: dict, ja: bool = False) -> str:
    labeled = str(record.get("roundLabel") or record.get("stage") or record.get("phase") or "").strip().replace("_", " ")
    if labeled and labeled.lower() not in GENERIC_ROUND:
        title = labeled
    else:
        code = (record.get("league") or record.get("competition") or "").lower()
        if code == "nfl":
            year = record.get("seasonStartYear")
            if year is None:
                event = record.get("eventDate") or ""
                year = int(event[:4]) if re.match(r"^\d{4}-", event) else None
            title = "Super Bowl" if year is not None and year >= 1966 else "NFL Championship"
        else:
            title = CHAMPIONSHIP_TITLE.get(code, "")
    if not title:
        return ""
    return CHAMPIONSHIP_TITLE_JA.get(title, title) if ja else title


def year_of(record: dict) -> str | None:
    event = record.get("eventDate") or ""
    if re.match(r"^\d{4}-", event):
        return event[:4]
    for key in ("draftYear", "seasonStartYear", "bornYear"):
        if record.get(key):
            return str(record[key])
    return None


def ot_en(r):  # noqa: ANN001
    if r.get("decidedByShootout"):
        return " in a shootout"
    if r.get("wentToOvertime"):
        return " in overtime"
    return ""


def ot_ja(r):  # noqa: ANN001
    if r.get("decidedByShootout"):
        return "（PK戦）"
    if r.get("wentToOvertime"):
        return "（延長）"
    return ""


def venue_en(r):  # noqa: ANN001
    if not r.get("venueName"):
        return ""
    if r.get("venueCity"):
        return f" at {r['venueName']}, {r['venueCity']}"
    return f" at {r['venueName']}"


def venue_ja(r):  # noqa: ANN001
    if not r.get("venueName"):
        return ""
    if r.get("venueCity"):
        return f"（{r['venueName']}、{r['venueCity']}）"
    return f"（{r['venueName']}）"


def game_number_en(r):  # noqa: ANN001
    n = r.get("seriesGameNumber")
    return f" in Game {n}" if n else ""


def game_number_ja(r):  # noqa: ANN001
    n = r.get("seriesGameNumber")
    return f"第{n}戦" if n else ""


def stage_en(r):  # noqa: ANN001
    stage = r.get("stage") or r.get("phase") or r.get("roundLabel")
    if not stage or stage == "regular":
        return ""
    return f", {stage.replace('_', ' ')}"


def stage_ja(r):  # noqa: ANN001
    stage = r.get("stage") or r.get("phase") or r.get("roundLabel")
    if not stage or stage == "regular":
        return ""
    return f"、{stage.replace('_', ' ')}"


def series_en(r, winner_season):  # noqa: ANN001
    best, high, low, series_winner = r.get("seriesBestOf"), r.get("seriesHigherWins"), r.get("seriesLowerWins"), r.get("seriesWinnerTeamSeasonId")
    if None in (best, high, low, series_winner, winner_season):
        return ""
    need = best // 2 + 1
    if high < need and low < need:
        return ""
    if series_winner != winner_season:
        return ""
    series = f"{max(high, low)}–{min(high, low)}"
    round_label = f" {r['roundLabel']}" if r.get("roundLabel") else ""
    return f" to win the{round_label} {series}"


def caption_game(r, ja: bool) -> str | None:
    home, away = (r.get("home") or {}).get("name"), (r.get("away") or {}).get("name")
    hs, aws = r.get("homeScore"), r.get("awayScore")
    if not home or not away or hs is None or aws is None:
        return None
    year, league = year_of(r), league_label(r)
    ctx = ", ".join(x for x in (league, year) if x)
    extra_en = f"{game_number_en(r)}{venue_en(r)}{ot_en(r)}{stage_en(r)}"
    extra_ja = f"{game_number_ja(r)}{venue_ja(r)}{ot_ja(r)}{stage_ja(r)}"
    if hs == aws:
        if ja:
            return f"{home}と{away}は{hs}対{aws}で引き分けた{extra_ja}{f'（{ctx}）' if ctx else ''}。"
        return f"{home} tied {away} {hs}–{aws}{extra_en}{f' ({ctx})' if ctx else ''}."
    home_won = hs > aws
    winner, loser = (home, away) if home_won else (away, home)
    ws, ls = (hs, aws) if home_won else (aws, hs)
    winner_season = (r.get("home") or {}).get("teamSeasonId") if home_won else (r.get("away") or {}).get("teamSeasonId")
    series = series_en(r, winner_season)
    stage = str(r.get("stage") or r.get("roundLabel") or "")
    is_final = r.get("category") == "championship-final" or stage.lower() == "final"
    title = championship_title(r, ja)
    if is_final and year and title:
        if ja:
            return f"{winner}が{year}年の{title}で{loser}に{ws}対{ls}で勝った{ot_ja(r)}{venue_ja(r)}。"
        return f"{winner} won the {year} {title}, beating {loser} {ws}–{ls}{ot_en(r)}{venue_en(r)}."
    if ja:
        return f"{winner}が{loser}に{ws}対{ls}で勝利した{extra_ja}{f'（{ctx}）' if ctx else ''}。"
    return f"{winner} beat {loser} {ws}–{ls}{extra_en}{f' ({ctx})' if ctx else ''}{series}."


def clubs_of(r) -> str:  # noqa: ANN001
    names = [n for n in (r.get("clubNames") or []) if n]
    if names:
        return ", ".join(names)
    return (r.get("clubName") or "").strip()


def honour_of(r) -> str:  # noqa: ANN001
    existing = (r.get("highlight") or "").strip()
    if existing:
        return existing
    n = r.get("championships") or 0
    try:
        n = int(n)
    except (TypeError, ValueError):
        n = 0
    cup = (r.get("championshipName") or "").strip()
    if n and cup:
        if n == 1:
            return f"{cup} winner"
        return f"{NUMBER_WORD.get(n, str(n))}-time {cup} winner"
    award = (r.get("personAward") or r.get("awardName") or "").strip()
    return f"{award} winner" if award else ""


def who_of(r) -> tuple[str, str]:  # noqa: ANN001
    club = public_club_name(r.get("clubNames"), r.get("clubName") or "")
    position = (r.get("position") or "").strip()
    honour = honour_of(r)
    if honour and CAREER_HIGHLIGHT.search(honour):
        return "", honour
    return " ".join(x for x in (club, position) if x), "" if club else honour


def caption_person(r, ja: bool, died: bool) -> str | None:
    name = ((r.get("person") or {}).get("name") or "").strip()
    year = year_of(r)
    club_pos, honour = who_of(r)
    if not name or not year or not (club_pos or honour):
        return None
    if ja:
        inner = "、".join(x for x in (club_pos, honour) if x)
        clause = f"（{inner}）" if inner else ""
    elif club_pos and honour:
        clause = f", the {club_pos} and {honour},"
    elif club_pos:
        clause = f", the {club_pos},"
    else:
        clause = f", {honour},"
    if died:
        aged_en = f", aged {r['ageYears']}" if r.get("ageYears") is not None else ""
        aged_ja = f"{r['ageYears']}歳で" if r.get("ageYears") is not None else ""
        return (
            f"{name}{clause}が{year}年のこの日に{aged_ja}死去した。" if ja
            else f"{name}{clause} died on this day in {year}{aged_en}."
        )
    death = r.get("deathDate") or ""
    death_year = death[:4] if len(death) >= 4 and death[:4].isdigit() else None
    if r.get("livingStatus") == "deceased" and death_year:
        return (
            f"{name}{clause}は{year}年のこの日に生まれた（{death_year}年死去）。" if ja
            else f"{name}{clause} was born on this day in {year} (died {death_year})."
        )
    return (
        f"{name}{clause}は{year}年のこの日に生まれた。" if ja
        else f"{name}{clause} was born on this day in {year}."
    )


def caption_award(r, ja: bool) -> str | None:
    winner = (r.get("winnerName") or (r.get("person") or {}).get("name") or "").strip()
    award = (r.get("awardName") or "").strip()
    year = year_of(r)
    if not winner or not award or not year:
        return None
    ctx = ", ".join(x for x in (league_label(r), year) if x)
    if ja:
        return f"{winner}が{award}を受賞した{f'（{ctx}）' if ctx else ''}。"
    return f"{winner} won the {award}{f' ({ctx})' if ctx else ''}."


def caption_venue(r, ja: bool) -> str | None:
    name = (r.get("venueName") or r.get("displayName") or "").strip()
    year = year_of(r)
    city = (r.get("venueCity") or "").strip()
    clubs = clubs_of(r)
    famous = (r.get("highlight") or "").strip()
    if not name or not year or not (city or clubs or famous):
        return None
    if ja:
        city_bit = f"（{city}）" if city else ""
        home_bit = f"。{clubs}の本拠地" if clubs else ""
        final_bit = f"。{famous}を開催" if famous else ""
        return f"{name}が{year}年に開場した{city_bit}{home_bit}{final_bit}。"
    city_bit = f" in {city}" if city else ""
    home_bit = f"; home of the {clubs}" if clubs else ""
    final_bit = f"; it hosted {famous}" if famous else ""
    return f"{name}{city_bit} opened in {year}{home_bit}{final_bit}."


def caption_franchise(r, ja: bool) -> str | None:
    label = (r.get("clubName") or r.get("label") or "").strip()
    year = year_of(r)
    if not label or not year or (r.get("eventDate") or "").endswith("-01-01"):
        return None
    league_code = (r.get("league") or "").strip()
    league = LEAGUE.get(league_code, league_code.upper() if league_code else "")
    city = (r.get("venueCity") or "").strip()
    if not league and not city:
        return None
    if ja:
        city_bit = f"（{city}）" if city else ""
        return f"{label}のこの{league}名義が{year}年に始まる{city_bit}。"
    city_bit = f" in {city}" if city else ""
    league_bit = f"{league} " if league else ""
    return f"{label} began this {league_bit}identity in {year}{city_bit}."


def captions(r) -> tuple[str, str] | None:
    cat = r.get("category")
    if cat in {"game-on-day", "championship-final", "soccer-on-day"}:
        en, ja = caption_game(r, False), caption_game(r, True)
    elif cat == "player-birthday":
        en, ja = caption_person(r, False, False), caption_person(r, True, False)
    elif cat == "player-death":
        en, ja = caption_person(r, False, True), caption_person(r, True, True)
    elif r.get("record"):
        rec = r["record"]
        holder, metric, value, unit = rec.get("holderName"), rec.get("metric"), rec.get("value"), rec.get("unit") or ""
        scope = rec.get("scope") or ""
        prev = rec.get("previousHolderName")
        if not holder or not metric or value is None:
            return None
        prev_en = f" Previous holder: {prev}." if prev else ""
        prev_ja = f"。それ以前は{prev}" if prev else ""
        event = rec.get("event") or "set"
        return (
            f"{holder} {event} the {scope} {metric} record at {value} {unit}.{prev_en}".replace("  ", " "),
            f"{holder}の{scope} {metric}は{value}{unit}{prev_ja}。",
        )
    elif cat == "award":
        en, ja = caption_award(r, False), caption_award(r, True)
    elif cat == "venue-opening":
        en, ja = caption_venue(r, False), caption_venue(r, True)
    elif cat == "franchise-event":
        en, ja = caption_franchise(r, False), caption_franchise(r, True)
    elif cat == "draft":
        name = ((r.get("person") or {}).get("name") or "").strip()
        year, league = r.get("draftYear"), league_label(r)
        if not name or not year or not league:
            return None
        pick_en = f" No. {r['overallPick']} overall" if r.get("overallPick") is not None else ""
        pick_ja = f"全体{r['overallPick']}位" if r.get("overallPick") is not None else ""
        club_en = f" by the {r['clubName']}" if r.get("clubName") else ""
        club_ja = f"、{r['clubName']}" if r.get("clubName") else ""
        return (
            f"{name} was drafted in the {year} {league} draft{pick_en}{club_en}.",
            f"{name}が{year}年の{league}ドラフト{pick_ja}{club_ja}で指名された。",
        )
    else:
        return None
    if not en:
        return None
    return en, ja or en


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
    seen: set[str] = set()
    out: list[str] = []
    for tag in [row.get("category"), *(row.get("tags") or [])]:
        if tag and tag not in seen:
            seen.add(tag)
            out.append(tag)
    return out


def finalize(row: dict) -> dict | None:
    caps = captions(row)
    if not caps:
        return None
    text, text_ja = caps
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
        "sport": sport_slug(row.get("sport")) or row.get("sport"),
        "competition": row.get("competition") or row.get("league"),
        "league": row.get("league"),
        "source": source,
        "text": text,
        "textJa": text_ja,
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
        "sitelinks", "priorityAthlete", "nationality",
        "championships", "championshipName", "personAward",
    ):
        if row.get(key) not in (None, [], ""):
            out[key] = row[key]
    if out.get("home"):
        out["home"] = team(out["home"])
    if out.get("away"):
        out["away"] = team(out["away"])
    return out


def name_map(rows: list[dict]) -> dict[int, str]:
    votes: dict[tuple[int, str], int] = defaultdict(int)
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


def pick_varied(records: list[dict], n: int) -> list[dict]:
    return pick_ranked(records, n)


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


def fame(row: dict) -> int:
    if row.get("priorityAthlete"):
        return 2
    if (row.get("sitelinks") or 0) >= 20:
        return 1
    return 0


def significance(row: dict) -> int:
    tags = set(tag_set(row))
    score = 0
    if "sport-record" in tags or "career-stat-milestone" in tags or "record" in (row.get("featuredReasons") or []):
        score += 95
    if "championship-win" in tags or row.get("category") == "championship-final":
        score += 90
    if "series-clinch" in tags or "historic-cup-series" in tags:
        score += 80
    if "overtime-result" in tags:
        score += 70
    if "shutout" in tags:
        score += 60
    if "big-margin" in (row.get("featuredReasons") or []):
        score += 50
    score += {
        "award": 45, "player-death": 40, "venue-opening": 35,
        "franchise-event": 30, "player-birthday": 15,
    }.get(row.get("category") or "", 0)
    return score + fame(row) * 20


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
        rows.sort(key=lambda r: (-significance(r), r["recordId"]))
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


def pick_ranked(records: list[dict], n: int, max_per: int = 2) -> list[dict]:
    ordered = sorted(records, key=lambda r: (-significance(r), -fame(r), r.get("eventDate") or "", r["recordId"]))

    def run(relax_people: bool, relax_tags: bool) -> list[dict]:
        picked, seen = [], set()
        by_tag, by_comp = defaultdict(int), defaultdict(int)
        people, teams = set(), set()
        for row in ordered:
            if len(picked) >= n:
                break
            rid = row["recordId"]
            if rid in seen:
                continue
            tags = tag_set(row)
            comp = row.get("competition") or row.get("league") or row.get("category")
            person, tkeys = person_key(row), team_keys(row)
            if not relax_tags and (any(by_tag[t] >= max_per for t in tags) or by_comp[comp] >= max_per):
                continue
            if not relax_people and person and person in people:
                continue
            if not relax_people and any(k in teams for k in tkeys):
                continue
            picked.append(row)
            seen.add(rid)
            for t in tags:
                by_tag[t] += 1
            by_comp[comp] += 1
            if person:
                people.add(person)
            teams.update(tkeys)
        return picked

    first = run(False, False)
    if len(first) >= min(n, len(records)):
        return first
    second = run(True, False)
    if len(second) >= min(n, len(records)):
        return second
    return run(True, True)


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


def main() -> int:
    if not EXTRACT.is_dir():
        print(f"EXTRACT dir missing: {EXTRACT}", file=sys.stderr)
        return 1
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
    awards_by_person: dict[int, str] = {}
    for row in awards:
        person = row.get("person") or {}
        pid, aname = person.get("personId"), row.get("awardName")
        if pid and aname and pid not in awards_by_person:
            awards_by_person[pid] = aname
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
    for row in finals:
        if not ((row.get("home") or {}).get("name") and row.get("homeScore") is not None):
            continue
        rec = {**row, "category": "championship-final"}
        rec["featuredReasons"] = featured_reasons(rec) or ["final"]
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
        extract_clubs = [n for n in (row.get("clubNames") or []) if n]
        clubs = extract_clubs or [names[i] for i in (person.get("franchiseIds") or []) if i in names]
        if not person.get("name") or not row.get("eventDate"):
            continue
        rec = {**row, "category": "player-birthday", "clubNames": clubs,
               "basis": "source", "birthDate": row.get("eventDate")}
        if row.get("position"):
            rec["position"] = row["position"]
        honour = honour_of(rec)
        if honour:
            rec["highlight"] = honour
        pid = person.get("personId")
        qid = person.get("qid")
        dead = (pid in death_ids) or (qid in death_by_qid)
        rec["livingStatus"] = "deceased" if dead else "unknown"
        drow = (pid and death_by_id.get(pid)) or (qid and death_by_qid.get(qid)) or None
        if drow and drow.get("eventDate"):
            rec["deathDate"] = drow["eventDate"]
        if pid in awards_by_person and not rec.get("highlight"):
            rec["highlight"] = f"{awards_by_person[pid]} winner"
        qid = person.get("qid")
        if qid and qid in PRIORITY_QIDS:
            rec["priorityAthlete"] = True
        if not is_sport_person(rec):
            continue
        chosen[row["recordId"]] = rec
    for row in deaths:
        person = row.get("person") or {}
        extract_clubs = [n for n in (row.get("clubNames") or []) if n]
        clubs = extract_clubs or [names[i] for i in (person.get("franchiseIds") or []) if i in names]
        if not person.get("name") or not row.get("eventDate"):
            continue
        rec = {**row, "category": "player-death", "clubNames": clubs,
               "basis": "source", "livingStatus": "deceased"}
        if row.get("position"):
            rec["position"] = row["position"]
        honour = honour_of(rec)
        if honour:
            rec["highlight"] = honour
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
        if pid in awards_by_person and not rec.get("highlight"):
            rec["highlight"] = f"{awards_by_person[pid]} winner"
        qid = person.get("qid")
        if qid and qid in PRIORITY_QIDS:
            rec["priorityAthlete"] = True
        if not is_sport_person(rec):
            continue
        chosen[row["recordId"]] = rec
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
        if (row.get("eventDate") or "").endswith("-01-01"):
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

    facts = []
    dropped = 0
    for row in chosen.values():
        done = finalize(row)
        if done:
            facts.append(done)
        else:
            dropped += 1
    by_id = {row["recordId"]: row for row in facts}
    by_id, merged_events = merge_same_event(by_id)
    facts = list(by_id.values())

    if OUT.exists():
        for old in OUT.rglob("*.json"):
            old.unlink()
    files: dict = {}
    by_day, by_sport, by_league, by_cat = defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list)
    by_team, by_fifa, by_player = defaultdict(list), defaultdict(list), defaultdict(list)
    teams_index, players_index = {}, {}
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
                teams_index[fid] = {"franchiseId": fid, "name": names.get(fid), "sport": row.get("sport"), "league": row.get("league")}

    calendar = [(date(2024, 1, 1) + timedelta(days=i)).strftime("%m-%d") for i in range(366)]
    covered = sorted(d for d in by_day if by_day[d])
    by_store: dict[str, list] = defaultdict(list)
    for row in facts:
        by_store[store_bucket(row["recordId"])].append(row)
    for bucket, rows in by_store.items():
        write_shard(f"store/{bucket}.json", list({r["recordId"]: r for r in rows}.values()), files)
    days_lt3 = []
    for day in calendar:
        rows = list({r["recordId"]: r for r in by_day.get(day, [])}.values())
        feed = pick_ranked(rows, 12)
        feed_ids = [r["recordId"] for r in feed]
        if len(feed_ids) != len(set(feed_ids)):
            print(f"duplicate fact id in days/{day}.json", file=sys.stderr)
            return 1
        if len(feed) < 3:
            days_lt3.append(day)
        write_shard(f"days/{day}.json", feed, files, allow_empty=True)
        write_index(f"indexes/days/{day}.json", [r["recordId"] for r in rows], files)
    for sport, rows in by_sport.items():
        uniq = list({r["recordId"]: r for r in rows}.values())
        write_index(f"indexes/sports/{sport}.json", [r["recordId"] for r in uniq], files)
        write_shard(f"feeds/sports/{sport}.json", pick_ranked(uniq, 40), files)
    for league, rows in by_league.items():
        uniq = list({r["recordId"]: r for r in rows}.values())
        write_index(f"indexes/leagues/{league}.json", [r["recordId"] for r in uniq], files)
        write_shard(f"feeds/leagues/{league}.json", pick_ranked(uniq, 40), files)
    for cat, rows in by_cat.items():
        uniq = list({r["recordId"]: r for r in rows}.values())
        write_index(f"indexes/tags/{cat}.json", [r["recordId"] for r in uniq], files)
        write_shard(f"feeds/tags/{cat}.json", pick_ranked(uniq, 40), files)
    for fid, rows in by_team.items():
        uniq = list({r["recordId"]: r for r in rows}.values())
        write_index(f"indexes/teams/f-{fid}.json", [r["recordId"] for r in uniq], files)
        write_shard(f"feeds/teams/f-{fid}.json", pick_ranked(uniq, 40), files)
    for code, rows in by_fifa.items():
        uniq = list({r["recordId"]: r for r in rows}.values())
        write_index(f"indexes/teams/fifa-{code}.json", [r["recordId"] for r in uniq], files)
    for bucket, rows in by_player.items():
        uniq = list({r["recordId"]: r for r in rows}.values())
        write_index(f"indexes/players/{bucket}.json", [r["recordId"] for r in uniq], files)
        write_shard(f"feeds/players/{bucket}.json", pick_ranked(uniq, 40), files)
    write_shard("sample.json", pick_varied(shuffle(facts, "meigen-sample-0.1.0"), 400) or facts[:400], files)
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
    showcase += pick_ranked([r for r in facts if r.get("category") == "player-death"], 8)
    showcase += [r for r in facts if "sport-record" in (r.get("tags") or []) or r.get("record")]
    write_shard("feeds/showcase.json", list({r["recordId"]: r for r in showcase}.values()), files)
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
    manifest = {
        "schemaVersion": 1,
        "dataVersion": VERSION,
        "records": len(facts),
        "droppedThin": dropped,
        "coveredDays": len(covered),
        "missingDays": [d for d in calendar if d not in by_day],
        "categories": {k: len({r["recordId"] for r in v}) for k, v in sorted(by_cat.items())},
        "uniqueRecords": len({r["recordId"] for r in facts}),
        "mergedSameEvent": merged_events,
        "daysWithFewerThan3": days_lt3,
        "featuredMargin": FEATURE_MARGIN,
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
