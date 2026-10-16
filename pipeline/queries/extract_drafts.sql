-- Read-only keyset page of core.draft_pick (year precision; never invent 1 January).
-- psql -v ON_ERROR_STOP=1 -v after_id=0 -v page_limit=2000 -f pipeline/queries/extract_drafts.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select distinct on (dp.draft_pick_id)
         dp.draft_pick_id, dp.draft_year, dp.round, dp.overall_pick, dp.league_code,
         dp.team_season_id, dp.person_id, dp.player_name, dp.position,
         ts.franchise_id, l.sport_code, p.full_name, x.external_key as qid,
         src.code, src.licence, src.attribution
  from core.draft_pick dp
  join meta.source src on src.source_id = dp.source_id
  join ref.league l on l.league_code = dp.league_code
  left join core.person p on p.person_id = dp.person_id
  left join core.team_season ts on ts.team_season_id = dp.team_season_id
  left join core.external_id x on x.entity_kind = 'person' and x.entity_id = dp.person_id
    and x.external_key ~ '^Q[0-9]+$'
    and exists (select 1 from meta.source s where s.source_id = x.source_id and s.code = 'wikidata')
  where dp.draft_pick_id > :'after_id'::bigint
  order by dp.draft_pick_id, x.external_key
  limit :page_limit
)
select jsonb_build_object(
  'category', 'draft',
  'scannedCount', (select count(*) from page),
  'nextCursor', (select jsonb_build_object('id', draft_pick_id) from page order by draft_pick_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:draft:' || draft_pick_id::text,
      'category', 'draft',
      'reviewStatus', 'candidate',
      'datePrecision', 'year',
      'eventDate', null,
      'draftYear', draft_year,
      'sport', sport_code,
      'competition', league_code,
      'league', league_code,
      'round', round,
      'overallPick', overall_pick,
      'person', jsonb_build_object(
        'personId', person_id,
        'qid', qid,
        'name', coalesce(full_name, player_name),
        'leagueCodes', jsonb_build_array(league_code),
        'franchiseIds', case when franchise_id is null then '[]'::jsonb else jsonb_build_array(franchise_id) end,
        'teamSeasonIds', case when team_season_id is null then '[]'::jsonb else jsonb_build_array(team_season_id) end),
      'sourceId', code,
      'licence', licence,
      'attribution', attribution
    ) order by draft_pick_id) from page), '[]'::jsonb)
)::text;
rollback;
