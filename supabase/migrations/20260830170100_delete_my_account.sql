-- Deleting your own account, from any client.
--
-- The web app does this through a server action holding the service-role key.
-- A mobile app has no server to hide a key in, and shipping one in the binary
-- would hand every user a credential that bypasses every policy -- so the
-- capability moves into the database, where it can be scoped precisely.
--
-- The scoping is the whole design. The id comes from `auth.uid()` and is not a
-- parameter, so there is no argument a caller could substitute to delete someone
-- else. That is the difference between "delete my account" and "delete an
-- account", and it is the only reason a definer function is safe here.
--
-- Everything else goes with it through ON DELETE CASCADE: the profile, its
-- languages and photos, interests in both directions, connections, messages,
-- blocks, reports and any subscription. Deleting them individually first would
-- be slower and strictly worse -- a failure halfway would leave somebody
-- half-deleted, which is a state nothing in either product knows how to render.
--
-- Storage objects are removed explicitly, because storage.objects has no foreign
-- key to auth.users and would otherwise keep the files after the account that
-- owned them is gone.

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

  -- Files first. If this failed after the row was gone, the objects would be
  -- orphaned with no owner to attribute them to and no way to find them again.
  delete from storage.objects
   where bucket_id = 'profile-photos'
     and (storage.foldername(name))[1] = me::text;

  -- One delete. Everything hangs off auth.users through profiles.
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Permanently deletes the calling user and everything cascading from them. The id is taken from the session and is deliberately not a parameter.';
