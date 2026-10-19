-- Read-only: NHL regular-season career goals and assists as season-end derived facts.
-- Does not invent a game date. A season total cannot name the game where a threshold was crossed.
-- Date precision is year. Public convert still drops nhl_api / "Owned by SPX" / "No licence published".
-- Completeness: every NHL regular-season skater row in the league-year is an input; a leader row is
-- emitted only when that season has at least one skater row (incomplete seasons stay unpublished).
-- psql -v ON_ERROR_STOP=1 -v after_year=1916 -v page_limit=20 -f pipeline/queries/extract_nhl_career_records.sql
begin read only;
set local statement_timeout = '8s';
with years as materialized (
  select s.start_year
  from core.season s
  where s.league_code = 'nhl' and s.start_year > :'after_year'::int
  group by s.start_year
  order by s.start_year
  limit :page_limit
),
skater as materialized (
  select x.person_id, p.full_name, s.start_year,
         src.code as source_code, src.licence, src.attribution,
         coalesce(core.stat_num(x.stat_group, x.stats, 'g'), 0) as goals,
         coalesce(core.stat_num(x.stat_group, x.stats, 'a'), 0) as assists
  from core.player_season_stat x
  join core.team_season ts on ts.team_season_id = x.team_season_id
  join core.season s on s.season_id = ts.season_id and s.league_code = 'nhl'
  join core.person p on p.person_id = x.person_id
  join meta.source src on src.source_id = x.source_id
  join years y on y.start_year = s.start_year
  where x.phase = 'regular' and x.stat_group = 'skater'
),
season_person as materialized (
  select person_id, full_name, start_year, source_code, licence, attribution,
         sum(goals) as goals, sum(assists) as assists
  from skater
  group by person_id, full_name, start_year, source_code, licence, attribution
),
running as materialized (
  select person_id, full_name, start_year, source_code, licence, attribution,
         sum(goals) over (partition by person_id order by start_year
                          rows between unbounded preceding and current row) as career_goals,
         sum(assists) over (partition by person_id order by start_year
                            rows between unbounded preceding and current row) as career_assists
  from season_person
),
leaders as (
  select distinct on (start_year, metric)
         start_year, metric, person_id, full_name, value, source_code, licence, attribution
  from (
    select start_year, 'goals'::text as metric, person_id, full_name, career_goals as value,
           source_code, licence, attribution from running
    union all
    select start_year, 'assists', person_id, full_name, career_assists, source_code, licence, attribution from running
  ) u
  order by start_year, metric, value desc, person_id
)
select jsonb_build_object(
  'category', 'extract_nhl_career_records',
  'scannedCount', (select count(*) from leaders),
  'nextCursor', (select jsonb_build_object('year', start_year) from years order by start_year desc limit 1),
  'records', coalesce((select jsonb_agg(jsonb_build_object(
      'recordId', 'spx:derived:nhl-career-' || metric || ':' || person_id::text || ':' || start_year::text,
      'category', 'milestone',
      'reviewStatus', 'candidate',
      'basis', 'derived',
      'datePrecision', 'year',
      'eventDate', null,
      'sport', 'ice_hockey',
      'competition', 'nhl',
      'league', 'nhl',
      'seasonStartYear', start_year,
      'derivedRule', 'NHL regular-season career ' || metric || ': sum of skater stat_num(' || metric || ') by person for complete regular-season rows through this season; a leader row is the highest cumulative total at season end. Not a game-level crossing.',
      'derivedInputs', jsonb_build_array('core.player_season_stat', 'phase=regular', 'stat_group=skater', 'league=nhl', 'metric=' || metric),
      'tags', jsonb_build_array('sport-record', 'career-stat-milestone'),
      'record', jsonb_build_object(
        'metric', metric,
        'scope', 'NHL regular-season career',
        'phase', 'regular',
        'holderName', full_name,
        'holderPersonId', person_id,
        'value', value,
        'unit', metric,
        'previousHolderName', null,
        'previousHolderPersonId', null,
        'previousValue', null,
        'setDate', start_year::text,
        'surpassedDate', null,
        'recognition', 'claimed',
        'event', 'held'
      ),
      'person', jsonb_build_object('personId', person_id, 'qid', null, 'name', full_name, 'leagueCodes', jsonb_build_array('nhl'), 'franchiseIds', jsonb_build_array(), 'teamSeasonIds', jsonb_build_array()),
      'sourceId', source_code,
      'licence', licence,
      'attribution', attribution,
      'sourceUrl', 'https://www.wikidata.org/'
    ) order by start_year, metric) from leaders), '[]'::jsonb)
)::text;
rollback;
