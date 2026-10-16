-- Exact-day franchise identity and league-membership bounds (lower(valid_during)).
-- Context: league, city (identity.location), what the identity is (full_name).
-- psql -v ON_ERROR_STOP=1 -v after_date='0001-01-01' -v after_id=0 -v page_limit=500 -f pipeline/queries/extract_franchise_events.sql
begin read only;
set local statement_timeout = '8s';
with events as (
  select i.franchise_identity_id::bigint as event_id, 'rename-or-move'::text as kind,
         lower(i.valid_during) as event_date, i.franchise_id, i.full_name as label,
         i.location as city,
         (select fl.league_code
          from core.franchise_league fl
          where fl.franchise_id = i.franchise_id
            and fl.valid_during @> lower(i.valid_during)
          order by lower(fl.valid_during)
          limit 1) as league_code,
         src.code, src.licence, src.attribution
  from core.franchise_identity i
  left join meta.source src on src.source_id = i.source_id
  where lower(i.valid_during) is not null
  union all
  select hashtextextended(fl.franchise_id::text || fl.league_code || lower(fl.valid_during)::text, 0),
         'league-membership',
         lower(fl.valid_during), fl.franchise_id, fl.league_code,
         (select i.location
          from core.franchise_identity i
          where i.franchise_id = fl.franchise_id
            and i.valid_during @> lower(fl.valid_during)
          order by lower(i.valid_during)
          limit 1),
         fl.league_code,
         src.code, src.licence, src.attribution
  from core.franchise_league fl
  left join meta.source src on src.source_id = fl.source_id
  where lower(fl.valid_during) is not null
),
page as materialized (
  select * from events
  where (event_date, event_id) > (:'after_date'::date, :'after_id'::bigint)
  order by event_date, event_id
  limit :page_limit
)
select jsonb_build_object(
  'category', 'franchise-event',
  'scannedCount', (select count(*) from page),
  'nextCursor', (select jsonb_build_object('date', event_date, 'id', event_id) from page order by event_date desc, event_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:franchise-event:' || event_id::text,
      'category', kind,
      'reviewStatus', 'candidate',
      'datePrecision', 'day',
      'eventDate', event_date,
      'franchiseId', franchise_id,
      'label', label,
      'clubName', label,
      'league', league_code,
      'venueCity', city,
      'sourceId', code,
      'licence', licence,
      'attribution', attribution
    ) order by event_date, event_id) from page), '[]'::jsonb)
)::text;
rollback;
