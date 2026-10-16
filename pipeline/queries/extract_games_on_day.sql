-- Read-only keyset page of five-league games with an exact game_date.
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_id=0 -v page_limit=500 -f pipeline/queries/extract_games_on_day.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select g.game_id, g.game_date, s.league_code, g.phase, g.status,
         g.home_score, g.away_score, src.code as source_code, src.licence, src.attribution
  from core.game g
  join core.season s on s.season_id = g.season_id
  join meta.source src on src.source_id = g.source_id
  where (g.game_date, g.game_id) > (:'after_date'::date, :'after_id'::bigint)
  order by g.game_date, g.game_id
  limit :page_limit
)
select jsonb_build_object(
  'category', 'game-on-day',
  'scannedCount', (select count(*) from page),
  'nextCursor', (select jsonb_build_object('date', game_date, 'id', game_id) from page order by game_date desc, game_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:game:' || game_id::text,
      'category', 'game-on-day',
      'reviewStatus', 'candidate',
      'datePrecision', 'day',
      'eventDate', game_date,
      'league', league_code,
      'phase', phase,
      'status', status,
      'homeScore', home_score,
      'awayScore', away_score,
      'sourceId', source_code,
      'licence', licence,
      'attribution', attribution
    ) order by game_date, game_id) from page), '[]'::jsonb)
)::text;
rollback;
