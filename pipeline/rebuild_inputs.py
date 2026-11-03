"""Everything `pnpm data:facts` reads, and the checks that stop a rebuild when an input is missing, empty or older than what it follows.

`convert_extract.py` used to print "missing <file>" and carry on with an empty list, so a rebuild on a Mac that lacked two extracts quietly lost the facts
they gave. A rebuild now needs every input below; `problems()` lists each one that is wrong, by file name, with the command that makes it.
`checksums()` is the SHA-256 of every input, written beside the facts (`data-sources/facts/inputs.json`) so a later rebuild can say what it was made from.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

BIG = 50_000_000  # a file larger than this is not parsed to look for an empty list (extract_games_on_day.json is 450 MB)

DS1 = "the DS1 extracts (`python3 -I pipeline/extract_ds1.py` prints the commands; machine1 runs them and copies the files)"
DUMP = "the Wikidata dump passes (need the filtered dump files on machine1)"

# name -> what it is, how it is made, the lists that must not be empty ("" is a bare list), the extracts it must not be older than.
EXTRACTS: dict[str, dict] = {
    "player-birthday-candidates.json": {"made": DS1, "lists": ("records",)},
    "extract_deaths.json": {"made": DS1, "lists": ("records",)},
    "extract_games_on_day.json": {"made": DS1, "lists": ("records",)},
    "extract_soccer_on_day.json": {"made": DS1, "lists": ("records",)},
    "extract_finals.json": {"made": DS1, "lists": ("records",)},
    "extract_final_context.json": {"made": DS1, "lists": ("records",)},
    "extract_awards_season.json": {"made": DS1, "lists": ("records",)},
    "extract_person_context.json": {"made": DS1, "lists": ("records",)},
    "extract_person_jersey.json": {"made": DS1, "lists": ("",)},
    "extract_retired_numbers.json": {"made": DS1, "lists": ("",)},
    "extract_franchise_events.json": {"made": DS1, "lists": ("records",)},
    "extract_venue_openings.json": {"made": DS1, "lists": ("records",)},
    "extract_nhl_career_records.json": {"made": "pipeline/queries/extract_nhl_career_records.sql on DS1 (machine1 runs it)", "lists": ("records",)},
    "extract_drafts.json": {"made": DS1, "lists": (), "empty_ok": "DS1 holds no draft rows yet (the facts say draftsOnDisk 0)"},
    "extract_all_star.json": {"script": "pipeline/extract_all_star.py", "made": "`python3 -I pipeline/extract_all_star.py`", "lists": ("games", "events")},
    "extract_mlb_feats.json": {"script": "pipeline/extract_mlb_feats.py", "made": "`python3 -I pipeline/extract_mlb_feats.py`", "lists": ("records",)},
    "extract_milestones.json": {"script": "pipeline/extract_milestones.py", "made": "`pnpm data:milestones`", "lists": ("records",)},
    "extract_wikidata_famous.json": {"script": "pipeline/fetch_wikidata_open.py", "made": "`python3 -I pipeline/fetch_wikidata_open.py`", "lists": ("records",)},
    "extract_wikidata_dump_people.json": {"script": "pipeline/wikidata_dump_people.py", "made": "`pnpm data:dump`; " + DUMP, "lists": ("records",)},
    "extract_wikidata_dump_events.json": {"script": "pipeline/wikidata_dump_events.py", "made": "`pnpm data:events`; " + DUMP, "lists": ("records",)},
    "extract_wikidata_dump_para.json": {"script": "pipeline/wikidata_dump_para.py", "made": "`pnpm data:para`; " + DUMP, "lists": ("records",), "after": ("extract_wikidata_dump_people.json",)},
    "extract_wikidata_links.json": {
        "script": "pipeline/wikidata_links.py", "made": "`python3 -I pipeline/wikidata_links.py`, after the passes above; " + DUMP, "lists": ("people", "events"),
        "after": ("extract_wikidata_dump_people.json", "extract_wikidata_dump_events.json", "extract_wikidata_dump_para.json", "player-birthday-candidates.json",
                  "extract_deaths.json", "extract_person_context.json", "extract_awards_season.json"),
    },
    "extract_dated_names.json": {
        "script": "pipeline/extract_dated_names.py", "made": "`python3 -I pipeline/extract_dated_names.py`, last of the DB extracts", "lists": ("clubs", "venues", "games"),
        "after": ("extract_games_on_day.json", "extract_finals.json", "extract_franchise_events.json", "extract_retired_numbers.json", "extract_all_star.json"),
    },
}

# Files in the repository the converter reads (a missing or empty one is a broken checkout, not a missing extract).
REPO_FILES = (
    "data-sources/trophies.json", "data-sources/para-sports.json", "data-sources/disputed-dates.json", "data-sources/game-corrections.json",
    "data-sources/priority-athletes.csv", "data-sources/priority-facts.jsonl", "data-sources/people.csv", "data-sources/people-profiles.csv",
    "pipeline/golden/finals-check.json",
    "pipeline/ds1-people/spx-stats/db/seed/wikidata_meigen_bio.csv", "pipeline/ds1-people/spx-stats/db/seed/wikidata_meigen_wiki_page.csv",
)


def _size_of_list(data, key: str) -> int:
    value = data if key == "" else (data.get(key) if isinstance(data, dict) else None)
    return len(value) if isinstance(value, (list, dict)) else 0


def _big_file_has_rows(path: Path, key: str) -> bool:
    with path.open("rb") as fh:
        head = fh.read(4096).decode("utf-8", "replace")
    at = head.find(f'"{key}"')
    if at < 0:
        return False
    rest = head[at:].split("[", 1)
    return len(rest) == 2 and not rest[1].lstrip().startswith("]")


def problems(extract_dir: Path, root: Path) -> list[str]:
    """Every wrong input, one line each, naming the file and what makes it."""
    found: list[str] = []
    if not extract_dir.is_dir():
        return [f"extract directory missing: {extract_dir} (set MEIGEN_EXTRACT_DIR)"]
    for name, spec in EXTRACTS.items():
        path = extract_dir / name
        if not path.exists():
            found.append(f"missing {path}: made by {spec['made']}")
            continue
        if path.stat().st_size == 0:
            found.append(f"empty file {path}: made by {spec['made']}")
            continue
        try:
            if path.stat().st_size > BIG:
                empties = [key for key in spec["lists"] if not _big_file_has_rows(path, key)]
            else:
                data = json.loads(path.read_text(encoding="utf-8"))
                empties = [key for key in spec["lists"] if not _size_of_list(data, key)]
        except ValueError as error:
            found.append(f"{path} is not valid JSON ({error}): made by {spec['made']}")
            continue
        if empties:
            found.append(f"{path} has no {', '.join(k or 'rows' for k in empties)}: made by {spec['made']}")
    for name, spec in EXTRACTS.items():
        path = extract_dir / name
        if not path.exists():
            continue
        newer = [other for other in spec.get("after", ()) if (extract_dir / other).exists() and (extract_dir / other).stat().st_mtime > path.stat().st_mtime]
        if newer:
            found.append(f"{path} is older than {', '.join(newer)}, which it follows: make it again ({spec['made']}); copy files with `cp -p` so their times stay true")
    for name in REPO_FILES:
        path = root / name
        if not path.exists() or path.stat().st_size == 0:
            found.append(f"missing or empty {path}: it is part of the repository (git checkout)")
    return found


def warnings(extract_dir: Path, root: Path) -> list[str]:
    """Extracts made before the last commit of the script that makes them (the script may have changed what it writes). Not a stop: the guard compares the result."""
    import subprocess
    out: list[str] = []
    for name, spec in EXTRACTS.items():
        path, script = extract_dir / name, spec.get("script")
        if not script or not path.exists():
            continue
        done = subprocess.run(["git", "-C", str(root), "log", "-1", "--format=%ct", "--", script], capture_output=True, text=True)
        if done.returncode == 0 and done.stdout.strip() and int(done.stdout) > path.stat().st_mtime:
            out.append(f"warning: {path} is older than the last change of {script}: make it again if that change touched what it writes")
    return out


def links_problems(extract_dir: Path, wanted: tuple[set, set]) -> list[str]:
    """`extract_wikidata_links.json` counts the people and events its rows were made for in its report; a different count now means it was made from other extracts."""
    path = extract_dir / "extract_wikidata_links.json"
    if not path.exists():
        return []
    report = (json.loads(path.read_text(encoding="utf-8")).get("meta") or {}).get("report") or {}
    made = (report.get("people named by the facts"), report.get("events named by the facts"))
    now = (len(wanted[0]), len(wanted[1]))
    if made != now:
        return [f"{path} was made for {made[0]} people and {made[1]} events but the extracts now name {now[0]} and {now[1]}: run `python3 -I pipeline/wikidata_links.py` again"]
    return []


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checksums(extract_dir: Path, root: Path) -> dict[str, dict]:
    """name -> sha256 and bytes of every input (extracts by file name, repository files by their path)."""
    out: dict[str, dict] = {}
    for name in EXTRACTS:
        path = extract_dir / name
        if path.exists():
            out[name] = {"sha256": sha256_of(path), "bytes": path.stat().st_size}
    for name in REPO_FILES:
        path = root / name
        if path.exists():
            out[name] = {"sha256": sha256_of(path), "bytes": path.stat().st_size}
    return out
