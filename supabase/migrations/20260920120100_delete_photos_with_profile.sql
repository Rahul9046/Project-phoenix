-- A deleted member's photographs go with them, whoever did the deleting.
--
-- `delete_my_account()` already removed the files before deleting the user, and
-- the comment there explains why it had to: `storage.objects` has no foreign key
-- to `auth.users`, so nothing cascades. That was correct and it was not enough.
-- It only holds for the one path that happens to remember.
--
-- Every other way an account ends skips it: the Supabase dashboard, the admin
-- API, `npm run demo:remove`, and the throwaway accounts the probes create and
-- destroy on every run. All of those delete the auth user, the profile row
-- cascades away with everything hanging off it, and the photographs stay in the
-- bucket -- attached to an id that no longer resolves to anybody, so nothing in
-- either product can find them again and nothing will ever delete them.
--
-- Four such folders were found in `profile-photos`: one demo member and three
-- throwaway test accounts. Photographs of faces, belonging to accounts that had
-- been deleted, sitting in a bucket indefinitely. On a product that asks people
-- to put their face on a profile so a stranger can decide whether to meet them,
-- "we delete your account" has to mean the pictures too.
--
-- So the rule moves to where deletion actually happens. A row trigger on
-- `profiles` fires however the row came to be deleted -- including when it is
-- cascaded from `auth.users`, which is every path listed above -- and runs in
-- the same transaction, so the files and the row leave together or not at all.
-- That is strictly better than the old ordering, which could delete the files
-- and then fail to delete the account.

create or replace function public.delete_profile_photos()
returns trigger
language plpgsql
volatile
-- Definer because the caller is rarely the owner: an admin deleting somebody
-- from the dashboard is `supabase_auth_admin`, and the member deleting
-- themselves is `authenticated`. Neither may write `storage.objects`, and
-- granting them that so this could run as invoker would hand every signed-in
-- member the ability to delete anybody's files.
security definer
-- Pinned, for the same reason every definer function here pins it: a definer
-- function must never resolve a name through a caller-controlled path.
set search_path = public
as $$
begin
  delete from storage.objects
   where bucket_id = 'profile-photos'
     and (storage.foldername(name))[1] = old.id::text;

  return old;
end;
$$;

comment on function public.delete_profile_photos() is
  'Removes a member''s files from the profile-photos bucket when their profile row is deleted, by whatever route. storage.objects has no foreign key to cascade from.';

-- Not an API endpoint. Revoking EXECUTE does not stop the trigger: Postgres
-- checks the privilege when the trigger is created, not each time it fires.
revoke execute on function public.delete_profile_photos() from public, anon, authenticated;

drop trigger if exists profiles_delete_photos on public.profiles;

create trigger profiles_delete_photos
  after delete on public.profiles
  for each row
  execute function public.delete_profile_photos();

-- ---------------------------------------------------------------------------
-- And now `delete_my_account` does not need to remember
-- ---------------------------------------------------------------------------
--
-- Redefined without its own storage delete, because the trigger now does it and
-- two places that both delete the same files are two places to keep in step.
-- The note about ordering goes with it: there is no longer an order to get
-- wrong, since both happen in one transaction.

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
  -- its languages and photos, interests in both directions, connections,
  -- messages, blocks, reports and any subscription -- and, through the
  -- `profiles_delete_photos` trigger, the files in the bucket as well.
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Permanently deletes the calling user and everything cascading from them, photographs included. The id is taken from the session and is deliberately not a parameter.';
