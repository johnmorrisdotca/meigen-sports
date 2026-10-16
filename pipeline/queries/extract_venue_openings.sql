-- Exact-day venue openings from Wikidata (opened_prec = 11).
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_qid='' -v page_limit=500 -f pipeline/queries/extract_venue_openings.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select v.qid, v.label, v.opened_on, src.code, src.licence, src.attribution
  from legacy_wikidata_venues.venue v
  join meta.source src on src.code = 'wikidata' and src.licence like 'CC0%'
  where v.opened_prec = 11 and v.opened_on is not null
    and (v.opened_on, v.qid) > (:'after_date'::date, :'after_qid')
  order by v.opened_on, v.qid
  limit :page_limit
)
select jsonb_build_object(
  'category', 'venue-opening',
  'licence', 'CC0-1.0',
  'scannedCount', (select count(*) from page),
  'nextCursor', (select jsonb_build_object('date', opened_on, 'qid', qid) from page order by opened_on desc, qid desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:venue-opened:wikidata:' || qid,
      'category', 'venue-opening',
      'reviewStatus', 'candidate',
      'datePrecision', 'day',
      'eventDate', opened_on,
      'stableEntityId', 'wikidata:' || qid,
      'displayName', label,
      'sourceId', code,
      'licence', licence,
      'attribution', attribution,
      'sourceUrl', 'https://www.wikidata.org/wiki/' || qid
    ) order by opened_on, qid) from page), '[]'::jsonb)
)::text;
rollback;
