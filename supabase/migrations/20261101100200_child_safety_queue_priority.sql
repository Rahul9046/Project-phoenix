-- A child safety report is the first thing in the queue, not the newest thing.
--
-- `/child-safety` tells the public that "a child safety report is the highest
-- priority thing in the queue". It was not. `admin_list_reports` ordered by
-- whether a report was open and then by age, so a report that somebody is a
-- child sat between two reports about unwanted promotion, and the only thing
-- deciding what a moderator read first was which arrived most recently.
--
-- This makes the claim true. Two changes and no more:
--
--   * `is_child_safety` is returned, so the screen can mark the report rather
--     than re-deriving the category list in TypeScript -- one definition of
--     "this is a child safety matter", in the database, next to the ordering
--     that depends on it.
--
--   * the ordering puts open child-safety reports above everything.
--
-- ---------------------------------------------------------------------------
-- Why the order is four clauses rather than one
-- ---------------------------------------------------------------------------
--
--   open and child-safety   ->  needs attention now
--   open                    ->  needs attention
--   child-safety, resolved  ->  the history that matters most
--   everything else, newest first
--
-- "Child safety first" on its own would float a CSAE report that was dismissed
-- in September above an open harassment report filed this morning. Priority is
-- about what needs doing, and a resolved report needs nothing done -- so being
-- open is the first question and the category is the second. In the default
-- view this is invisible, because the default filter is already 'open'; it
-- matters under "All", which is where somebody looks when they are catching up.
--
-- ---------------------------------------------------------------------------
-- Why this drops and recreates rather than `create or replace`
-- ---------------------------------------------------------------------------
--
-- Postgres refuses to replace a set-returning function whose OUT parameters
-- have changed, and this adds a column. So the function is dropped and built
-- again -- which means every property that was attached to it has to be put
-- back deliberately, because a recreated function is a new object with
-- defaults: SECURITY INVOKER, a search path inherited from the caller, EXECUTE
-- granted to PUBLIC, and ownership belonging to whoever ran the migration.
--
-- Any one of those being forgotten is a privilege bug, not a cosmetic one. An
-- invoker-rights `admin_list_reports` would return rows only to someone who
-- could already read `member_reports` -- which is nobody, so it would appear to
-- work and return nothing. Worse, leaving EXECUTE with PUBLIC would let `anon`
-- call it by name; the body's `where public.is_moderator()` means they would
-- still get no rows, but the house rule exists precisely so that the boundary
-- does not depend on reading the body. See the note in CLAUDE.md: `create
-- function` grants EXECUTE to PUBLIC and `anon` inherits it, so revoking from
-- `anon` alone does nothing.
--
-- Ownership is captured from the live object before the drop rather than
-- assumed to be `postgres`, so this migration cannot silently re-home the
-- function if it is ever applied by a different role.

create temporary table alr_previous_owner as
select pg_get_userbyid(p.proowner) as owner_name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'admin_list_reports';

drop function if exists public.admin_list_reports(text);

create function public.admin_list_reports(p_filter text default 'open')
returns table (
  id uuid,
  status public.report_status,
  reason_code public.report_reason,
  description text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reporter_id uuid,
  reporter_name text,
  reported_id uuid,
  reported_name text,
  reported_suspended_at timestamptz,
  reports_against_reported integer,
  is_child_safety boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id,
         r.status,
         r.reason_code,
         r.description,
         r.created_at,
         r.reviewed_at,
         r.reporter_id,
         rep.first_name,
         r.reported_id,
         tgt.first_name,
         tgt.suspended_at,
         (select count(*)::integer from public.member_reports x where x.reported_id = r.reported_id),
         r.reason_code in ('csae', 'underage')
    from public.member_reports r
    join public.profiles rep on rep.id = r.reporter_id
    join public.profiles tgt on tgt.id = r.reported_id
   where public.is_moderator()
     and (
       p_filter = 'all'
       or (p_filter = 'open' and r.status in ('received', 'reviewing'))
       or (p_filter = 'resolved' and r.status in ('actioned', 'dismissed'))
     )
   order by (r.status in ('received', 'reviewing')
             and r.reason_code in ('csae', 'underage')) desc,
            (r.status in ('received', 'reviewing')) desc,
            (r.reason_code in ('csae', 'underage')) desc,
            r.created_at desc
   limit 200;
$$;

comment on function public.admin_list_reports(text) is
  'Moderation queue. Returns nothing at all to a caller who is not on the allowlist. Open child safety reports (csae, underage) sort above everything else, and is_child_safety says which they are.';

-- Back to how it was. The revoke names `public` as well as `anon`, because
-- `create function` granted EXECUTE to PUBLIC a few statements ago and `anon`
-- inherits from it -- revoking from `anon` alone would leave the grant in place.
revoke execute on function public.admin_list_reports(text) from public, anon;
grant execute on function public.admin_list_reports(text) to authenticated;

do $$
declare
  v_owner text;
begin
  select owner_name into v_owner from alr_previous_owner limit 1;

  -- Absent only if the function did not exist before this migration, which
  -- cannot happen on any database that has run 20260911100100. Left as a
  -- no-op rather than a guess at the right role.
  if v_owner is not null then
    execute format('alter function public.admin_list_reports(text) owner to %I', v_owner);
  end if;
end;
$$;

drop table alr_previous_owner;
