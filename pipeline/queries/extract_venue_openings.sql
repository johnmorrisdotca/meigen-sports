-- Exact-day venue openings from Wikidata (opened_prec = 11).
-- Context: city from core.venue, clubs from core.franchise_home_venue, famous events from
-- core.venue_final_game (championship award name and season year) when those tables exist.
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
),
sided as (
  select p.*,
         cv.city as venue_city,
         h.club_names,
         f.famous_event
  from page p
  left join core.venue cv on cv.source_key = p.qid
  left join lateral (
    select array_agg(distinct i.full_name order by i.full_name) filter (where i.full_name is not null) as club_names
    from core.franchise_home_venue hv
    join core.franchise_identity i
      on i.franchise_id = hv.franchise_id
     and i.valid_during && hv.valid_during
    where cv.venue_id is not null and hv.venue_id = cv.venue_id
  ) h on true
  left join lateral (
    select (array_agg(se.start_year::text || ' ' || a.name order by se.start_year))[1] as famous_event
    from core.venue_final_game fg
    join core.season se on se.season_id = fg.season_id
    join core.award_winner aw on aw.season_id = se.season_id
    join core.award a on a.award_id = aw.award_id and a.kind = 'championship'
    where cv.venue_id is not null and fg.venue_id = cv.venue_id
  ) f on true
)
select jsonb_build_object(
  'category', 'venue-opening',
  'licence', 'CC0-1.0',
  'scannedCount', (select count(*) from sided),
  'nextCursor', (select jsonb_build_object('date', opened_on, 'qid', qid) from sided order by opened_on desc, qid desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
    'recordId', 'spx:venue-opened:wikidata:' || qid,
    'category', 'venue-opening',
    'reviewStatus', 'candidate',
    'datePrecision', 'day',
    'eventDate', opened_on,
    'stableEntityId', 'wikidata:' || qid,
    'displayName', label,
    'venueName', label,
    'venueCity', venue_city,
    'clubNames', to_jsonb(coalesce(club_names, '{}'::text[])),
    'highlight', famous_event,
    'sourceId', code,
    'licence', licence,
    'attribution', attribution,
    'sourceUrl', 'https://www.wikidata.org/wiki/' || qid
  ) order by opened_on, qid) from sided), '[]'::jsonb)
)::text;
rollback;
