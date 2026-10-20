-- Read-only keyset page of what the archive knows about each person who has a Wikidata id, for the career context of a birthday or a death:
-- Hall of Fame year, clubs, leagues, individual awards and titles. One record per person, keyed on person_id.
--   * Clubs and leagues come from the team-seasons a person played in, rosters and season statistics both (api.player_teams counts
--     them the same way). Players with statistics but no roster row (most baseball and hockey players) used to show no club.
--   * An individual award is read from core.award_winner.person_id only. It is never inherited through a team-season: the award row
--     carries the winner's team-season, so a team-season match gave every teammate of a Cy Young winner a Cy Young Award.
--   * A championship is the club's: it counts for the person who played in that team-season.
--   * hallOfFameYear is core.person.hall_of_fame_year as DS1 holds it (a year, or null).
-- psql -X -qAt -v ON_ERROR_STOP=1 -v after_id=0 -v page_limit=2000 -f pipeline/queries/extract_person_context.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select distinct on (p.person_id)
         p.person_id, p.full_name, p.hall_of_fame_year, x.external_key as qid
  from core.person p
  join core.external_id x on x.entity_kind = 'person' and x.entity_id = p.person_id
   and x.external_key ~ '^Q[0-9]+$'
  join meta.source ms on ms.source_id = x.source_id and ms.code = 'wikidata'
  where p.person_id > :'after_id'::bigint
  order by p.person_id, x.external_key
  limit :page_limit
),
sided as (
  select p.*, st.ids,
         coalesce(t.league_codes, '{}'::text[]) as league_codes,
         coalesce(t.franchise_ids, '{}'::int[]) as franchise_ids,
         coalesce(clubs.club_names, '{}'::text[]) as club_names,
         coalesce(aw.awards, '[]'::jsonb) as awards,
         coalesce(aw.award_count, 0) as award_count,
         coalesce(ti.championships, 0) as championships,
         ti.championship_name
  from page p
  left join lateral (
    select coalesce(array_agg(distinct s.team_season_id), '{}'::int[]) as ids
    from (
      select rs.team_season_id from core.roster_stint rs where rs.person_id = p.person_id and rs.role = 'player'
      union
      select x.team_season_id from core.player_season_stat x where x.person_id = p.person_id
    ) s
  ) st on true
  left join lateral (
    select array_agg(distinct se.league_code order by se.league_code) as league_codes,
           array_agg(distinct ts.franchise_id order by ts.franchise_id) as franchise_ids
    from unnest(st.ids) as u(team_season_id)
    join core.team_season ts on ts.team_season_id = u.team_season_id
    join core.season se on se.season_id = ts.season_id
  ) t on true
  left join lateral (
    select array_agg(c.club order by c.club) as club_names
    from (
      select i.full_name ||
             case when min(se.start_year) = max(se.start_year)
               then ' (' || min(se.start_year)::text || ')'
               else ' (' || min(se.start_year)::text || '–' || max(se.start_year)::text || ')' end as club
      from unnest(st.ids) as u(team_season_id)
      join core.team_season ts on ts.team_season_id = u.team_season_id
      join core.season se on se.season_id = ts.season_id
      join core.franchise_identity i
        on i.franchise_id = ts.franchise_id
       and i.valid_during @> make_date(se.start_year, 7, 1)
      where i.full_name is not null
      group by i.full_name
    ) c
  ) clubs on true
  left join lateral (
    select count(*)::int as award_count,
           jsonb_agg(jsonb_build_object('code', a.code, 'name', a.name, 'league', a.league_code, 'year', se.start_year)
                     order by se.start_year, a.code, w.award_winner_id) as awards
    from core.award_winner w
    join core.award a on a.award_id = w.award_id and a.kind = 'person_award'
    join core.season se on se.season_id = w.season_id
    where w.person_id = p.person_id
  ) aw on true
  left join lateral (
    select count(distinct (w.season_id, w.team_season_id))::int as championships,
           (array_agg(a.name order by w.award_winner_id))[1] as championship_name
    from core.award_winner w
    join core.award a on a.award_id = w.award_id and a.kind = 'championship'
    where w.team_season_id = any (st.ids)
  ) ti on true
)
select jsonb_build_object(
  'category', 'person-context',
  'scannedCount', (select count(*) from sided),
  'nextCursor', (select jsonb_build_object('id', person_id) from sided order by person_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:person-context:' || person_id::text,
      'category', 'person-context',
      'person', jsonb_build_object(
        'personId', person_id,
        'qid', qid,
        'name', full_name,
        'leagueCodes', to_jsonb(league_codes),
        'franchiseIds', to_jsonb(franchise_ids),
        'teamSeasonIds', to_jsonb(ids)),
      'hallOfFameYear', hall_of_fame_year,
      'clubNames', to_jsonb(club_names),
      'awardCount', award_count,
      'awards', awards,
      'championships', championships,
      'championshipName', championship_name
    ) order by person_id) from sided), '[]'::jsonb)
)::text;
rollback;
