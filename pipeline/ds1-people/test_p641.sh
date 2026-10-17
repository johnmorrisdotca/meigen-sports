#!/bin/bash
# Scratch Postgres for P641 → person_sport. Removes the container by name when done.
# Never talks to DS1 or production.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NAME=spx-meigen-p641-scratch
PORT=7745
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=spx_stats PGSSLMODE=disable

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $PORT is in use" >&2
  exit 1
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=spx_stats \
  -p 127.0.0.1:${PORT}:5432 \
  postgres:17-alpine >/dev/null

for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if pg_isready -h 127.0.0.1 -p "$PORT" -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
pg_isready -h 127.0.0.1 -p "$PORT" -U postgres

psql -v ON_ERROR_STOP=1 -q -f "$HERE/scratch_schema.sql"
psql -v ON_ERROR_STOP=1 -q -f "$HERE/121_legacy_wikidata_meigen.sql"

psql -v ON_ERROR_STOP=1 -q <<'SQL'
create schema if not exists legacy_wikidata_harvest;
create table legacy_wikidata_harvest.claim (
  qid text, prop text, n int, rank text, value_qid text,
  value_on date, value_prec smallint, value_num numeric, unit_qid text, value_text text
);
create schema if not exists legacy_people;
create table legacy_people.claim (
  qid text, prop text, n smallint, rank text, value_qid text
);

insert into core.person (full_name, kind, source_id)
select 'Wayne Gretzky', 'player', source_id from meta.source where code = 'wikidata';
insert into core.external_id (entity_kind, entity_id, source_id, external_key)
select 'person', p.person_id, s.source_id, 'Q209518'
from core.person p, meta.source s
where p.full_name = 'Wayne Gretzky' and s.code = 'wikidata';

insert into core.person (full_name, kind, source_id)
select 'David Gould', 'player', source_id from meta.source where code = 'wikidata';
insert into core.external_id (entity_kind, entity_id, source_id, external_key)
select 'person', p.person_id, s.source_id, 'Q2480154'
from core.person p, meta.source s
where p.full_name = 'David Gould' and s.code = 'wikidata';

insert into core.person (full_name, kind, source_id)
select 'Myong-won Kim', 'player', source_id from meta.source where code = 'wikidata';
insert into core.external_id (entity_kind, entity_id, source_id, external_key)
select 'person', p.person_id, s.source_id, 'Q704476'
from core.person p, meta.source s
where p.full_name = 'Myong-won Kim' and s.code = 'wikidata';

insert into core.person (full_name, kind, source_id)
select 'Tennis Only', 'player', source_id from meta.source where code = 'wikidata';
insert into core.external_id (entity_kind, entity_id, source_id, external_key)
select 'person', p.person_id, s.source_id, 'Q9990009'
from core.person p, meta.source s
where p.full_name = 'Tennis Only' and s.code = 'wikidata';

-- harvest P641 for Gretzky; legacy_people P641 for Gould (soccer).
insert into legacy_wikidata_harvest.claim (qid, prop, n, rank, value_qid)
values ('Q209518', 'P641', 0, 'normal', 'Q41466');
insert into legacy_people.claim (qid, prop, n, rank, value_qid)
values ('Q2480154', 'P641', 0, 'normal', 'Q2736');
-- unmapped tennis item: must not invent a sport_code
insert into legacy_people.claim (qid, prop, n, rank, value_qid)
values ('Q9990009', 'P641', 0, 'normal', 'Q847');
-- Kim: no P641
SQL

echo "216 first run:"
FIRST=$(psql -1 -v ON_ERROR_STOP=1 -q -At -F $'\t' -f "$HERE/216_person_sport_p641.sql")
echo "$FIRST"
echo "216 second run:"
SECOND=$(psql -1 -v ON_ERROR_STOP=1 -q -At -F $'\t' -f "$HERE/216_person_sport_p641.sql")
echo "$SECOND"
if [ "$FIRST" = "$SECOND" ]; then
  echo "ok second_run_idempotent"
else
  echo "FAIL second_run_idempotent first=$FIRST second=$SECOND"
  exit 1
fi

psql -v ON_ERROR_STOP=1 -At <<'SQL'
select
  case when (select ps.sport_code from core.person_sport ps
             join core.external_id x on x.entity_id = ps.person_id
             where x.external_key = 'Q209518' and ps.source_key like 'p641-map:%') = 'hockey'
       then 'ok gretzky_hockey' else 'FAIL gretzky_hockey' end;
select
  case when (select ps.sport_code from core.person_sport ps
             join core.external_id x on x.entity_id = ps.person_id
             where x.external_key = 'Q2480154' and ps.source_key like 'p641-map:%') = 'soccer'
       then 'ok gould_soccer' else 'FAIL gould_soccer' end;
select
  case when not exists (
        select 1 from core.person_sport ps
        join core.external_id x on x.entity_id = ps.person_id
        where x.external_key in ('Q704476', 'Q9990009'))
       then 'ok unmapped_skipped' else 'FAIL unmapped_skipped' end;
select 'sports=' || count(*) from core.person_sport where source_key like 'p641-map:%';
SQL

role_out="$(psql -v ON_ERROR_STOP=1 -Atc "set role anon; select count(*) from api.person_sports;")"
echo "ok anon_person_sports=$role_out"
echo "scratch p641 ok"
