#!/usr/bin/env python3
"""Births and deaths of sports people from the filtered Wikidata dump (CC0), as converter extract rows.

Reads the files `scripts/wikidata_dump/filter.py` of spx-stats wrote (`people.jsonl.gz`, `items.jsonl.gz`, `events.jsonl.gz`, `labels.jsonl.gz`,
`summary.json`; read only, never copied into this repository) and writes ONE extract, `extract_wikidata_dump_people.json`, to `MEIGEN_EXTRACT_DIR`,
in the shape `convert_extract.py` reads like every other extract. No network, no DS1, no production.

What a row is, and what is left out, is the whole of this file; each rule has a count in the report it prints:

  * A person is a sports person when the first listed occupation is a sport occupation (athlete, coach, referee, sports official; the list is
    spx-stats' `occupations.tsv`) and the English description, when there is one, does not open with another trade ("President of ...",
    "American actor ..."). Or when the description opens with a sport role and any occupation is a sport one. Never on a name.
  * A birth or death is published only at day precision, on the Gregorian calendar (a Julian date is not converted, so it is left out), from 1850,
    not in the future, and never on January 1: Wikidata writes a year-only date as January 1 about as often as a real one and the dump holds no
    way to tell them apart (a person-day on January 1 that was already published stays; this file adds none).
  * Fame is the person's count of Wikipedia (and other wiki) editions, `sitelinks`, as the package has always ranked famous people; an Olympic
    medal or a Hall of Fame counts five editions more. The cut-off is `--min-sitelinks` everywhere and, below that, the best `--per-day-sport`
    people of every calendar day, sport and kind (birth or death) that have `--floor` editions, so a day has people in many sports.
  * The words are from data: the sport, the nationality (an ISO code), and a short phrase, the `epithet` ("Brazilian footballer"): the person's own
    English description when every word of it is an ordinary word of other sports people's descriptions, else a phrase built from his occupation
    and country the way those descriptions write them. A description is never shown as it is: it is free text. Never sex or gender, ethnicity,
    religion, politics, family or health: the filter never copied them, a sport label that carries one is reduced to its sport, and word lists
    hold the rest back.
  * A person's death is `deceased` only when Wikidata holds one; with none the status is `unknown`, never `living`.

    python3 -I pipeline/wikidata_dump_people.py [--dump DIR] [--out DIR] [--min-sitelinks 30] [--per-day-sport 2] [--floor 10] [--report]
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

HOME = Path.home()
DUMP_DIR = Path(os.environ.get("MEIGEN_WIKIDATA_DUMP_DIR", str(HOME / "Projects/backups/spx-stats/2026-10-12-wikidata-dump-out")))
OCCUPATIONS = Path(os.environ.get(
    "MEIGEN_WIKIDATA_OCCUPATIONS", str(HOME / "Projects/spx-stats/scripts/wikidata_dump/occupations.tsv"),
))
EXTRACT_DIR = Path(os.environ.get("MEIGEN_EXTRACT_DIR", str(HOME / "Projects/backups/spx-stats/meigen-extract")))
OUT_NAME = "extract_wikidata_dump_people.json"
GREGORIAN = "Q1985727"
ERA_START = 1850
MAX_AGE = 115
DUMP_DATE = "2026-10-12"
DUMP_NAME = "wikidata-20261012-all.json.gz"
DUMP_CEILING = "2026-10-12"  # nobody in the dump was born or died after the dump
MIN_WORD_DF = 30  # a word of a shown description is one that at least this many other sports people's descriptions use
DECORATED_FLOOR = 5  # editions that suffice for a person with an Olympic medal or a Hall of Fame behind him

# ---- sports --------------------------------------------------------------------------------------------------------------------------
# A sport label that carries a sex marker is reduced to its sport (never stored); one that names a sport John does not publish is skipped.
SEX_PREFIX = re.compile(r"^(?:women'?s|womens|men'?s|mens|female|male|girls'?|boys'?|ladies'?)\s+", re.I)
EXCLUDED_SPORT = re.compile(
    r"\b(?:para|paralympic|paralympics|deaf|deaflympic|deaflympics|wheelchair|blind|visually|special olympics|disabled|intellectual|sitting|goalball|"
    r"boccia|amputee|powerchair)\b"
    r"|^(?:esports?|electronic sports?|poker|contract bridge|bridge|video game|gambling|dog walking|hunting|fishing|bullfighting|bullfighter|speedcubing)$",
    re.I,
)
# Para and wheelchair sport, in a sport name or an occupation name: the person is not published (John's rule: no para label, no health).
PARA = re.compile(r"\b(?:para\w*|paralympic\w*|wheelchair|deaf\w*|blind|visually|sitting|goalball|boccia|amputee|powerchair|disabled|special olympics)\b", re.I)
# The sport codes the published facts already use (feeds/sports/*.json) keep their name; the rest are the label in kebab case.
SPORT_SLUG = {
    "association football": "soccer", "ice hockey": "ice-hockey", "american football": "american-football", "canadian football": "canadian-football",
    "gridiron football": "american-football", "mixed martial arts": "mma", "competitive swimming": "swimming", "artistic gymnastics": "gymnastics",
    "road bicycle racing": "cycling", "cycle sport": "cycling", "bicycle racing": "cycling", "track cycling": "track-cycling",
    "mountain biking": "mountain-biking", "amateur wrestling": "wrestling", "auto racing": "auto-racing", "motorcycle sport": "motorcycle-racing",
    "canoeing and kayaking": "canoeing", "equestrian sport": "equestrian", "shooting sports": "shooting", "sport shooting": "shooting",
    "track and field": "athletics",
}
PUBLISHED_SLUGS = frozenset(
    "acrobatic-gymnastics alpine-skiing american-football archery artistic-swimming athletics australian-rules-football badminton baseball basketball "
    "basque-pelota beach-soccer beach-volleyball biathlon bmx bobsleigh box-lacrosse boxing brazilian-jiu-jitsu canadian-football canoe-slalom "
    "canoe-sprint canoeing carom-billiards cricket cross-country-running curling cycling cyclo-cross darts diving drag-racing endurance-motor-racing "
    "equestrian fencing field-hockey figure-skating floorball formula-one freediving freestyle-skiing freestyle-wrestling futsal gaelic-football "
    "golf greco-roman-wrestling gymnastics handball horse-racing hurling ice-hockey indycar judo kabaddi karate kickboxing lacrosse lifesaving luge "
    "mma modern-pentathlon motocross motorcycle-racing mountain-biking mountaineering muay-thai netball nordic-combined open-water-swimming "
    "orienteering polo pool powerlifting professional-wrestling race-walking rallycross rallying rhythmic-gymnastics rodeo rowing rugby-league "
    "rugby-union sailing shinty shooting short-track-speed-skating skateboarding skeleton ski-jumping snooker snowboarding soccer softball "
    "speed-skating speedway sport-climbing squash stock-car-racing strongman sumo surfing swimming table-tennis taekwondo tennis tenpin-bowling "
    "track-cycling trampoline-gymnastics triathlon volleyball water-polo waterskiing weightlifting windsurfing wrestling".split()
)
# A discipline of a sport is published under the sport.
DISCIPLINE = (
    (re.compile(r"(?:^|-)(?:\d[\d-]*-metres?|metres?|marathon|steeplechase|hurdles|high-jump|long-jump|triple-jump|pole-vault|shot-put|discus|javelin|"
                r"hammer|decathlon|heptathlon|sprinting|racewalking|middle-distance-running|long-distance-running|road-running|combined-track-and-field-events)(?:-|$)"), "athletics"),
    (re.compile(r"synchroni[sz]ed-swimming"), "artistic-swimming"),
    (re.compile(r"shooting$|skeet|^trap"), "shooting"),
    (re.compile(r"^nascar"), "stock-car-racing"),
    (re.compile(r"^rally-raid"), "rallying"),
    (re.compile(r"motorcycle|superbike|^enduro"), "motorcycle-racing"),
    (re.compile(r"formula|f4|formel|automobile|motorsport|sports-car|touring|desert-racing|truck-racing|dirt-track|racing-car|^t-cars|frmula"), "auto-racing"),
    (re.compile(r"^(?:professional-golf)$"), "golf"),
    (re.compile(r"^(?:kayaking|canoeing-and-kayaking)$"), "canoeing"),
    (re.compile(r"pair-skating|ice-dance"), "figure-skating"),
    (re.compile(r"fencing$"), "fencing"),
    (re.compile(r"^(?:rock-climbing|climbing|competition-climbing)$"), "sport-climbing"),
    (re.compile(r"himalayan-mountaineering"), "mountaineering"),
    (re.compile(r"^english-boxing$"), "boxing"),
    (re.compile(r"^3x3-basketball$"), "basketball"),
    (re.compile(r"^field-handball$"), "handball"),
    (re.compile(r"^inline-speed-skating$"), "roller-speed-skating"),
    (re.compile(r"long-distance-swimming|marathon-swimming"), "open-water-swimming"),
    (re.compile(r"^strength-(?:athletics|sport)$"), "strongman"),
    (re.compile(r"^bmx-racing$"), "bmx"),
    (re.compile(r"^cross-country-cycling$"), "mountain-biking"),
)
SEX_IN_SLUG = re.compile(r"(?:^|-)(?:women|womens|men|mens|female|male|girls|boys|ladies|para|paralympic)(?:-|$)")


def slug_of(label: str) -> str | None:
    """The sport code of a Wikidata sport label, or None when the sport is not published or is not a sport."""
    base = SEX_PREFIX.sub("", label.strip())
    if not base or EXCLUDED_SPORT.search(label) or EXCLUDED_SPORT.search(base):
        return None
    key = base.lower()
    if key in SPORT_SLUG:
        return SPORT_SLUG[key]
    slug = re.sub(r"[^a-z0-9]+", "-", key.encode("ascii", "ignore").decode()).strip("-")
    if not slug or SEX_IN_SLUG.search(slug):
        return None
    if slug not in PUBLISHED_SLUGS:
        slug = next((code for pattern, code in DISCIPLINE if pattern.search(slug)), slug)
    return slug


# ---- words ---------------------------------------------------------------------------------------------------------------------------
# A person whose description holds one of these is not published at all: crime, and para sport or health (John's rule: no para label, no health).
DESC_SKIP_PERSON = re.compile(
    r"\b(?:convicted|criminal|murder\w*|killer|terror\w*|assassin\w*|nazi|fascist|rape\w*|abus\w*|executed|prisoner|fugitive|hostage|victim|doping|"
    r"banned|scandal|disgraced|suspended|cheat\w*|fraud\w*|gangster|mafia|drug\w*|smuggl\w*|"
    r"disabled|disability|deaf|deaflympic\w*|blind|paralympic\w*|para|wheelchair|cancer|illness)\b",
    re.I,
)
# A description that holds one of these is never shown (the person still is, with a phrase built from his occupation and country): sex, family,
# religion, politics, and wording that is true only for a date ("current", "since"). The filter already dropped most of it.
DESC_REJECT = re.compile(
    r"\b(?:female|male|woman|women|girl|boy|man|men|lady|gentleman|sportswoman|sportsman|gay|lesbian|bisexual|transgender|trans|queer|lgbt\w*|"
    r"son|daughter|father|mother|wife|husband|brother|sister|widow|spouse|married|partner|family|grandson|granddaughter|nephew|niece|cousin|"
    r"jewish|christian|catholic|muslim|islamic|hindu|buddhist|sikh|atheist|religious|priest|bishop|pastor|imam|rabbi|monk|nun|saint|pope|cardinal|"
    r"protestant|orthodox|anglican|lutheran|evangelical|mormon|missionary|jehovah|shinto|sufi|quaker|rastafarian|"
    r"republican|democrat|democratic|conservative|liberal|socialist|communist|activist|nationalist|"
    r"black|white|african-american|ethnic|"
    r"died|death|dead|killed|suicide|born|aged|current|currently|plays|playing|since|until|incumbent|late)\b",
    re.I,
)
# Trades that are not sport: a description that opens with one of them (before any sport role) is a person not known for sport.
OTHER_TRADE = set(
    "president prime minister king queen prince princess emperor empress duke duchess monarch politician statesman stateswoman businessman "
    "businesswoman businessperson entrepreneur tycoon magnate investor philanthropist actor actress singer musician rapper songwriter "
    "composer writer author novelist poet journalist scientist physicist mathematician chemist biologist philosopher architect painter "
    "sculptor artist director producer comedian model influencer streamer youtuber soldier general officer priest bishop pope judge lawyer "
    "economist banker engineer inventor explorer activist diplomat spy chancellor governor mayor senator congressman secretary ambassador "
    "professor teacher historian executive owner chairman founder presenter host broadcaster commentator pilot astronaut physician doctor "
    "naturalist photographer designer educator pedagogue linguist academic occultist entertainer personality".split()
)
WORD = re.compile(r"[A-Za-zÀ-ɏ]+(?:['’][A-Za-zÀ-ɏ]+)*")


def words(text: str) -> list[str]:
    """The words of a phrase; a hyphenated or dashed pair ("Czech-American") is two."""
    return WORD.findall(text or "")


def clean_description(text: str | None) -> str | None:
    """A description without its life years in parentheses; None when it is not a short plain phrase."""
    d = re.sub(r"\s+", " ", (text or "").replace(" ", " ")).strip()
    d = re.sub(r"\s*\((?:born\s+)?\d{4}(?:\s*[–—-]\s*(?:\d{4})?)?\)\s*$", "", d).strip()
    d = re.sub(r"\s*\([A-Za-z][^()\d]*\)", "", d).strip()
    if not d or len(d) > 64 or re.search(r"[\d()\[\];:/@#&.]", d):
        return None
    if len(words(d)) > 7 or DESC_REJECT.search(d) or re.search(r",\S", d) or re.search(r"\b(\w+)\s+\1\b", d, re.I):
        return None
    return d


def trade_first(desc: str | None, roles: set[str]) -> bool | None:
    """True when a description opens with another trade, False when it opens with a sport role, None when it says neither."""
    if not desc:
        return None
    for t in (w.lower() for w in words(desc.replace("martial artist", "martialartist"))):
        if t in roles:
            return False
        if t in OTHER_TRADE:
            return True
    return None


# ---- dates ---------------------------------------------------------------------------------------------------------------------------
def day_of(value: dict | None) -> str | None:
    """YYYY-MM-DD for a Wikidata time at day precision on the Gregorian calendar, else None."""
    if not value or value.get("p", 0) < 11 or value.get("c") != GREGORIAN:
        return None
    m = re.fullmatch(r"\+(\d{4})-(\d{2})-(\d{2})T00:00:00Z", value.get("t", ""))
    if not m:
        return None
    y, mo, d = (int(x) for x in m.groups())
    try:
        date(y, mo, d)
    except ValueError:
        return None
    return f"{y:04d}-{mo:02d}-{d:02d}"


def first_value(values: list | None) -> dict | None:
    return values[0] if values else None


def age_on(born: str, day: str) -> int:
    by, bm, bd = map(int, born.split("-"))
    dy, dm, dd = map(int, day.split("-"))
    return dy - by - (1 if (dm, dd) < (bm, bd) else 0)


# ---- loading -------------------------------------------------------------------------------------------------------------------------
def read_lines(path: Path):
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                yield json.loads(line)


def load_labels(dump: Path) -> dict[str, dict]:
    """id -> {en, iso (P297 alpha-2 of a country), country (the first P17 of a place)} from the labels, items and events files."""
    out: dict[str, dict] = {}
    for name in ("labels.jsonl.gz", "items.jsonl.gz", "events.jsonl.gz"):
        for r in read_lines(dump / name):
            if r["id"] in out:
                continue
            labels = r.get("l") or {}
            iso = (r.get("P297") or [None])[0]
            country = (r.get("P17") or [None])[0]
            out[r["id"]] = {
                "en": labels.get("en") or labels.get("mul"),
                "iso": iso if isinstance(iso, str) and re.fullmatch(r"[A-Z]{2}", iso) else None,
                "country": country if isinstance(country, str) else None,
            }
    return out


def load_occupations(path: Path) -> dict[str, tuple[str, str]]:
    """Q id -> (label, roots) of the sport occupations that are used (use = 1)."""
    out: dict[str, tuple[str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") or line.startswith("qid\t"):
            continue
        p = line.split("\t")
        if len(p) >= 4 and p[3] == "1":
            out[p[0]] = (p[1], p[2])
    return out


def sport_roles(occ: dict[str, tuple[str, str]]) -> set[str]:
    """Words that name a sport role: the last word of each sport occupation's label and the whole of a one-word label."""
    roles = {"athlete", "sportsperson", "footballer", "player", "competitor", "coach", "manager", "referee", "umpire"}
    for label, _ in occ.values():
        ws = [w.lower() for w in words(label)]
        if ws:
            roles.add(ws[-1])
            if len(ws) == 1:
                roles.add(ws[0])
    return roles - OTHER_TRADE - {"person", "member", "pilot", "official", "officer"}


