-- Read-only keyset page of soccer matches with an exact match_date and team objects.
-- National teams carry FIFA and ISO/Hata flag codes. Clubs leave fifaCode null.
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_id=0 -v page_limit=2000 -f pipeline/queries/extract_soccer_on_day.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select m.match_id, m.match_date, m.tournament_id, m.stage_key, m.venue_id,
         m.home_team_id, m.away_team_id, m.home_goals, m.away_goals,
         t.league_code, t.year as season_start_year,
         src.code as source_code, src.licence, src.attribution
  from core.soccer_match m
  join core.soccer_tournament t on t.tournament_id = m.tournament_id
  join meta.source src on src.source_id = m.source_id
  where (m.match_date, m.match_id) > (:'after_date'::date, :'after_id'::bigint)
  order by m.match_date, m.match_id
  limit :page_limit
),
sided as (
  select p.*,
         coalesce(htt.team_name, ht.name) as home_name,
         ht.country_code as home_country, ht.fifa_code as home_fifa, ht.flag_code as home_flag,
         coalesce(att.team_name, at.name) as away_name,
         at.country_code as away_country, at.fifa_code as away_fifa, at.flag_code as away_flag
  from page p
  join core.soccer_team ht on ht.team_id = p.home_team_id
  join core.soccer_team at on at.team_id = p.away_team_id
  left join core.soccer_tournament_team htt on htt.tournament_id = p.tournament_id and htt.team_id = p.home_team_id
  left join core.soccer_tournament_team att on att.tournament_id = p.tournament_id and att.team_id = p.away_team_id
)
select jsonb_build_object(
  'category', 'soccer-on-day',
  'scannedCount', (select count(*) from sided),
  'nextCursor', (select jsonb_build_object('date', match_date, 'id', match_id) from sided order by match_date desc, match_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:soccer-match:' || match_id::text,
      'category', 'soccer-on-day',
      'reviewStatus', 'candidate',
      'datePrecision', 'day',
      'eventDate', match_date,
      'sport', 'soccer',
      'competition', tournament_id,
      'league', league_code,
      'seasonStartYear', season_start_year,
      'stage', stage_key,
      'soccerMatchId', match_id,
      'venueId', venue_id,
      'homeScore', home_goals,
      'awayScore', away_goals,
      'home', jsonb_build_object(
        'name', home_name,
        'franchiseId', null,
        'teamSeasonId', null,
        'soccerTeamId', home_team_id,
        'countryCode', home_country,
        'fifaCode', home_fifa,
        'flagCode', home_flag),
      'away', jsonb_build_object(
        'name', away_name,
        'franchiseId', null,
        'teamSeasonId', null,
        'soccerTeamId', away_team_id,
        'countryCode', away_country,
        'fifaCode', away_fifa,
        'flagCode', away_flag),
      'sourceId', source_code,
      'licence', licence,
      'attribution', attribution
    ) order by match_date, match_id) from sided), '[]'::jsonb)
)::text;
rollback;
