#!/bin/bash
# Runs the person extractors against a scratch Postgres (never DS1) and checks the answers.
# Container meigen-061-scratch on 127.0.0.1:7402 (this package's port block), removed by name when done.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NAME=meigen-061-scratch
PORT="${MEIGEN_SCRATCH_PORT:-7402}"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres PGSSLMODE=disable
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "port $PORT is in use" >&2; exit 1; fi
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_HOST_AUTH_METHOD=trust -p "127.0.0.1:${PORT}:5432" postgres:17-alpine >/dev/null
for _ in $(seq 1 30); do pg_isready -q && break; sleep 1; done
sleep 2
psql -v ON_ERROR_STOP=1 -q -f "$HERE/test/person_context_scratch.sql"

MEIGEN_QUERIES="${MEIGEN_QUERIES:-}" python3 -I - "$HERE" <<'PY'
import json, os, subprocess, sys
here = sys.argv[1]
queries = os.environ.get("MEIGEN_QUERIES") or f"{here}/queries"
def last_json(sql, **v):
    args = ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"] + [x for k, val in v.items() for x in ("-v", f"{k}={val}")] + ["-f", f"{queries}/{sql}"]
    lines = [l for l in subprocess.run(args, capture_output=True, text=True, check=True).stdout.splitlines() if l.startswith("{")]
    return json.loads(lines[-1])
bad = []
def expect(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok: bad.append(msg)

ctx = {r["person"]["personId"]: r for r in last_json("extract_person_context.sql", after_id=0, page_limit=2000)["records"]}
expect(not any(a["name"] == "Cy Young Award" for a in ctx[1]["awards"]), "Mantle is not a Cy Young winner (a teammate's award is not his)")
expect([a["code"] for a in ctx[1]["awards"]] == ["mlb_mvp"], "Mantle's awards are his own: the MVP")
expect([a["code"] for a in ctx[2]["awards"]] == ["mlb_cy_young"], "the pitcher keeps his Cy Young Award")
expect(ctx[3]["clubNames"] == ["Texas Rangers (1996)"], "a player with statistics and no roster row has his club")
expect(ctx[4]["clubNames"] == [] and ctx[4]["championships"] == 0, "a coach has no club as a player and no title as one")
expect(ctx[1]["championships"] == 1 and ctx[1]["championshipName"] == "World Series", "a title counts for the person who played in that team-season")
expect(ctx[2]["championships"] == 1, "a stats-only player counts for his club's title too")
expect(ctx[1]["hallOfFameYear"] == 1974 and ctx[2]["hallOfFameYear"] is None, "Hall of Fame year comes through, null when none")
expect(ctx[3]["awards"] == [] and ctx[3]["awardCount"] == 0, "no awards is an empty list")
page = last_json("extract_person_context.sql", after_id=2, page_limit=1)
expect([r["person"]["personId"] for r in page["records"]] == [3] and page["nextCursor"] == {"id": 3}, "the cursor pages by person_id")

for sql, key in (("player-birthday-candidates.sql", "1900-01-01"),):
    rows = {r["person"]["personId"]: r for r in last_json(sql, after_date="0001-01-01", after_id=0, page_limit=2000)["records"]}
    expect(rows[1].get("personAward") == "Major League Baseball Most Valuable Player Award", f"{sql}: Mantle's best award is his MVP")
    expect(rows[3]["clubNames"] == ["Texas Rangers (1996)"] and rows[3]["league"] == "mlb", f"{sql}: a stats-only player has his club and league")
    expect(rows[2]["personAward"] == "Cy Young Award" and rows[2]["championships"] == 1, f"{sql}: the pitcher has his own award and the club's title")
    expect(rows[4]["clubNames"] == [], f"{sql}: a coach has no playing club")
# The paging runner merges pages into one file, and a page of two gives the same records as one page of all.
import tempfile
with tempfile.TemporaryDirectory() as out:
    for size in (2, 2000):
        done = subprocess.run([sys.executable, "-I", f"{here}/page_extract.py", f"{queries}/extract_person_context.sql", "--page", str(size), "--out", out + f"/{size}"], capture_output=True, text=True, check=True)
    merged = [json.load(open(out + f"/{n}/extract_person_context.json")) for n in (2, 2000)]
    expect(merged[0]["pages"] == 3 and merged[1]["pages"] == 1, "page_extract.py pages until the cursor ends")
    expect(merged[0]["records"] == merged[1]["records"] and len(merged[0]["records"]) == 4, "page_extract.py: pages merge to the same records")
if bad:
    sys.exit(f"{len(bad)} check(s) failed")
print("person extractors: all checks passed")
PY