def display_name(r: dict) -> str | None:
    labels = r.get("l") or {}
    name = (labels.get("en") or labels.get("mul") or "").strip()
    if len(name) < 3 or len(name) > 60 or re.search(r"[\d()\[\]@/\\<>|{},:]|https?:", name) or not re.search(r"[A-Za-zÀ-ɏ]", name):
        return None
    if name.lower() == name:
        return None
    return re.sub(r"\s+", " ", name)


HALL_OF_FAME = re.compile(r"hall of fame", re.I)


def _decorated(r: dict, labels: dict) -> bool:
    """Whether the person holds an Olympic medal (a first, second or third place at an Olympic event) or any Hall of Fame: fame the edition count under-counts."""
    for award in r.get("P166") or []:
        if HALL_OF_FAME.search((labels.get(award["v"]) or {}).get("en") or ""):
            return True
    for part in r.get("P1344") or []:
        rank = (part.get("q") or {}).get("P1352") or []
        if any(isinstance(x, dict) and x.get("a") in ("+1", "+2", "+3") for x in rank) and "Olympic" in ((labels.get(part["v"]) or {}).get("en") or ""):
            return True
    return False


def _shared(a: str, b: str) -> int:
    """How many letters two words share at their start."""
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


# ---- the pool ------------------------------------------------------------------------------------------------------------------------
def pool(dump: Path, labels: dict, occ: dict, roles: set[str], floor: int, stats: Counter, editions: dict[str, int]) -> list[dict]:
    """Every sports person with a usable day and at least `floor` editions (`DECORATED_FLOOR` with an Olympic medal or a Hall of Fame), with what the
    rest of the file needs and nothing else. `editions` collects the edition count of everyone who has three or more."""
    out: list[dict] = []
    votes: Counter = Counter()  # (occupation, sport) and (last word of the description, sport) -> people whose own words name that sport
    for r in read_lines(dump / "people.jsonl.gz"):
        stats["people read"] += 1
        sl = (r.get("sl") or {}).get("n", 0)
        if sl >= 3:
            editions[r["id"]] = sl
        if sl < min(floor, DECORATED_FLOOR):
            continue
        born, died = day_of(first_value(r.get("P569"))), day_of(first_value(r.get("P570")))
        if not born and not died:
            stats["left out: no Gregorian day-precision birth or death"] += 1
            continue
        name = display_name(r)
        if not name:
            stats["left out: no usable English name"] += 1
            continue
        p106 = r.get("P106") or []
        first_sport = bool(p106) and p106[0] in occ
        any_sport = any(x in occ for x in p106)
        raw = r.get("d") or ""
        if DESC_SKIP_PERSON.search(raw):
            stats["left out: description names a crime, para sport or health"] += 1
            continue
        desc = clean_description(raw)
        # What the description says about the trade is read even when the description itself is not fit to show.
        opens = trade_first(re.sub(r"\([^)]*\)", "", raw), roles) if raw else None
        if not ((first_sport and opens is not True) or (any_sport and opens is False)):
            stats["left out: not a sports person (first occupation or description says another trade)"] += 1
            continue
        if any(PARA.search(occ[x][0]) for x in p106 if x in occ) or any(PARA.search((labels.get(q) or {}).get("en") or "") for q in r.get("P641") or []):
            stats["left out: a para or wheelchair sport or occupation"] += 1
            continue
        decorated = _decorated(r, labels)
        if sl < floor and not decorated:
            continue
        # How he is called: the description first (it names what he is best known for first), then his first occupation.
        said = [w.lower() for w in words(f"{raw} {occ[p106[0]][0] if first_sport else ''}")]
        found: list[tuple[int, int, int, str, str]] = []  # (where in what he is called the sport's name first appears, -words that match, order, code, Q id)
        for i, q in enumerate(r.get("P641") or []):
            label = (labels.get(q) or {}).get("en")
            code = slug_of(label) if label else None
            if code and all(code != f[3] for f in found):
                at = [k for k, t in enumerate(said) for w in words(label.lower()) if len(w) >= 4 and _shared(w, t) >= min(len(w), 5)]
                found.append((min(at) if at else 999, -len(set(at)), i, code, q))
        if not found:
            stats["left out: no publishable sport"] += 1
            continue
        found.sort()
        if found[0][0] < 999:
            if first_sport:
                votes[(p106[0], found[0][3])] += 1
            if desc:
                votes[(words(desc)[-1].lower(), found[0][3])] += 1
        out.append({
            "id": r["id"], "name": name, "sl": sl, "born": born, "died": died, "died_any": bool(r.get("P570")), "decorated": decorated,
            "found": found, "desc": desc, "tailword": words(desc)[-1].lower() if desc else "", "occ": p106[0] if first_sport else None, "p27": ((r.get("P1532") or []) + (r.get("P27") or []))[:2],
            "p19": (r.get("P19") or [])[:1],
        })
    # A sport is the one that matches how he is called; where none does, the one most people of his occupation are named for.
    for p in out:
        best = min(p["found"], key=lambda f: (f[0], f[1], -((votes[(p["occ"], f[3])] if p["occ"] else 0) + votes[(p["tailword"], f[3])]), f[2]))
        p["sports"] = [best[3]] + [f[3] for f in p["found"] if f[3] != best[3]]
        p["sport_qids"] = [best[4]]
        del p["found"], p["tailword"]
    return out


