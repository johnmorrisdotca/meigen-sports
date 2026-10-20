-- Read-only keyset page of what the archive holds about each game of a season's final round, for the sentence that says the title:
--   * the venue of the game (name as of that day, and city), from core.venue_final_game (else core.game_venue);
--   * the winner's regular-season record as its league writes it (wins, losses, and ties or overtime losses where the league has them),
--     from core.standing, only when every source's last regular-season row agrees and that row is the whole season;
--   * which title this was for the winner's franchise (winnerTitleNumber), counted from the championship rows of core.award_winner,
--     only when the list is complete: every season of every league the franchise belonged to, up to that year, has a champion on
--     record or a row in core.title_not_awarded, and the winner is itself the champion of that season on record.
-- Nothing is inferred: a field the archive cannot state is left out of the record, and the converter leaves the clause out of the sentence.
-- The winner is the winner of that game. The converter reads only the last game of a final round, whose winner is the series winner.
-- `titleCountCheck` (not published) says why a count was or was not given, so a missing count can be read off the output:
--   gapSeasons    seasons of the franchise's leagues, up to that year, with no champion and no "not awarded" row
--   leagues       the leagues the franchise belonged to by that day
-- psql -X -qAt -v ON_ERROR_STOP=1 -v after_id=0 -v page_limit=2000 -f pipeline/queries/extract_final_context.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select f.game_id, f.venue_id as final_venue_id, g.game_date, g.season_id,
         g.home_team_season_id, g.away_team_season_id, g.home_score, g.away_score, g.venue_id as game_venue_col,
         case when g.home_score > g.away_score then g.home_team_season_id
              when g.home_score < g.away_score then g.away_team_season_id end as winner_team_season_id,
         se.league_code, se.start_year, se.games_per_team, se.regular_ends_on
  from core.venue_final_game f
  join core.game g on g.game_id = f.game_id and g.status = 'final'
  join core.season se on se.season_id = g.season_id
  where f.game_id > :'after_id'::bigint
  order by f.game_id
  limit :page_limit
),
-- every championship on record, once per franchise and league-season
champ as materialized (
  select distinct se.league_code, se.start_year, se.season_id, ts.franchise_id
  from core.award_winner w
  join core.award a on a.award_id = w.award_id and a.kind = 'championship'
  join core.season se on se.season_id = w.season_id
  join core.team_season ts on ts.team_season_id = w.team_season_id
),
-- seasons whose champion the archive does not hold and whose title was not "not awarded": a gap in the list
gap as materialized (
  select se.league_code, se.start_year
  from core.season se
  where not exists (select 1 from champ c where c.season_id = se.season_id)
    and not exists (select 1 from core.title_not_awarded t where t.league_code = se.league_code and t.start_year = se.start_year)
),
sided as (
  select p.*,
         wts.franchise_id as winner_franchise_id,
         coalesce(p.final_venue_id, gv.venue_id, p.game_venue_col) as venue_id
  from page p
  left join core.team_season wts on wts.team_season_id = p.winner_team_season_id
  left join core.game_venue gv on gv.game_id = p.game_id
),
detail as (
  select s.*,
         vn.name as venue_name, v.city as venue_city,
         rec.n as record_sources, rec.wins, rec.losses, rec.ties, rec.ot_losses,
         lg.leagues, lg.gap_seasons,
         ti.titles, ti.won_this_season
  from sided s
  left join core.venue v on v.venue_id = s.venue_id
  left join lateral (
    select n.name from core.venue_name n where n.venue_id = s.venue_id and n.valid_during @> s.game_date order by lower(n.valid_during) desc limit 1
  ) vn on true
  left join lateral (
    -- the last regular-season row of each source that is the whole season; all sources must give the same record
    select count(distinct (l.wins, l.losses, coalesce(l.ties, 0), coalesce(l.ot_losses, 0))) as n,
           (array_agg(l.wins))[1] as wins, (array_agg(l.losses))[1] as losses,
           (array_agg(l.ties))[1] as ties, (array_agg(l.ot_losses))[1] as ot_losses
    from (
      select distinct on (st.source_id) st.*
      from core.standing st
      where st.team_season_id = s.winner_team_season_id and st.phase = 'regular' and st.wins is not null and st.losses is not null
      order by st.source_id, st.as_of desc
    ) l
    where (s.games_per_team is not null and l.games_played = s.games_per_team)
       or (s.regular_ends_on is not null and l.as_of >= s.regular_ends_on)
  ) rec on true
  left join lateral (
    select array_agg(distinct fl.league_code order by fl.league_code) as leagues,
           (select count(*) from gap q
            where q.start_year <= s.start_year
              and q.league_code in (select fl2.league_code from core.franchise_league fl2
                                    where fl2.franchise_id = s.winner_franchise_id and lower(fl2.valid_during) <= s.game_date))::int as gap_seasons
    from core.franchise_league fl
    where fl.franchise_id = s.winner_franchise_id and lower(fl.valid_during) <= s.game_date
  ) lg on true
  left join lateral (
    select count(*) filter (where c.start_year <= s.start_year)::int as titles,
           bool_or(c.league_code = s.league_code and c.start_year = s.start_year) as won_this_season
    from champ c
    where c.franchise_id = s.winner_franchise_id
  ) ti on true
)
select jsonb_build_object(
  'category', 'final-context',
  'scannedCount', (select count(*) from detail),
  'nextCursor', (select jsonb_build_object('id', game_id) from detail order by game_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'recordId', 'spx:final-context:' || game_id::text,
      'category', 'final-context',
      'gameId', game_id,
      'venueName', venue_name,
      'venueCity', venue_city,
      'winnerRecord', case when record_sources = 1 then jsonb_strip_nulls(jsonb_build_object(
          'wins', wins,
          'losses', losses,
          -- ties where the league keeps them (always), or where baseball and basketball had one
          'ties', case when league_code in ('nfl', 'cfl', 'afl', 'aafc', 'nhl', 'nha', 'pcha', 'wchl', 'wha') then ties
                       when ties > 0 then ties end,
          'otLosses', case when league_code = 'nhl' then ot_losses end)) end,
      'winnerTitleNumber', case when coalesce(won_this_season, false) and leagues is not null and gap_seasons = 0 and titles > 0 then titles end,
      'titleCountCheck', jsonb_build_object('gapSeasons', gap_seasons, 'leagues', to_jsonb(leagues), 'titles', titles, 'wonThisSeason', won_this_season)
    )) order by game_id) from detail), '[]'::jsonb)
)::text;
rollback;
