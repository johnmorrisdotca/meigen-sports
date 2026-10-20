#!/bin/bash
# Runs extract_final_context.sql against a scratch Postgres (never DS1) and checks the answers.
# Container meigen-063-scratch on 127.0.0.1:7403 (this package's port block), removed by name when done.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NAME=meigen-063-scratch
PORT="${MEIGEN_SCRATCH_PORT:-7403}"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres PGSSLMODE=disable
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "port $PORT is in use" >&2; exit 1; fi
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_HOST_AUTH_METHOD=trust -p "127.0.0.1:${PORT}:5432" postgres:17-alpine >/dev/null
for _ in $(seq 1 30); do pg_isready -q && break; sleep 1; done
sleep 2
psql -v ON_ERROR_STOP=1 -q -f "$HERE/test/final_context_scratch.sql"

python3 -I - "$HERE" <<'PY'
import json, subprocess, sys
here = sys.argv[1]
def run(**v):
    args = ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"] + [x for k, val in v.items() for x in ("-v", f"{k}={val}")] + ["-f", f"{here}/queries/extract_final_context.sql"]
    lines = [l for l in subprocess.run(args, capture_output=True, text=True, check=True).stdout.splitlines() if l.startswith("{")]
    return json.loads(lines[-1])
bad = []
def expect(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok: bad.append(msg)
rows = {r["gameId"]: r for r in run(after_id=0, page_limit=2000)["records"]}
reds = rows[1]
expect(reds["venueName"] == "Oakland-Alameda County Coliseum" and reds["venueCity"] == "Oakland", "the venue's name is the one it had that day, with its city")
expect(reds["winnerRecord"] == {"wins": 91, "losses": 71}, "two sources that agree give the record; a mid-season row is ignored; no ties key for baseball without a tie")
expect(reds["winnerTitleNumber"] == 3, "the Reds' third title: 1975, 1976, 1990; a season recorded as not awarded is not a gap")
expect(rows[2].get("winnerRecord") is None or rows[2]["winnerRecord"].get("wins") == 91, "game 3's winner is the Reds too")
expect(rows[2]["venueName"] == "Riverfront Stadium", "another game of the round has its own venue")
lakers = rows[3]
expect("winnerTitleNumber" not in lakers and lakers["titleCountCheck"]["gapSeasons"] == 1, "a season with no champion on record before it means no title number, and says why")
expect(lakers["winnerRecord"] == {"wins": 63, "losses": 19}, "a basketball record has no ties key when ties are zero")
devils = rows[4]
expect(devils["winnerRecord"] == {"wins": 46, "losses": 20, "ties": 10, "otLosses": 6}, "a hockey record keeps ties and overtime losses")
expect(devils["venueName"] is None if "venueName" in devils else True, "a venue with no name on that day is left out, never guessed")
expect(devils["winnerTitleNumber"] == 1, "a first title is number one")
page = run(after_id=1, page_limit=1)
expect([r["gameId"] for r in page["records"]] == [2] and page["nextCursor"] == {"id": 2}, "the cursor pages by game id")
if bad:
    sys.exit(f"{len(bad)} check(s) failed")
print("final context extractor: all checks passed")
PY
