-- Distinct MM-DD coverage already on DS1. One statement, 8s. Not a record dump.
-- psql -v ON_ERROR_STOP=1 -f pipeline/queries/extract_day_coverage.sql
begin read only;
set local statement_timeout = '8s';
select jsonb_build_object(
  'games', (select count(distinct to_char(game_date, 'MM-DD')) from core.game),
  'soccer', (select count(distinct to_char(match_date, 'MM-DD')) from core.soccer_match),
  'finals', (select count(distinct to_char(g.game_date, 'MM-DD')) from core.venue_final_game f join core.game g on g.game_id = f.game_id),
  'franchiseIdentityStarts', (select count(distinct to_char(lower(valid_during), 'MM-DD')) from core.franchise_identity where lower(valid_during) is not null),
  'venueOpeningsDay', (select count(distinct to_char(opened_on, 'MM-DD')) from legacy_wikidata_venues.venue where opened_prec = 11 and opened_on is not null),
  'draftsDay', (select count(distinct to_char(point_on, 'MM-DD')) from legacy_people.resume_claim where prop = 'P647' and point_prec = 11 and point_on is not null)
)::text;
rollback;
