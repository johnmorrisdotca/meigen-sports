"""The rebuild guard: compare freshly built facts with the published ones and stop a rebuild that loses something.

A fact is lost when its `recordId` is in the published set and not in the new one; an id has changed when a lost fact and a new one are the same thing
(same day, same kind, same subject) under two ids; a category count has dropped when the new set has fewer facts of a category than the published one.
Each of the three fails the rebuild unless `data-sources/rebuild-allow.json` lists it with a reason. Added and changed facts (same id, other content)
are only counted. The published facts are those of the last release tag (`git`), so an allowance holds until the next release and then must be written again.

    {"baseline": "0.24.0", "entries": [
      {"kind": "removed", "recordId": "spx:game:1", "reason": "..."},
      {"kind": "removed", "category": "game-on-day", "max": 2, "reason": "..."},
      {"kind": "id-changed", "recordId": "spx:final:7", "reason": "..."},
      {"kind": "count-drop", "category": "award", "max": 1, "reason": "..."},
      {"kind": "changed", "category": "player-birthday", "field": "birthPlace", "max": 989, "reason": "..."}]}

A fact that keeps its id but changes a field (a birth place, a sentence) is counted by category and field and stops the rebuild beyond what a "changed" entry allows:
a rebuild from an extract made before a fix would otherwise quietly undo it.
"""
from __future__ import annotations

import gzip
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

KINDS = ("removed", "id-changed", "count-drop", "changed")


def read_facts_at(root: Path, ref: str) -> dict[str, dict]:
    """The facts committed at a git ref (`data-sources/facts/*.jsonl.gz`), by recordId."""
    listing = subprocess.run(["git", "-C", str(root), "ls-tree", "--name-only", ref, "data-sources/facts/"], capture_output=True, text=True)
    if listing.returncode:
        raise SystemExit(f"rebuild guard: cannot read the published facts at {ref}: {listing.stderr.strip()}")
    facts: dict[str, dict] = {}
    for name in listing.stdout.split():
        if not name.endswith(".jsonl.gz"):
            continue
        blob = subprocess.run(["git", "-C", str(root), "show", f"{ref}:{name}"], capture_output=True, check=True).stdout
        for line in gzip.decompress(blob).decode("utf-8").splitlines():
            row = json.loads(line)
            facts[row["recordId"]] = row
    if not facts:
        raise SystemExit(f"rebuild guard: no published facts at {ref}")
    return facts


def offline_ids_at(root: Path, ref: str) -> set[str]:
    """The recordIds of the offline set published at a git ref (src/data/offline.ts)."""
    blob = subprocess.run(["git", "-C", str(root), "show", f"{ref}:src/data/offline.ts"], capture_output=True, text=True)
    if blob.returncode:
        return set()
    return set(re.findall(r'"recordId":"([^"]+)"', blob.stdout))


def last_release_ref(root: Path) -> str:
    out = subprocess.run(["git", "-C", str(root), "describe", "--tags", "--abbrev=0", "--match", "v*", "HEAD"], capture_output=True, text=True)
    if out.returncode:
        raise SystemExit("rebuild guard: no release tag (v*) to compare with; pass --baseline <git ref>")
    return out.stdout.strip()


def subject_key(fact: dict) -> tuple:
    """What a fact is about, whatever its id: day, kind and the first of the game, the person, the Wikidata item, the text."""
    person = fact.get("person") or {}
    about = fact.get("gameId") or person.get("qid") or fact.get("wikidata") or fact.get("entityId") or fact.get("text") or ""
    return (fact.get("eventDate"), fact.get("category"), str(about))


def compare(old: dict[str, dict], new: dict[str, dict]) -> dict:
    """The differences between two sets of facts, by category."""
    gone = [i for i in old if i not in new]
    added = [i for i in new if i not in old]
    by_subject: dict[tuple, list[str]] = defaultdict(list)
    for i in added:
        by_subject[subject_key(new[i])].append(i)
    id_changed: dict[str, str] = {}
    for i in gone:
        twins = by_subject.get(subject_key(old[i]))
        if twins:
            id_changed[i] = twins.pop(0)
    removed = [i for i in gone if i not in id_changed]
    changed = [i for i in old if i in new and old[i] != new[i]]
    fields: dict[str, Counter] = defaultdict(Counter)
    for i in changed:
        for key in set(old[i]) | set(new[i]):
            if old[i].get(key) != new[i].get(key):
                fields[old[i].get("category", "?")][key] += 1
    cats = sorted({f.get("category", "?") for f in old.values()} | {f.get("category", "?") for f in new.values()})
    old_n = Counter(f.get("category", "?") for f in old.values())
    new_n = Counter(f.get("category", "?") for f in new.values())
    per = {c: {"before": old_n[c], "after": new_n[c],
               "added": sum(1 for i in added if new[i].get("category", "?") == c and i not in id_changed.values()),
               "changed": sum(1 for i in changed if old[i].get("category", "?") == c),
               "removed": sum(1 for i in removed if old[i].get("category", "?") == c),
               "idChanged": sum(1 for i in id_changed if old[i].get("category", "?") == c),
               "changedFields": dict(fields[c].most_common()), "topChangedFields": dict(fields[c].most_common(5))} for c in cats}
    return {"categories": per, "removed": removed, "idChanged": id_changed, "added": added, "changed": changed,
            "countDrops": {c: old_n[c] - new_n[c] for c in cats if new_n[c] < old_n[c]},
            "before": len(old), "after": len(new)}


def load_allow(path: Path) -> dict:
    if not path.exists():
        return {"baseline": None, "entries": []}
    return json.loads(path.read_text(encoding="utf-8"))


