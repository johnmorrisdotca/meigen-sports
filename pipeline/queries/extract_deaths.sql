-- Read-only keyset page of exact-day player deaths (Wikidata P570 precision 11).
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_qid='' -v page_limit=500 -f pipeline/queries/extract_deaths.sql
begin read only;
set local statement_timeout = '8s';
with person_redirects as materialized (
  select old_person_id, person_id from core.person_redirect
),
wikidata_ids as materialized (
  select distinct coalesce(r.person_id, x.entity_id) as person_id,
         coalesce(w.to_qid, x.external_key) as qid
  from core.external_id x
  join meta.source src on src.source_id = x.source_id and src.code = 'wikidata'
  left join legacy_people.redirect w on w.from_qid = x.external_key
  left join person_redirects r on r.old_person_id = x.entity_id
  where x.entity_kind = 'person' and x.external_key ~ '^Q[0-9]+$'
),
single_identity_qids as materialized (
  select qid, (array_agg(distinct person_id))[1] as person_id
  from wikidata_ids
  group by qid
  having count(distinct person_id) = 1
),
all_death_values as materialized (
  select coalesce(w.to_qid, c.qid) as qid, c.value_on, c.value_prec
  from legacy_people.claim c
  left join legacy_people.redirect w on w.from_qid = c.qid
  where c.prop = 'P570' and coalesce(c.rank, 'normal') <> 'deprecated'
),
unambiguous_deaths as materialized (
  select qid, min(value_on) as death_date
  from all_death_values
  group by qid
  having count(*) = count(value_on)
     and count(distinct value_on) = 1
     and bool_and(value_prec = 11)
),
eligible as materialized (
  select d.qid, d.death_date, i.person_id, p.full_name, src.code, src.licence, src.attribution
  from unambiguous_deaths d
  join single_identity_qids i on i.qid = d.qid
  join core.person p on p.person_id = i.person_id and p.death_date = d.death_date
  join meta.source src on src.code = 'wikidata' and src.licence like 'CC0%'
  where exists (select 1 from core.roster_stint s where s.person_id = i.person_id and s.role = 'player')
),
page as materialized (
  select * from eligible
  where (death_date, qid) > (:'after_date'::date, :'after_qid')
  order by death_date, qid
  limit :page_limit
)
select jsonb_build_object(
  'category', 'player-death',
  'licence', 'CC0-1.0',
  'scannedCount', (select count(*) from page),
  'nextCursor', (select jsonb_build_object('date', death_date, 'qid', qid) from page order by death_date desc, qid desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:player-death:wikidata:' || qid || ':' || death_date::text,
      'category', 'player-death',
      'reviewStatus', 'candidate',
      'datePrecision', 'day',
      'eventDate', death_date,
      'stableEntityId', 'wikidata:' || qid,
      'displayName', full_name,
      'sourceId', code,
      'licence', licence,
      'attribution', attribution,
      'sourceUrl', 'https://www.wikidata.org/wiki/' || qid
    ) order by death_date, qid) from page), '[]'::jsonb)
)::text;
rollback;
