-- Read-only keyset page of season-final games (day precision), with home/away team objects.
-- Page finals first, then attach team rows for that page only.
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_id=0 -v page_limit=2000 -f pipeline/queries/extract_finals.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select g.game_id, g.game_date, g.phase, g.status, g.home_score, g.away_score,
         g.home_team_season_id, g.away_team_season_id, g.venue_id as game_venue_col,
         g.went_to_overtime, g.decided_by_shootout, g.overtime_periods, g.decided_by,
         g.series_id, g.series_game_number, g.round_label as game_round,
         s.league_code, s.start_year, l.sport_code,
         src.code as source_code, src.licence, src.attribution
  from core.venue_final_game f
  join core.game g on g.game_id = f.game_id
  join core.season s on s.season_id = f.season_id
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
         case when gv.game_id is not null then gv.venue_id else coalesce(p.game_venue_col, hv.venue_id) end as venue_id,
         ser.round_label as series_round, ser.best_of as series_best_of,
         ser.higher_seed_wins, ser.lower_seed_wins, ser.winner_team_season_id
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
  left join core.series ser on ser.series_id = p.series_id
),
named as (
  select s.*, v.city as venue_city, v.country_code as venue_country, vn.name as venue_name
  from sided s
  left join core.venue v on v.venue_id = s.venue_id
  left join lateral (
    select n.name from core.venue_name n
    where n.venue_id = s.venue_id and n.valid_during @> s.game_date
    order by lower(n.valid_during) desc
    limit 1
  ) vn on true
)
select jsonb_build_object(
  'category', 'championship-final',
  'scannedCount', (select count(*) from named),
  'nextCursor', (select jsonb_build_object('date', game_date, 'id', game_id) from named order by game_date desc, game_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:final:' || game_id::text,
      'category', 'championship-final',
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
      'venueName', venue_name,
      'venueCity', venue_city,
      'venueCountry', venue_country,
      'wentToOvertime', went_to_overtime,
      'decidedByShootout', decided_by_shootout,
      'overtimePeriods', overtime_periods,
      'decidedBy', decided_by,
      'seriesId', series_id,
      'seriesGameNumber', series_game_number,
      'roundLabel', coalesce(series_round, game_round),
      'seriesBestOf', series_best_of,
      'seriesHigherWins', higher_seed_wins,
      'seriesLowerWins', lower_seed_wins,
      'seriesWinnerTeamSeasonId', winner_team_season_id,
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
    ) order by game_date, game_id) from named), '[]'::jsonb)
)::text;
rollback;
