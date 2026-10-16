-- Read-only keyset page of exact-day player birthdays.
-- Fast path: core.person.birth_date keyed with Wikidata QID, harvest P569 precision 11 that agrees.
-- No raw_archive JSON decoding. Page on (birth_date, person_id).
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_id=0 -v page_limit=2000 -f pipeline/queries/player-birthday-candidates.sql
begin read only;
set local statement_timeout = '8s';
with src as materialized (
  select source_id, code, licence, attribution
  from meta.source
  where code = 'wikidata' and licence like 'CC0%'
),
page as materialized (
  select distinct on (p.birth_date, p.person_id)
         p.person_id, p.full_name, p.birth_date, x.external_key as qid,
         src.code, src.licence, src.attribution
  from core.person p
  join core.external_id x on x.entity_kind = 'person' and x.entity_id = p.person_id
  join src on src.source_id = x.source_id
  join legacy_wikidata_harvest.claim c
    on c.qid = x.external_key and c.prop = 'P569'
   and c.value_on = p.birth_date and c.value_prec = 11
   and coalesce(c.rank, 'normal') <> 'deprecated'
  where p.birth_date is not null
    and x.external_key ~ '^Q[0-9]+$'
    and (p.birth_date, p.person_id) > (:'after_date'::date, :'after_id'::bigint)
    and not exists (
      select 1 from legacy_wikidata_harvest.claim o
      where o.qid = x.external_key and o.prop = 'P569'
        and coalesce(o.rank, 'normal') <> 'deprecated'
        and (o.value_on is distinct from p.birth_date or o.value_prec is distinct from 11)
    )
  order by p.birth_date, p.person_id, x.external_key
  limit :page_limit
),
sided as (
  select p.*,
         coalesce(t.league_codes, '{}'::text[]) as league_codes,
         coalesce(t.franchise_ids, '{}'::int[]) as franchise_ids,
         coalesce(t.team_season_ids, '{}'::int[]) as team_season_ids
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
)
select jsonb_build_object(
  'category', 'player-birthday',
  'scannedCount', (select count(*) from sided),
  'nextCursor', (select jsonb_build_object('date', birth_date, 'id', person_id) from sided order by birth_date desc, person_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:player-birthday:wikidata:' || qid || ':' || birth_date::text,
      'category', 'player-birthday',
      'reviewStatus', 'candidate',
      'datePrecision', 'day',
      'eventDate', birth_date,
      'sport', null,
      'competition', null,
      'league', case when array_length(league_codes, 1) = 1 then league_codes[1] else null end,
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
    ) order by birth_date, person_id) from sided), '[]'::jsonb)
)::text;
rollback;