# ---- the words of a person ------------------------------------------------------------------------------------------------------------
LEAD_CAPS = re.compile(r"^((?:[A-Z][\w'’]*(?:[-–][A-Z][\w'’]*)*)(?: (?:[A-Z][\w'’]*(?:[-–][A-Z][\w'’]*)*))*) (?=[a-z])")
# Where the data gives no single demonym a country can be trusted with (a United Kingdom passport is English, Scottish or Welsh), and states
# that no longer exist or are named otherwise than the way people from them are described.
DEMONYM_OVERRIDE = {
    "United Kingdom": "British", "United Kingdom of Great Britain and Ireland": "British", "Soviet Union": "Soviet", "Czechoslovakia": "Czechoslovak",
    "Yugoslavia": "Yugoslav", "Socialist Federal Republic of Yugoslavia": "Yugoslav", "Federal Republic of Yugoslavia": "Yugoslav",
    "East Germany": "East German", "West Germany": "West German", "Democratic Republic of the Congo": "Congolese", "Luxembourg": "Luxembourgish",
    "Dominican Republic": "Dominican", "Russian Empire": "Russian", "Austria-Hungary": "Austro-Hungarian", "Kingdom of the Netherlands": "Dutch",
    "Serbia and Montenegro": "Serbian", "Republic of Ireland": "Irish", "Ireland": "Irish",
}


