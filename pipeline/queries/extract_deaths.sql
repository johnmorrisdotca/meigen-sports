-- Read-only keyset page of exact-day player deaths (harvest P570 precision 11 agreeing with core.person.death_date).
-- Context for templates: sport, position, main clubs+years, league, award count, championships, nationality.
-- Convert drops pre-1850 and non-athletes (including Q704476). This query still scans them so counts stay comparable.
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_id=0 -v page_limit=2000 -f pipeline/queries/extract_deaths.sql
begin read only;
set local statement_timeout = '8s';
with src as materialized (
  select source_id, code, licence, attribution
  from meta.source
  where code = 'wikidata' and licence like 'CC0%'
),
page as materialized (
  select distinct on (p.death_date, p.person_id)
         p.person_id, p.full_name, p.death_date, p.primary_position, p.nationality_code,
         x.external_key as qid,
         src.code, src.licence, src.attribution
  from core.person p
  join core.external_id x on x.entity_kind = 'person' and x.entity_id = p.person_id
  join src on src.source_id = x.source_id
  join legacy_wikidata_harvest.claim c
    on c.qid = x.external_key and c.prop = 'P570'
   and c.value_on = p.death_date and c.value_prec = 11
   and coalesce(c.rank, 'normal') <> 'deprecated'
  where p.death_date is not null
    and x.external_key ~ '^Q[0-9]+$'
    and (p.death_date, p.person_id) > (:'after_date'::date, :'after_id'::bigint)
    and not exists (
      select 1 from legacy_wikidata_harvest.claim o
      where o.qid = x.external_key and o.prop = 'P570'
        and coalesce(o.rank, 'normal') <> 'deprecated'
        and (o.value_on is distinct from p.death_date or o.value_prec is distinct from 11)
    )
  order by p.death_date, p.person_id, x.external_key
  limit :page_limit
),
sided as (
  select p.*,
         sp.sport,
         coalesce(t.league_codes, '{}'::text[]) as league_codes,
         coalesce(t.franchise_ids, '{}'::int[]) as franchise_ids,
         coalesce(t.team_season_ids, '{}'::int[]) as team_season_ids,
         coalesce(clubs.club_names, '{}'::text[]) as club_names,
         w.award_count, w.championships, w.person_award, w.championship_name
  from page p
  left join lateral (
    select array_agg(distinct se.league_code order by se.league_code) as league_codes,
           array_agg(distinct ts.franchise_id order by ts.franchise_id) as franchise_ids,
           array_agg(distinct ts.team_season_id order by ts.team_season_id) as team_season_ids
    from core.roster_stint rs
    join core.team_season ts on ts.team_season_id = rs.team_season_id
    join core.season se on se.season_id = ts.season_id
    where rs.person_id = p.person_id
  ) t on true
  left join lateral (
    -- Known sports only: core.person_sport, else ref.league.sport_code for roster leagues.
    select coalesce(
      (select (array_agg(ps.sport_code order by ps.sport_code))[1]
       from core.person_sport ps
       where ps.person_id = p.person_id),
      (select (array_agg(l.sport_code order by l.sport_code))[1]
       from unnest(coalesce(t.league_codes, '{}'::text[])) as lc(code)
       join ref.league l on l.league_code = lc.code)
    ) as sport
  ) sp on true
  left join lateral (
    select array_agg(c.club order by c.club) as club_names
    from (
      select i.full_name ||
             case when min(se.start_year) = max(se.start_year)
               then ' (' || min(se.start_year)::text || ')'
               else ' (' || min(se.start_year)::text || '–' || max(se.start_year)::text || ')' end as club
      from core.roster_stint rs
      join core.team_season ts on ts.team_season_id = rs.team_season_id
      join core.season se on se.season_id = ts.season_id
      join core.franchise_identity i
        on i.franchise_id = ts.franchise_id
       and i.valid_during @> make_date(se.start_year, 7, 1)
      where rs.person_id = p.person_id and i.full_name is not null
      group by i.full_name
    ) c
  ) clubs on true
  left join lateral (
    select count(*) filter (where a.kind = 'person_award')::int as award_count,
           count(*) filter (where a.kind = 'championship')::int as championships,
           (array_agg(a.name order by aw.award_winner_id) filter (where a.kind = 'person_award'))[1] as person_award,
           (array_agg(a.name order by aw.award_winner_id) filter (where a.kind = 'championship'))[1] as championship_name
    from core.award_winner aw
    join core.award a on a.award_id = aw.award_id
    where aw.person_id = p.person_id
       or aw.team_season_id in (
         select rs.team_season_id from core.roster_stint rs where rs.person_id = p.person_id
       )
  ) w on true
)
select jsonb_build_object(
  'category', 'player-death',
  'scannedCount', (select count(*) from sided),
  'nextCursor', (select jsonb_build_object('date', death_date, 'id', person_id) from sided order by death_date desc, person_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:player-death:wikidata:' || qid || ':' || death_date::text,
      'category', 'player-death',
      'reviewStatus', 'candidate',
      'datePrecision', 'day',
      'eventDate', death_date,
      'sport', sport,
      'competition', null,
      'league', case when array_length(league_codes, 1) = 1 then league_codes[1] else null end,
      'position', primary_position,
      'nationality', nationality_code,
      'clubNames', to_jsonb(club_names),
      'championships', championships,
      'championshipName', championship_name,
      'personAward', person_award,
      'awardCount', award_count,
      'person', jsonb_build_object(
        'personId', person_id,
        'qid', qid,
        'name', full_name,
        'leagueCodes', to_jsonb(league_codes),
        'franchiseIds', to_jsonb(franchise_ids),
        'teamSeasonIds', to_jsonb(team_season_ids)),
      'sourceId', code,
      'licence', licence,
      'attribution', attribution,
      'sourceUrl', 'https://www.wikidata.org/wiki/' || qid
    ) order by death_date, person_id) from sided), '[]'::jsonb)
)::text;
rollback;
