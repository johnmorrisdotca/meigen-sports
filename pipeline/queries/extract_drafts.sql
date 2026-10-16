-- Read-only keyset page of Wikidata P647 draft dates at day precision.
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_qid='' -v page_limit=500 -f pipeline/queries/extract_drafts.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select c.qid, c.n, c.point_on, c.value_qid, c.ranking, c.ordinal,
         src.code, src.licence, src.attribution
  from legacy_people.resume_claim c
  join meta.source src on src.code = 'wikidata' and src.licence like 'CC0%'
  where c.prop = 'P647' and c.point_prec = 11 and c.point_on is not null
    and (c.point_on, c.qid) > (:'after_date'::date, :'after_qid')
  order by c.point_on, c.qid, c.n
  limit :page_limit
)
select jsonb_build_object(
  'category', 'draft',
  'licence', 'CC0-1.0',
  'scannedCount', (select count(*) from page),
  'nextCursor', (select jsonb_build_object('date', point_on, 'qid', qid) from page order by point_on desc, qid desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:draft:wikidata:' || qid || ':' || n::text,
      'category', 'draft',
      'reviewStatus', 'candidate',
      'datePrecision', 'day',
      'eventDate', point_on,
      'stableEntityId', 'wikidata:' || qid,
      'draftedByQid', value_qid,
      'overallPick', ranking,
      'round', ordinal,
      'sourceId', code,
      'licence', licence,
      'attribution', attribution,
      'sourceUrl', 'https://www.wikidata.org/wiki/' || qid
    ) order by point_on, qid, n) from page), '[]'::jsonb)
)::text;
rollback;
