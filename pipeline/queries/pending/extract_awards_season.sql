-- Read-only keyset page of award winners. Season-year by default.
-- A championship gets day precision only when that season has exactly one distinct final game_date.
-- psql -v ON_ERROR_STOP=1 -v after_id=0 -v page_limit=2000 -f pipeline/queries/extract_awards_season.sql
begin read only;
set local statement_timeout = '8s';
with page as materialized (
  select distinct on (w.award_winner_id)
         w.award_winner_id, w.award_id, w.season_id, w.team_season_id, w.person_id, w.winner_name,
         a.code as award_code, a.kind as award_kind, a.name as award_name, a.league_code,
         s.start_year, l.sport_code, ts.franchise_id, ident.full_name as club_name,
         p.full_name, x.external_key as qid,
         src.code as source_code, src.licence, src.attribution
  from core.award_winner w
  join core.award a on a.award_id = w.award_id
  join core.season s on s.season_id = w.season_id
  join ref.league l on l.league_code = a.league_code
  join meta.source src on src.source_id = w.source_id
  left join core.team_season ts on ts.team_season_id = w.team_season_id
  left join lateral (
    select i.full_name
    from core.franchise_identity i
    where i.franchise_id = ts.franchise_id
    order by lower(i.valid_during) desc nulls last
    limit 1
  ) ident on true
  left join core.person p on p.person_id = w.person_id
  left join core.external_id x on x.entity_kind = 'person' and x.entity_id = w.person_id
    and x.external_key ~ '^Q[0-9]+$'
    and exists (select 1 from meta.source ms where ms.source_id = x.source_id and ms.code = 'wikidata')
  where w.award_winner_id > :'after_id'::bigint
  order by w.award_winner_id, x.external_key
  limit :page_limit
),
sided as (
  select p.*,
         case when p.award_kind = 'championship' and f.final_days = 1 then f.final_date else null end as event_date,
         case when p.award_kind = 'championship' and f.final_days = 1 then 'day' else 'year' end as date_precision
  from page p
  left join lateral (
    select min(g.game_date) as final_date, count(distinct g.game_date) as final_days
    from core.venue_final_game vf
    join core.game g on g.game_id = vf.game_id
    where p.award_kind = 'championship' and vf.season_id = p.season_id
  ) f on true
)
select jsonb_build_object(
  'category', 'award',
  'scannedCount', (select count(*) from sided),
  'nextCursor', (select jsonb_build_object('id', award_winner_id) from sided order by award_winner_id desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:award:' || award_winner_id::text,
      'category', 'award',
      'reviewStatus', 'candidate',
      'datePrecision', date_precision,
      'eventDate', event_date,
      'seasonStartYear', start_year,
      'sport', sport_code,
      'competition', award_code,
      'league', league_code,
      'awardKind', award_kind,
      'awardName', award_name,
      'winnerName', winner_name,
      'clubName', club_name,
      'person', case when person_id is null then null else jsonb_build_object(
        'personId', person_id,
        'qid', qid,
        'name', coalesce(full_name, winner_name),
        'leagueCodes', jsonb_build_array(league_code),
        'franchiseIds', case when franchise_id is null then '[]'::jsonb else jsonb_build_array(franchise_id) end,
        'teamSeasonIds', case when team_season_id is null then '[]'::jsonb else jsonb_build_array(team_season_id) end) end,
      'sourceId', source_code,
      'licence', licence,
      'attribution', attribution
    ) order by award_winner_id) from sided), '[]'::jsonb)
)::text;
rollback;
