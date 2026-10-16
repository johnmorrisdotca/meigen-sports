-- Read-only keyset page of five-league games with an exact game_date.
-- Page games first (8s), then attach home/away team objects for that page only.
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_id=0 -v page_limit=2000 -f pipeline/queries/extract_games_on_day.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select g.game_id, g.game_date, g.phase, g.status, g.home_score, g.away_score,
         g.home_team_season_id, g.away_team_season_id, g.venue_id as game_venue_col,
         s.league_code, s.start_year, l.sport_code,
         src.code as source_code, src.licence, src.attribution
  from core.game g
  join core.season s on s.season_id = g.season_id
  join ref.league l on l.league_code = s.league_code
  join meta.source src on src.source_id = g.source_id
  where (g.game_date, g.game_id) > (:'after_date'::date, :'after_id'::bigint)
  order by g.game_date, g.game_id
  limit :page_limit
),
sided as (
  select p.*,
         hts.franchise_id as home_franchise_id,
         ats.franchise_id as away_franchise_id,
         coalesce(hi.full_name, hid.full_name) as home_name,
         coalesce(hi.country_code, hid.country_code) as home_country,
         coalesce(ai.full_name, aid.full_name) as away_name,
         coalesce(ai.country_code, aid.country_code) as away_country,
         case when gv.game_id is not null then gv.venue_id else coalesce(p.game_venue_col, hv.venue_id) end as venue_id
  from page p
  join core.team_season hts on hts.team_season_id = p.home_team_season_id
  join core.team_season ats on ats.team_season_id = p.away_team_season_id
  left join core.franchise_identity hi on hi.franchise_identity_id = hts.franchise_identity_id
  left join core.franchise_identity hid on hts.franchise_identity_id is null
    and hid.franchise_id = hts.franchise_id and hid.valid_during @> p.game_date
  left join core.franchise_identity ai on ai.franchise_identity_id = ats.franchise_identity_id
  left join core.franchise_identity aid on ats.franchise_identity_id is null
    and aid.franchise_id = ats.franchise_id and aid.valid_during @> p.game_date
  left join core.game_venue gv on gv.game_id = p.game_id
  left join core.franchise_home_venue hv on hv.franchise_id = hts.franchise_id and hv.valid_during @> p.game_date
)
select jsonb_build_object(
  'category', 'game-on-day',
  'scannedCount', (select count(*) from sided),
  'nextCursor', (select jsonb_build_object('date', game_date, 'id', game_id) from sided order by game_date desc, game_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:game:' || game_id::text,
      'category', 'game-on-day',
      'reviewStatus', 'candidate',
      'datePrecision', 'day',
      'eventDate', game_date,
      'sport', sport_code,
      'competition', league_code,
      'league', league_code,
      'seasonStartYear', start_year,
      'phase', phase,
      'status', status,
      'homeScore', home_score,
      'awayScore', away_score,
      'gameId', game_id,
      'venueId', venue_id,
      'home', jsonb_build_object(
        'name', home_name,
        'franchiseId', home_franchise_id,
        'teamSeasonId', home_team_season_id,
        'soccerTeamId', null,
        'countryCode', home_country,
        'fifaCode', null,
        'flagCode', home_country),
      'away', jsonb_build_object(
        'name', away_name,
        'franchiseId', away_franchise_id,
        'teamSeasonId', away_team_season_id,
        'soccerTeamId', null,
        'countryCode', away_country,
        'fifaCode', null,
        'flagCode', away_country),
      'sourceId', source_code,
      'licence', licence,
      'attribution', attribution
    ) order by game_date, game_id) from sided), '[]'::jsonb)
)::text;
rollback;
