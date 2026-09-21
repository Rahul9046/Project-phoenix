-- The database cannot delete a member's photographs, and must stop pretending.
--
-- `delete_my_account()` has run `delete from storage.objects` since August, and
-- 20260920120100 tried to move that same statement into a trigger so every
-- deletion path would get it. The trigger broke account deletion outright, which
-- is how the real cause surfaced:
--
--   42501: Direct deletion from storage tables is not allowed.
--          Use the Storage API instead.
--
-- Supabase refuses the statement whatever role runs it -- confirmed as
-- `postgres`, inside a SECURITY DEFINER function with a pinned search_path,
-- against a folder holding nothing at all. It is not a permission that can be
-- granted; it is a guard on the storage tables, and the refusal does not depend
-- on any row matching.
--
-- Two things follow.
--
-- The trigger cannot exist. It was dropped in 20260920120200 and is not coming
-- back in another form: there is no SQL that removes a storage object, so there
-- is no trigger, rule, cascade or constraint that can make files leave when a
-- row does.
--
-- And `delete_my_account()` never worked as written. The storage delete was its
-- first statement, so the function raised before reaching `delete from
-- auth.users` -- meaning the app's "delete my account" did nothing at all and
-- reported a failure. The web never called it (its server action deletes the
-- user with the service role directly) which is why nobody had noticed, and
-- also why four folders of photographs had accumulated in the bucket.
--
-- So the responsibility moves out of the database to the only place that can
-- discharge it: whatever deletes the account calls the Storage API first. Both
-- clients now do. This migration removes the statement that cannot work, which
-- is what makes the function work at all.
--
-- 20260920120100 already redefined the function this way in passing. Redefined
-- again here, unchanged, so that the reasoning lives in the migration that is
-- about it rather than in one whose stated purpose was the opposite.

create or replace function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  -- One delete. Everything hangs off auth.users through profiles: the profile,
  -- its languages and photo rows, interests in both directions, connections,
  -- messages, blocks, reports and any subscription.
  --
  -- The files in the bucket are the one thing not reachable from here. The
  -- caller removes them through the Storage API before calling this, because
  -- that is the only interface that can.
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Permanently deletes the calling user and everything cascading from them. The id is taken from the session and is deliberately not a parameter. Storage files are not reachable from SQL; the caller clears them through the Storage API first.';

-- The thermometer from 20260920120200 has been read.
drop function if exists public.diagnose_storage_delete();
