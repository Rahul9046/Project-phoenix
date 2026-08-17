-- Keeping the two halves of an account in step.

-- Every account gets a profile row the moment it is created, so no code path
-- has to handle "signed in but no profile". Runs as definer because the signing
-- -up user has no rights on public.profiles yet.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- Pinned search_path: a security definer function must never resolve names
-- through a caller-controlled path.
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone_verified_at)
  values (new.id, new.phone_confirmed_at)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Mirror phone confirmation from auth.users onto the profile.
--
-- Until an SMS provider is chosen the app writes phone_verified_at directly and
-- this never fires. Once Supabase phone auth is live it becomes the source of
-- truth, and the app stops writing the column — no other change needed.
create or replace function public.sync_phone_verified_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone_confirmed_at is distinct from old.phone_confirmed_at then
    update public.profiles
      set phone_verified_at = new.phone_confirmed_at
      where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_phone_confirmed
  after update of phone_confirmed_at on auth.users
  for each row
  execute function public.sync_phone_verified_at();

-- updated_at should reflect reality rather than whatever the client sent.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_updated_at();
