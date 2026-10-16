-- Season-year awards (no exact day). Counts only, for coverage planning.
-- psql -v ON_ERROR_STOP=1 -f pipeline/queries/extract_awards_season.sql
begin read only;
set local statement_timeout = '8s';
select jsonb_build_object(
  'category', 'award-season-year',
  'note', 'core.award_winner is keyed by season, not by a calendar day. Use extract_finals.sql for championship games with a date.',
  'winners', (select count(*) from core.award_winner),
  'awards', (select count(*) from core.award),
  'byKind', (select jsonb_object_agg(kind, n) from (select a.kind::text, count(*)::int as n from core.award_winner w join core.award a on a.award_id = w.award_id group by a.kind) s)
)::text;
rollback;
