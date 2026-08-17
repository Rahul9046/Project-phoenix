-- Row Level Security.
--
-- On for every table, with no exceptions and no permissive fallback. Anything
-- not granted below is denied.
--
-- Cross-member profile discovery is intentionally absent: there are no rules yet
-- for who may see whom, and the safe default while those are undecided is that
-- nobody sees anybody. Adding a discovery policy is a deliberate later step.

alter table public.cities            enable row level security;
alter table public.languages         enable row level security;
alter table public.profiles          enable row level security;
alter table public.profile_languages enable row level security;
alter table public.waitlist          enable row level security;

-- ---------------------------------------------------------------------------
-- Reference data: readable by anyone, writable by nobody.
-- The signup form needs these before the visitor has an account, so `anon` is
-- included. Only active rows — deactivating a city withdraws it from signup.
-- ---------------------------------------------------------------------------

create policy "Active cities are readable by everyone"
  on public.cities
  for select
  to anon, authenticated
  using (is_active);

create policy "Active languages are readable by everyone"
  on public.languages
  for select
  to anon, authenticated
  using (is_active);

-- No insert/update/delete policies: changing this data requires the service
-- role, i.e. a migration or an admin tool. Never the browser.

-- ---------------------------------------------------------------------------
-- Profiles: your own row, and nothing else.
-- ---------------------------------------------------------------------------

create policy "Members can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Members can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  -- Without this a member could update their row to carry someone else's id.
  with check ((select auth.uid()) = id);

-- The signup trigger normally creates the row. This covers the case where it
-- is missing, and still only ever for yourself.
create policy "Members can create their own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- No delete policy: account deletion cascades from auth.users and is an
-- administrative action, not something a stray client call should perform.

-- ---------------------------------------------------------------------------
-- Profile languages: your own rows.
-- ---------------------------------------------------------------------------

create policy "Members can read their own languages"
  on public.profile_languages
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "Members can add their own languages"
  on public.profile_languages
  for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "Members can remove their own languages"
  on public.profile_languages
  for delete
  to authenticated
  using ((select auth.uid()) = profile_id);

-- ---------------------------------------------------------------------------
-- Waitlist: anyone may join, nobody may read.
-- ---------------------------------------------------------------------------

create policy "Anyone can join the waitlist"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);

-- No select policy. The list is personal data belonging to people who are not
-- members yet; reading it requires the service role.
