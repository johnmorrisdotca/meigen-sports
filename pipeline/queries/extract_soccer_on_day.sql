-- Read-only keyset page of soccer matches with an exact match_date.
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_id=0 -v page_limit=500 -f pipeline/queries/extract_soccer_on_day.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select m.match_id, m.match_date, m.tournament_id, m.stage_key,
         m.home_team_id, m.away_team_id, m.home_goals, m.away_goals,
         src.code as source_code, src.licence, src.attribution
  from core.soccer_match m
  join meta.source src on src.source_id = m.source_id
  where (m.match_date, m.match_id) > (:'after_date'::date, :'after_id'::bigint)
  order by m.match_date, m.match_id
  limit :page_limit
)
select jsonb_build_object(
  'category', 'soccer-on-day',
  'scannedCount', (select count(*) from page),
  'nextCursor', (select jsonb_build_object('date', match_date, 'id', match_id) from page order by match_date desc, match_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:soccer-match:' || match_id::text,
      'category', 'soccer-on-day',
      'reviewStatus', 'candidate',
      'datePrecision', 'day',
      'eventDate', match_date,
      'tournamentId', tournament_id,
      'stage', stage_key,
      'homeTeamId', home_team_id,
      'awayTeamId', away_team_id,
      'homeGoals', home_goals,
      'awayGoals', away_goals,
      'sourceId', source_code,
      'licence', licence,
      'attribution', attribution
    ) order by match_date, match_id) from page), '[]'::jsonb)
)::text;
rollback;
