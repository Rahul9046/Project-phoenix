-- Back out the trigger, and find out why it failed.
--
-- 20260920120100 added `profiles_delete_photos` and it broke deleting an
-- account outright: the admin API started answering "Database error deleting
-- user" with a 500, because the trigger raises inside the cascade and takes the
-- whole transaction with it. Account deletion is not something to leave broken
-- while working out why, so the trigger comes off first and goes back on in the
-- next migration once the cause is known.
--
-- What this says about `delete_my_account()` is worse and is the reason for the
-- diagnostic below rather than a guess: that function has been running the same
-- `delete from storage.objects` since August. If the statement cannot execute,
-- it has never been able to, and every member who deleted their own account
-- through the product was told their photographs were gone while the files sat
-- in the bucket. Nothing would have reported it -- a definer function that
-- cannot see a row deletes nothing and returns quietly, and no check looked.
--
-- So: measure, do not assume.

drop trigger if exists profiles_delete_photos on public.profiles;

-- ---------------------------------------------------------------------------
-- A thermometer, removed in the next migration
-- ---------------------------------------------------------------------------
--
-- Runs the exact statement the trigger runs, catches whatever comes back, and
-- returns it as text so it can be read through PostgREST. Against an id that
-- owns nothing, so a success deletes nothing and the only thing it can report
-- is whether the statement is permitted to run at all.
--
-- Service role only. It is a definer function touching storage and it exists
-- for one afternoon; nobody else needs to be able to call it.

create or replace function public.diagnose_storage_delete()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  nobody uuid := '00000000-0000-0000-0000-000000000000';
  removed integer;
begin
  delete from storage.objects
   where bucket_id = 'profile-photos'
     and (storage.foldername(name))[1] = nobody::text;

  get diagnostics removed = row_count;
  return format('ok, %s rows, current_user=%s', removed, current_user);
exception
  when others then
    return format('%s: %s (current_user=%s)', sqlstate, sqlerrm, current_user);
end;
$$;

revoke execute on function public.diagnose_storage_delete() from public, anon, authenticated;
grant execute on function public.diagnose_storage_delete() to service_role;
