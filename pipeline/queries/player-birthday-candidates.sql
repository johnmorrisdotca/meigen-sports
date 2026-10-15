-- Read-only SPX candidate extraction. LIMIT 5 is intentionally retained until reviewed.
begin read only;
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
all_birth_values as materialized (
  select coalesce(w.to_qid, c.qid) as qid, c.value_on, c.value_prec
  from legacy_people.claim c
  left join legacy_people.redirect w on w.from_qid = c.qid
  where c.prop = 'P569' and coalesce(c.rank, 'normal') <> 'deprecated'
),
unambiguous_births as materialized (
  select qid, min(value_on) as birth_date
  from all_birth_values
  group by qid
  having count(*) = count(value_on)
     and count(distinct value_on) = 1
     and bool_and(value_prec = 11)
),
eligible_candidates as materialized (
  select b.qid, b.birth_date, i.person_id, p.full_name,
         src.code, src.licence, src.attribution
  from unambiguous_births b
  join wikidata_ids i on i.qid = b.qid
  join core.person p on p.person_id = i.person_id and p.birth_date = b.birth_date
  join meta.source src on src.code = 'wikidata' and src.licence like 'CC0%'
  where exists (
    select 1 from core.roster_stint s
    where s.person_id = i.person_id and s.role = 'player'
  )
),
limited_candidates as materialized (
  select * from eligible_candidates order by birth_date, qid limit 5
),
archive_batches as materialized (
  select a.name, a.saved_on, a.sha256, convert_from(a.data, 'UTF8')::jsonb as payload
  from legacy_files.raw_archive a
  where a.name ~ '^people/[0-9]{4}-[0-9]{2}-[0-9]{2}/(persons|persontitles)-[0-9]+\.json$'
    and a.sha256 ~ '^[a-f0-9]{64}$'
    and a.saved_on in (select distinct i.fetched_on from limited_candidates c
                       join legacy_people.item i on i.qid = c.qid)
),
verified_evidence as (
  select c.qid, c.birth_date, c.person_id, c.full_name, c.code, c.licence, c.attribution,
         i.fetched_on, a.name, a.sha256, cl.n,
         format('/entities/%s/claims/P569/%s', cl.qid, cl.n) as json_pointer
  from limited_candidates c
  join legacy_people.item i on i.qid = c.qid
  join legacy_people.claim cl on cl.qid = i.qid and cl.prop = 'P569'
    and cl.value_on = c.birth_date and cl.value_prec = 11
    and coalesce(cl.rank, 'normal') <> 'deprecated'
  join archive_batches a on a.saved_on = i.fetched_on
    and (a.payload -> 'entities') ? cl.qid
  cross join lateral jsonb_array_elements(a.payload #> array['entities', cl.qid, 'claims', 'P569'])
    with ordinality as raw_claim(value, ordinal)
  where raw_claim.ordinal = cl.n + 1
    and raw_claim.value #>> '{mainsnak,datavalue,value,time}' is not null
    and raw_claim.value #>> '{mainsnak,datavalue,value,time}' like '%' || to_char(c.birth_date, 'YYYY-MM-DD') || 'T%'
    and raw_claim.value #>> '{mainsnak,datavalue,value,precision}' = '11'
    and coalesce(raw_claim.value #>> '{rank}', 'normal') <> 'deprecated'
)

select 'spx:player-birthday:wikidata:' || qid || ':' || birth_date::text as record_id,
       'player-birthday' as category,
       'candidate' as review_status,
       'day' as date_precision,
       birth_date as event_date,
       'wikidata:' || qid as stable_entity_id,
       full_name as display_name,
       code as source_id,
       licence,
       attribution,
       'https://www.wikidata.org/wiki/' || qid as source_url,
       jsonb_agg(jsonb_build_object(
         'archiveName', name,
         'archiveSha256', sha256,
         'jsonPointer', json_pointer,
         'fetchedOn', fetched_on
       ) order by name, json_pointer) as source_evidence
from verified_evidence
group by qid, birth_date, full_name, code, licence, attribution
order by birth_date, qid;

rollback;