class Describer:
    """The short phrase for a person ("Brazilian footballer"), learned from how the pool's own descriptions are written."""

    def __init__(self, people: list[dict], labels: dict, occ: dict) -> None:
        self.labels, self.occ = labels, occ
        self.df: Counter = Counter()
        for p in people:
            if p["desc"]:
                for w in set(words(p["desc"])):
                    self.df[w] += 1
        # Words that need no count behind them: those of the occupation and sport names themselves.
        self.known: set[str] = {w for label, _ in occ.values() for w in words(label)}
        for p in people:
            for q in p.get("sport_qids", ()):
                self.known.update(words((labels.get(q) or {}).get("en") or ""))
        # country -> the lead of descriptions of its people, kept when one lead is what most of them say
        by_country: dict[str, Counter] = defaultdict(Counter)
        for p in people:
            m = p["desc"] and LEAD_CAPS.match(p["desc"])
            country = (labels.get(p["p27"][0]) or {}).get("en") if p["p27"] else None
            if m and country and self._ok(p["desc"]):
                by_country[country][m.group(1)] += 1
        self.demonym: dict[str, str] = dict(DEMONYM_OVERRIDE)
        for country, c in by_country.items():
            if country in self.demonym:
                continue
            (lead, n), total = c.most_common(1)[0], sum(c.values())
            if n >= 2 and n / total >= 0.6:
                self.demonym[country] = lead
        self.known.update(w for lead in self.demonym.values() for w in words(lead))
        self.leads = set(self.demonym.values()) | {lead for c in by_country.values() for lead, n in c.items() if n >= 8}
        self.lead_tokens = {t for lead in self.leads for t in re.split(r"[ \-–]", lead)}
        # occupation -> the words after the lead that its people's descriptions use most, when they name the occupation
        tails: dict[str, Counter] = defaultdict(Counter)
        for p in people:
            if not (p["desc"] and p["occ"] and self._ok(p["desc"])):
                continue
            m = LEAD_CAPS.match(p["desc"])
            if m and m.group(1) in self.leads:
                tail = p["desc"][m.end():]
                if not re.search(r"\b(?:and|former|for|of|in|the|who)\b|,", tail) and self._names(p["occ"], tail):
                    tails[p["occ"]][tail] += 1
        self.tail = {q: c.most_common(1)[0][0] for q, c in tails.items() if c.most_common(1)[0][1] >= 3}

    def _names(self, occupation: str, tail: str) -> bool:
        """Whether a tail ("footballer") is about the occupation ("association football player"): one of the occupation's words is in it."""
        label = (self.occ.get(occupation) or ("", ""))[0].lower()
        return any(len(w) >= 4 and w in tail.lower() for w in words(label))

    def _ok(self, desc: str) -> bool:
        return all(self.df[w] >= MIN_WORD_DF or self.df[w.lower()] >= MIN_WORD_DF or w in self.known or w.lower() in self.known for w in words(desc))

    def _tidy(self, desc: str) -> str:
        """A trade written with a capital letter ("Spanish Footballer", "Alpine skier") is written as the other descriptions write it."""
        out = []
        for i, w in enumerate(desc.split(" ")):
            if i and w[:1].isupper() and w not in self.lead_tokens and self.df[w] < MIN_WORD_DF <= self.df[w.lower()] and w.isalpha():
                w = w.lower()
            out.append(w)
        return " ".join(out)

    def _with_nationality(self, desc: str, demonym: str | None) -> str:
        """A description that opens with a trade and not a nationality ("cyclist", "Olympic wrestler", "Canoe racer") takes the person's, as the others begin."""
        m = LEAD_CAPS.match(desc)
        if (
            not demonym or all(t in self.lead_tokens for t in re.split(r"[ \-–]", desc.split(" ")[0]))
            or (m and all(t in self.lead_tokens for t in re.split(r"[ \-–]", m.group(1))))
            or (" " not in desc and desc[:1].isupper()) or re.match(r"(?:former|retired|late|ex|one|two|three|double|triple|world)\b", desc, re.I)
        ):
            return desc
        first, _, rest = desc.partition(" ")
        if first[:1].isupper() and self.df[first.lower()] >= MIN_WORD_DF:
            first = first.lower()
        return f"{demonym} {first} {rest}".strip()

    def phrase(self, p: dict) -> tuple[str | None, str]:
        """(phrase, how): `description` when the person's own words are fit to show, `built` when assembled, (None, "") when neither."""
        country = (self.labels.get(p["p27"][0]) or {}).get("en") if p["p27"] else None
        demonym = self.demonym.get(country or "")
        shown = self._tidy(p["desc"]) if p["desc"] and self._ok(p["desc"]) else None
        if shown:
            ws = words(shown)
            # A nationality alone ("Romanian-Hungarian") or a single word that is not a trade ("Archery") says nothing of who he is.
            if all(w in self.lead_tokens for w in ws) or (len(ws) == 1 and shown[:1].isupper() and shown not in self.known):
                shown = None
        if shown:
            return self._with_nationality(shown, demonym), "description"
        if not p["occ"]:
            return None, ""  # the first occupation is not a sport one: nothing here can be said about him without the description
        tail = self.tail.get(p["occ"]) or (self.occ.get(p["occ"], ("", ""))[0].lower() or None)
        if not tail or DESC_REJECT.search(tail) or re.search(r"[\d()]", tail):
            return None, ""
        return (f"{demonym} {tail}" if demonym else tail), "built"


