-- A member can name child sexual abuse or exploitation.
--
-- `report_reason` has carried `underage` and `safety_threat` since
-- 20260920110100, and between them a reporter could describe a child-safety
-- concern -- but neither says it. So the published /child-safety page had to
-- tell people to pick one of those two instead, which asks somebody who has
-- just seen something frightening to translate it into a category that does
-- not quite fit. Google Play's Child Safety Standards expect an in-app way to
-- report CSAE by name, and a category that has to be explained on a web page is
-- not one.
--
-- ---------------------------------------------------------------------------
-- Why this file contains one statement and nothing else
-- ---------------------------------------------------------------------------
--
-- `alter type ... add value` cannot be undone. Postgres offers no way to
-- remove an enum label, and doing it by hand would mean creating a replacement
-- type, rewriting every dependent column, function signature and index, and
-- deciding what happens to the reports already filed under the old one. That is
-- why `incorrect_relationship_status` is still in this enum today, two months
-- after both clients stopped offering it.
--
-- So the one irreversible act in this piece of work is bundled with nothing
-- that might need rolling back. Everything that reads the new value --
-- the queue ordering, the admin label, the clients' pickers -- is in a later
-- migration or in application code, both of which can be reverted freely.
--
-- There is a second, harder reason. A value added by `alter type` cannot be
-- *used* in the same transaction that added it, and `supabase db push` runs each
-- migration file in its own transaction. A single migration that added 'csae'
-- and then wrote `reason_code in ('csae', ...)` into a function body would fail
-- outright. The split is not tidiness; it is the only order that works.

alter type public.report_reason add value if not exists 'csae';

comment on type public.report_reason is
  'The fixed list of report categories. Values are never removed: a category that stops being offered still has to read correctly on the reports already filed under it. ''csae'' is first in what the clients offer -- see packages/i18n/src/report.ts, which decides the order -- and is grouped with ''underage'' as a child-safety report everywhere one is prioritised.';