def judge(diff: dict, old: dict[str, dict], allow: dict, baseline_version: str, offline_ids: set[str] | None = None) -> list[str]:
    """The reasons the rebuild must stop; empty when every loss is allowed with a reason."""
    entries = allow.get("entries") or []
    errors: list[str] = []
    for n, e in enumerate(entries, 1):
        if e.get("kind") not in KINDS:
            errors.append(f"rebuild-allow.json entry {n}: kind must be one of {', '.join(KINDS)}")
        if len(str(e.get("reason") or "").strip()) < 10:
            errors.append(f"rebuild-allow.json entry {n}: a reason of at least 10 characters is required")
        if not (e.get("recordId") or e.get("category")):
            errors.append(f"rebuild-allow.json entry {n}: name a recordId or a category")
        if e.get("kind") == "changed" and not (e.get("category") and e.get("field")):
            errors.append(f"rebuild-allow.json entry {n}: a changed entry names a category and a field")
    if entries and allow.get("baseline") != baseline_version:
        errors.append(f"rebuild-allow.json is for {allow.get('baseline')}, the published facts are {baseline_version}: write the allowances again for this release")
    used = [0] * len(entries)

    def allowed(kind: str, record_id: str, category: str) -> bool:
        for n, e in enumerate(entries):
            if e.get("kind") != kind:
                continue
            if e.get("recordId") == record_id:
                used[n] += 1
                return True
            if e.get("category") == category and not e.get("recordId") and used[n] < int(e.get("max") or 0):
                used[n] += 1
                return True
        return False

    for i in diff["removed"]:
        if not allowed("removed", i, old[i].get("category", "?")):
            errors.append(f"lost fact {i} ({old[i].get('category')}, {old[i].get('eventDate')})")
    for i, j in diff["idChanged"].items():
        if not allowed("id-changed", i, old[i].get("category", "?")):
            errors.append(f"changed id {i} -> {j} ({old[i].get('category')}, {old[i].get('eventDate')})")
    for c, n in diff["countDrops"].items():
        covered = sum(int(e.get("max") or 0) for e in entries if e.get("kind") == "count-drop" and e.get("category") == c)
        for k, e in enumerate(entries):
            if e.get("kind") == "count-drop" and e.get("category") == c:
                used[k] += 1
        if n > covered:
            errors.append(f"count of {c} dropped by {n} ({diff['categories'][c]['before']} to {diff['categories'][c]['after']})")
    for c, p in diff["categories"].items():
        for field, n in p["changedFields"].items():
            matching = [k for k, e in enumerate(entries) if e.get("kind") == "changed" and e.get("category") == c and e.get("field") == field]
            for k in matching:
                used[k] += 1
            if n > sum(int(entries[k].get("max") or 0) for k in matching):
                errors.append(f"{n} {c} fact(s) changed {field} (same id, other content)")
    lost_offline = sorted(i for i in (offline_ids or ()) if i in set(diff["removed"]) | set(diff["idChanged"]))
    if lost_offline:
        errors.append(f"{len(lost_offline)} fact(s) of the published offline set are lost: {', '.join(lost_offline[:5])}")
    for n, e in enumerate(entries):
        if not used[n]:
            errors.append(f"rebuild-allow.json entry {n + 1} ({e.get('kind')} {e.get('recordId') or e.get('category')}) matches nothing: delete it")
    return errors


def summary(diff: dict) -> str:
    rows = ["category              before    after   added  changed  removed  idChanged"]
    for c, p in diff["categories"].items():
        rows.append(f"{c:<20}{p['before']:>8}{p['after']:>9}{p['added']:>8}{p['changed']:>9}{p['removed']:>9}{p['idChanged']:>11}")
    total = {k: sum(p[k] for p in diff["categories"].values()) for k in ("added", "changed", "removed", "idChanged")}
    rows.append(f"{'all':<20}{diff['before']:>8}{diff['after']:>9}{total['added']:>8}{total['changed']:>9}{total['removed']:>9}{total['idChanged']:>11}")
    for c, p in diff["categories"].items():
        if p["topChangedFields"]:
            rows.append(f"  changed {c}: " + ", ".join(f"{k} {n}" for k, n in p["topChangedFields"].items()))
    return "\n".join(rows)


def check(root: Path, new_facts: list[dict], ref: str | None = None, report_path: Path | None = None) -> int:
    """Compare with the published facts, print the summary, return 0 when the rebuild may be written."""
    ref = ref or last_release_ref(root)
    old = read_facts_at(root, ref)
    new = {f["recordId"]: f for f in new_facts}
    diff = compare(old, new)
    print(f"rebuild guard: new facts against {ref}\n{summary(diff)}")
    errors = judge(diff, old, load_allow(root / "data-sources/rebuild-allow.json"), ref.lstrip("v"), offline_ids_at(root, ref))
    if report_path:
        report_path.write_text(json.dumps({"baseline": ref, **{k: diff[k] for k in ("categories", "removed", "idChanged", "added", "changed")}}, indent=1) + "\n", encoding="utf-8")
    if errors:
        print(f"rebuild guard: STOPPED, {len(errors)} problem(s); nothing was written. List what is meant in data-sources/rebuild-allow.json with a reason each.", file=sys.stderr)
        for line in errors[:40]:
            print("  " + line, file=sys.stderr)
        if len(errors) > 40:
            print(f"  ... {len(errors) - 40} more (use --report <file> for the full lists)", file=sys.stderr)
        return 1
    print("rebuild guard: ok")
    return 0
