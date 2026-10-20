-- A tiny scratch copy of the core tables extract_final_context.sql reads, with the cases that must stay silent:
-- a venue with a name as of the day, a record two sources disagree on, a record that is not the whole season, a league with a gap in its
-- champions (no title number) and one whose only gap is a season recorded as "not awarded" (a number).
create schema meta; create schema ref; create schema core;
create table core.season (season_id int primary key, league_code text, start_year smallint, games_per_team smallint, regular_ends_on date);
create table core.team_season (team_season_id int primary key, franchise_id int, season_id int);
create table core.franchise_league (franchise_id int, league_code text, valid_during daterange);
create table core.game (game_id bigint primary key, season_id int, phase text, game_date date, home_team_season_id int, away_team_season_id int,
                        venue_id int, status text, home_score smallint, away_score smallint);
create table core.game_venue (game_id bigint, venue_id int);
create table core.venue (venue_id int primary key, city text);
create table core.venue_name (venue_id int, valid_during daterange, name text);
create table core.venue_final_game (game_id bigint, venue_id int, season_id int);
create table core.standing (team_season_id int, phase text, as_of date, source_id smallint, games_played smallint, wins smallint, losses smallint, ties smallint, ot_losses smallint);
create table core.award (award_id int primary key, league_code text, code text, name text, kind text);
create table core.award_winner (award_winner_id bigint generated always as identity primary key, award_id int, season_id int, team_season_id int, winner_name text);
create table core.title_not_awarded (league_code text, start_year smallint);

-- mlb: seasons 1975, 1976, 1980 (not awarded), 1990. The Reds (franchise 20) won 1975, 1976 and 1990; the A's (21) lost 1990.
insert into core.season values (1, 'mlb', 1975, 162, '1975-09-28'), (2, 'mlb', 1976, 162, '1976-10-03'), (3, 'mlb', 1980, 162, '1980-10-05'), (4, 'mlb', 1990, 162, '1990-10-03');
insert into core.team_season values (101, 20, 1), (102, 20, 2), (103, 20, 4), (104, 21, 4);
insert into core.franchise_league values (20, 'mlb', '[1882-01-01,)'), (21, 'mlb', '[1901-01-01,)');
insert into core.award values (1, 'mlb', 'mlb_world_series', 'World Series', 'championship');
insert into core.award_winner (award_id, season_id, team_season_id, winner_name) values (1, 1, 101, 'Cincinnati Reds'), (1, 2, 102, 'Cincinnati Reds'), (1, 4, 103, 'Cincinnati Reds');
insert into core.title_not_awarded values ('mlb', 1980);
insert into core.venue values (1, 'Oakland'), (2, 'Cincinnati');
insert into core.venue_name values (1, '[1968-01-01,1998-01-01)', 'Oakland-Alameda County Coliseum'), (1, '[1998-01-01,)', 'RingCentral Coliseum'), (2, '[1970-01-01,2003-01-01)', 'Riverfront Stadium');
-- Game 4 of 1990 at Oakland (final venue 1), Game 3 at Cincinnati.
insert into core.game values (1, 4, 'playoffs', '1990-10-20', 104, 103, 1, 'final', 1, 2), (2, 4, 'playoffs', '1990-10-19', 103, 104, null, 'final', 8, 3);
insert into core.venue_final_game values (1, 1, 4), (2, 2, 4);
-- The Reds' 1990 record: two sources agree on 91-71 (one row mid-season is ignored); the A's: two sources disagree.
insert into core.standing values
  (103, 'regular', '1990-10-03', 1, 162, 91, 71, null, null), (103, 'regular', '1990-10-03', 2, 162, 91, 71, null, null), (103, 'regular', '1990-07-01', 3, 80, 40, 40, null, null),
  (104, 'regular', '1990-10-03', 1, 162, 103, 59, null, null), (104, 'regular', '1990-10-03', 2, 162, 102, 60, null, null);

-- nba: 1988 has no champion and no "not awarded" row (a gap); the Lakers (30) won 1989. The Pistons (31) have a record of 63-19, a tie of 0 is not printed.
insert into core.season values (5, 'nba', 1988, 82, '1989-04-23'), (6, 'nba', 1989, 82, '1990-04-22');
insert into core.team_season values (105, 30, 6), (106, 31, 6);
insert into core.franchise_league values (30, 'nba', '[1948-01-01,)'), (31, 'nba', '[1948-01-01,)');
insert into core.award values (2, 'nba', 'nba_finals', 'NBA Finals', 'championship');
insert into core.award_winner (award_id, season_id, team_season_id, winner_name) values (2, 6, 105, 'Los Angeles Lakers');
insert into core.game values (3, 6, 'playoffs', '1990-06-14', 105, 106, 1, 'final', 110, 100);
insert into core.venue_final_game values (3, 1, 6);
insert into core.standing values (105, 'regular', '1990-04-22', 1, 82, 63, 19, 0, null);

-- nhl: a team with overtime losses (1999 on) and one champion row. A franchise whose league row starts after the game has no leagues, so no number.
insert into core.season values (7, 'nhl', 2002, 82, '2003-04-06');
insert into core.team_season values (107, 40, 7), (108, 41, 7);
insert into core.franchise_league values (40, 'nhl', '[1967-01-01,)');
insert into core.award values (3, 'nhl', 'nhl_stanley_cup', 'Stanley Cup', 'championship');
insert into core.award_winner (award_id, season_id, team_season_id, winner_name) values (3, 7, 107, 'New Jersey Devils');
insert into core.game values (4, 7, 'playoffs', '2003-06-09', 107, 108, null, 'final', 3, 0);
insert into core.game_venue values (4, 2);
insert into core.standing values (107, 'regular', '2003-04-06', 1, 82, 46, 20, 10, 6);
insert into core.venue_final_game values (4, null, 7);