# ---- the extract ---------------------------------------------------------------------------------------------------------------------
def place_of(p: dict, labels: dict) -> str | None:
    q = p["p19"][0] if p["p19"] else None
    place = (labels.get(q) or {}).get("en") if q else None
    if not place or re.search(r"[\d()]", place):
        return None
    country = (labels.get((labels.get(q) or {}).get("country") or "") or {}).get("en")
    return f"{place}, {country}" if country and country != place else place


def rows_of(p: dict, phrase: str, labels: dict, kinds: set[str]) -> list[dict]:
    """The converter rows (a birth and a death at most) of one person; nothing is said that the person's own dates do not."""
    born, died = p["born"], p["died"]
    if born and died and (died < born or age_on(born, died) > MAX_AGE):
        return []
    country = labels.get(p["p27"][0]) if p["p27"] else None
    base = {
        "datePrecision": "day", "sport": p["sports"][0], "league": None, "competition": None,
        "person": {"personId": None, "qid": p["id"], "name": p["name"], "leagueCodes": [], "franchiseIds": [], "teamSeasonIds": []},
        "sourceId": "wikidata", "licence": "CC0 1.0", "attribution": "Wikidata contributors, CC0.", "sourceUrl": f"https://www.wikidata.org/wiki/{p['id']}",
        "epithet": phrase, "sitelinks": p["sl"], "basis": "source",
    }
    if country and country.get("iso"):
        base["nationality"] = country["iso"]
    out: list[dict] = []
    for kind, day, code in (("player-birthday", born, "b"), ("player-death", died, "d")):
        if code not in kinds or not day or day.endswith("-01-01") or not (ERA_START <= int(day[:4])) or day > DUMP_CEILING:
            continue
        row = {**base, "recordId": f"wikidata:{kind}:{p['id']}:{day}", "category": kind, "eventDate": day}
        if kind == "player-birthday":
            row["birthDate"] = day
            if died:
                row["deathDate"] = died
            row["livingStatus"] = "deceased" if p["died_any"] else "unknown"
            place = place_of(p, labels)
            if place:
                row["birthPlace"] = place
        else:
            row["deathDate"] = day
            row["livingStatus"] = "deceased"
            if born:
                row.update({
                    "birthDate": born, "bornYear": int(born[:4]), "ageYears": age_on(born, day),
                    "derivedRule": "Completed years from sourced birthDate to sourced death eventDate (last birthday before death).",
                    "derivedInputs": ["birthDate", "eventDate"],
                })
        out.append(row)
    return out


