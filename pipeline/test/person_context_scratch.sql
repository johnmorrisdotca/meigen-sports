-- A tiny scratch copy of the core tables the person extractors read, with the awkward cases that went wrong on DS1:
-- a Cy Young winner whose teammates must not inherit his award, players with statistics but no roster row, and a coach.
create schema meta; create schema ref; create schema core; create schema legacy_wikidata_harvest; create schema legacy_people;
create table meta.source (source_id smallint primary key, code text, licence text, attribution text);
create table ref.league (league_code text primary key, sport_code text);
create table core.person (person_id bigint primary key, full_name text, birth_date date, primary_position text, nationality_code text, hall_of_fame_year smallint);
create table core.person_sport (person_id bigint, sport_code text);
create table core.external_id (entity_kind text, entity_id bigint, source_id smallint, external_key text);
create table core.season (season_id int primary key, league_code text, start_year smallint);
create table core.franchise_identity (franchise_id int, valid_during daterange, full_name text);
create table core.team_season (team_season_id int primary key, franchise_id int, season_id int);
create table core.roster_stint (person_id bigint, team_season_id int, role text default 'player');
create table core.player_season_stat (person_id bigint, team_season_id int);
create table core.award (award_id int primary key, league_code text, code text, name text, kind text);
create table core.award_winner (award_winner_id bigint generated always as identity primary key, award_id int, season_id int, team_season_id int, person_id bigint, winner_name text);
create table legacy_wikidata_harvest.claim (qid text, prop text, value_on date, value_prec int, rank text, value_qid text);
create table legacy_people.claim (qid text, prop text, value_qid text, rank text);

insert into meta.source values (1, 'wikidata', 'CC0 1.0', 'Wikidata');
insert into ref.league values ('mlb', 'baseball');
insert into core.season values (1, 'mlb', 1956), (2, 'mlb', 1996);
insert into core.franchise_identity values (10, '[1900-01-01,2100-01-01)', 'New York Yankees'), (11, '[1900-01-01,2100-01-01)', 'Texas Rangers');
insert into core.team_season values (100, 10, 1), (101, 11, 2);
insert into core.person values
  (1, 'Mickey Mantle', '1931-10-20', 'CF', 'US', 1974),
  (2, 'A Pitcher', '1926-06-14', 'P', 'US', null),
  (3, 'Juan Gonzalez', '1969-10-20', 'DH', 'US', null),
  (4, 'A Coach', '1940-10-20', null, 'US', null);
insert into core.external_id select 'person', person_id, 1, 'Q' || person_id from core.person;
insert into legacy_wikidata_harvest.claim select 'Q' || person_id, 'P569', birth_date, 11, 'normal', null from core.person;
insert into core.roster_stint values (1, 100, 'player'), (4, 100, 'coach');
insert into core.player_season_stat values (2, 100), (3, 101);
insert into core.award values (1, 'mlb', 'mlb_cy_young', 'Cy Young Award', 'person_award'), (2, 'mlb', 'mlb_mvp', 'Major League Baseball Most Valuable Player Award', 'person_award'),
                              (3, 'mlb', 'mlb_world_series', 'World Series', 'championship');
-- The Cy Young row carries the pitcher's team-season (100): that is what every teammate used to inherit.
insert into core.award_winner (award_id, season_id, team_season_id, person_id, winner_name) values
  (1, 1, 100, 2, 'A Pitcher'), (2, 1, 100, 1, 'Mickey Mantle'), (3, 1, 100, null, 'New York Yankees');
