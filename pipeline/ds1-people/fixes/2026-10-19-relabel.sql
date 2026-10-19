-- DS1 relabel for the meigen people (hand-off for the coordinating session; agents never run this).
-- Why: a wrong Wikidata item put 249 baseball players under motor_racing; rows were tagged women-* (a sex selector) and
-- para-* (health data); sport codes para_* and paralympics are para flags. Sports that are sports in their own right
-- (wheelchair_basketball, wheelchair_tennis, wheelchair_rugby, wheelchair_racing, wheelchair_fencing) stay as they are.
-- One transaction. Dry run first: ds1-apply.sh --dry-run (this file has no inner commit).
-- Expected counts on the spx-stats seed of 2026-10-19: motor_racing 251 (249 baseball + 2 true motor racing), women-* 1,158 batch labels,
-- para-* 149 batch labels, para_* about 14 rows, paralympics 21 rows. Read the "before" and "after" numbers it prints.

create temp table sport_fix (old_code text primary key, new_code text not null) on commit drop;
insert into sport_fix values
  ('motor_racing', 'baseball'),            -- Q5369 is baseball. CHECK the 2 real motor-racing rows by hand first (see note below)
  ('para_swimming', 'swimming'), ('para_athletics', 'athletics'), ('para_taekwondo', 'taekwondo'),
  ('para_ice_hockey', 'ice_hockey'), ('para_cycling', 'cycling'), ('para_badminton', 'badminton'),
  ('para_archery', 'archery'), ('para_alpine_skiing', 'alpine_skiing'), ('para_cross_country_skiing', 'cross_country_skiing'),
  ('para_nordic_skiing', 'nordic_skiing'), ('paralympics', 'multi_sport');

select 'before' as step, sport, count(*) from legacy_wikidata_meigen.athlete
 where sport in (select old_code from sport_fix) or batch ~ '^(women|para)-' group by sport order by 3 desc;

-- 1. staging table: drop a row whose person already has the new sport, then rename the rest
delete from legacy_wikidata_meigen.athlete a
 using sport_fix f
 where a.sport = f.old_code
   and exists (select 1 from legacy_wikidata_meigen.athlete b where b.qid = a.qid and b.sport = f.new_code);
update legacy_wikidata_meigen.athlete a set sport = f.new_code from sport_fix f where a.sport = f.old_code;
update legacy_wikidata_meigen.athlete set batch = regexp_replace(batch, '^(women|para)-', '') where batch ~ '^(women|para)-';

-- 2. core.person_sport: the source_key carries the sport code (wikidata:<qid>:P641:<code> and p641-map:<qid>:<code>)
delete from core.person_sport ps
 using sport_fix f, meta.source s
 where s.code = 'wikidata_meigen' and ps.source_id = s.source_id and ps.sport_code = f.old_code
   and exists (select 1 from core.person_sport p2 where p2.person_id = ps.person_id and p2.source_id = ps.source_id and p2.sport_code = f.new_code);
update core.person_sport ps
   set sport_code = f.new_code,
       source_key = replace(ps.source_key, ':' || f.old_code, ':' || f.new_code)
  from sport_fix f, meta.source s
 where s.code = 'wikidata_meigen' and ps.source_id = s.source_id and ps.sport_code = f.old_code;

select 'after' as step, sport, count(*) from legacy_wikidata_meigen.athlete
 where sport in ('baseball', 'swimming', 'athletics', 'multi_sport') group by sport order by 3 desc;

-- NOTE: the spx-stats seed has 251 motor_racing rows, this repo's athletes.csv 249 (all baseball by their own P641 item Q5369).
-- Look at the 2 others before running: select qid, label from legacy_wikidata_meigen.athlete where sport = 'motor_racing' and qid not in
-- (the 249 in pipeline/ds1-people/athletes.csv that carry sport baseball). Keep any real driver as motor_racing: remove it from sport_fix's effect
-- by deleting it from the table above, or move it back with an update afterwards.
-- core.person_sport rows written by 217 from the harvest (source p641-map) already use the corrected map.