def _fame(p: dict) -> int:
    """The fame a selection counts: the editions, and five more for a person with an Olympic medal or a Hall of Fame behind him."""
    return p["sl"] + (5 if p["decorated"] else 0)


def select(people: list[dict], min_sl: int, per_day_sport: int, floor: int) -> set[tuple[str, str]]:
    """(person id, "b" or "d") kept: every one with `min_sl` editions or more, and the best `per_day_sport` of each day, sport and kind with `floor`."""
    groups: dict[tuple[str, str, str], list[tuple[int, str]]] = defaultdict(list)
    for p in people:
        for kind, day in (("b", p["born"]), ("d", p["died"])):
            if day and not day.endswith("-01-01"):
                groups[(day[5:], p["sports"][0], kind)].append((-_fame(p), p["id"]))
    kept: set[tuple[str, str]] = set()
    for (_, _, kind), g in groups.items():
        g.sort()
        for rank, (neg, pid) in enumerate(g):
            if -neg >= min_sl or (rank < per_day_sport and -neg >= floor):
                kept.add((pid, kind))
    return kept


def provenance(dump: Path) -> dict:
    """The dump the rows come from, for the data's metadata: its name and date, hashes, and the hash of each filtered file read."""
    summary = json.loads((dump / "summary.json").read_text(encoding="utf-8"))
    sha_file = dump / "latest-all.json.gz.sha256"
    sha = sha_file.read_text(encoding="utf-8").split()[0] if sha_file.exists() else None
    files = {}
    for name in ("people.jsonl.gz", "items.jsonl.gz", "events.jsonl.gz", "labels.jsonl.gz"):
        h = hashlib.sha256()
        with (dump / name).open("rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        files[name] = h.hexdigest()
    return {
        "source": "Wikidata (CC0 1.0), filtered by spx-stats scripts/wikidata_dump/filter.py", "dumpName": DUMP_NAME, "dumpDate": DUMP_DATE,
        "dumpMd5": (summary.get("dump") or {}).get("md5"), "dumpSha256": sha, "filteredFilesSha256": files,
        "peopleInFilteredFile": (summary.get("counts") or {}).get("people"),
    }


def build(dump: Path, min_sl: int, per_day_sport: int, floor: int):
    labels = load_labels(dump)
    occ = load_occupations(OCCUPATIONS)
    roles = sport_roles(occ)
    stats: Counter = Counter()
    editions: dict[str, int] = {}
    people = pool(dump, labels, occ, roles, floor, stats, editions)
    describer = Describer(people, labels, occ)
    kept = select(people, min_sl, per_day_sport, floor)
    rows: list[dict] = []
    how: Counter = Counter()
    built: dict[str, str] = {}
    for p in people:
        phrase, kind = describer.phrase(p)
        if kind == "built":
            built[p["id"]] = phrase
    for p in people:
        kinds = {k for k in ("b", "d") if (p["id"], k) in kept}
        if not kinds:
            continue
        phrase, kind = describer.phrase(p)
        if not phrase:
            stats["left out: no phrase to say who he is"] += 1
            continue
        made = rows_of(p, phrase, labels, kinds)
        if not made:
            stats["left out: dates do not agree (death before birth, or past 115 years)"] += 1
            continue
        how[kind] += len(made)
        rows.extend(made)
    rows.sort(key=lambda r: (r["eventDate"][5:], r["eventDate"], r["recordId"]))
    return rows, people, describer, stats, how, editions, built


def _real_day(month: int, day: int) -> bool:
    try:
        date(2024, month, day)
        return True
    except ValueError:
        return False


def report(rows: list[dict], stats: Counter, how: Counter) -> dict:
    """Counts a person reads to see what was made: by kind, by sport, by day (fewest and middle), and the gaps."""
    by_day: Counter = Counter(r["eventDate"][5:] for r in rows)
    days = [f"{m:02d}-{d:02d}" for m in range(1, 13) for d in range(1, 32) if _real_day(m, d)]
    counts = sorted(by_day.get(d, 0) for d in days)
    sports_by_day: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        sports_by_day[r["eventDate"][5:]].add(r["sport"])
    sd = sorted(len(sports_by_day.get(d, ())) for d in days)
    return {
        "rows": len(rows), "births": sum(1 for r in rows if r["category"] == "player-birthday"), "deaths": sum(1 for r in rows if r["category"] == "player-death"),
        "phrase from the person's own description": how["description"], "phrase built from occupation and country": how["built"],
        "bySport": dict(Counter(r["sport"] for r in rows).most_common()),
        "perDay": {"min": counts[0], "median": counts[len(counts) // 2], "max": counts[-1], "daysWithNone": [d for d in days if not by_day.get(d)]},
        "sportsPerDay": {"min": sd[0], "median": sd[len(sd) // 2], "max": sd[-1]},
        "leftOut": dict(stats),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dump", default=str(DUMP_DIR))
    ap.add_argument("--out", default=str(EXTRACT_DIR))
    ap.add_argument("--min-sitelinks", type=int, default=30)
    ap.add_argument("--per-day-sport", type=int, default=2)
    ap.add_argument("--floor", type=int, default=10)
    ap.add_argument("--report", action="store_true", help="print the counts and write nothing")
    args = ap.parse_args()
    dump = Path(args.dump)
    rows, people, describer, stats, how, editions, built = build(dump, args.min_sitelinks, args.per_day_sport, args.floor)
    summary = report(rows, stats, how)
    print(json.dumps(summary, indent=1, ensure_ascii=False))
    if args.report:
        return 0
    meta = {
        **provenance(dump),
        "options": {"minSitelinks": args.min_sitelinks, "perDaySport": args.per_day_sport, "floor": args.floor},
        "report": {k: v for k, v in summary.items() if k != "bySport"},
    }
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    body = {"meta": meta, "records": rows, "sitelinks": editions, "builtPhrases": built}
    (out / OUT_NAME).write_text(json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {out / OUT_NAME}: {len(rows)} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
