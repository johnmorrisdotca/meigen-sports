-- Read-only keyset page of season-final games (day precision).
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_id=0 -v page_limit=500 -f pipeline/queries/extract_finals.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select g.game_id, g.game_date, s.league_code, s.start_year,
         src.code as source_code, src.licence, src.attribution
  from core.venue_final_game f
  join core.game g on g.game_id = f.game_id
  join core.season s on s.season_id = f.season_id
  join meta.source src on src.source_id = g.source_id
  where (g.game_date, g.game_id) > (:'after_date'::date, :'after_id'::bigint)
  order by g.game_date, g.game_id
  limit :page_limit
)
select jsonb_build_object(
  'category', 'championship-final',
  'scannedCount', (select count(*) from page),
  'nextCursor', (select jsonb_build_object('date', game_date, 'id', game_id) from page order by game_date desc, game_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:final:' || game_id::text,
      'category', 'championship-final',
      'reviewStatus', 'candidate',
      'datePrecision', 'day',
      'eventDate', game_date,
      'league', league_code,
      'seasonStartYear', start_year,
      'sourceId', source_code,
      'licence', licence,
      'attribution', attribution
    ) order by game_date, game_id) from page), '[]'::jsonb)
)::text;
rollback;
