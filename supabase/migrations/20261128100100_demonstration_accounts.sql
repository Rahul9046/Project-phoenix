-- Keeping App Review away from real members, in the database.
--
-- Apple's reviewer needs a working account: Guideline 2.1(a) asks for demo
-- credentials and a back end that is switched on. On most products that is a
-- login and nothing more. On Eraya it is a privacy problem, because the thing
-- the reviewer is being asked to exercise is *meeting people*, and the people
-- are real. A reviewer doing their job properly will express interest in
-- somebody, open a conversation, send a message, then report and block them --
-- and on the live product every one of those actions lands on a divorced,
-- separated or widowed adult who signed up to meet someone and has just been
-- approached and dropped by a stranger who was never looking.
--
-- THE PLAN THIS REPLACES
--
-- `ERAYA-IOS-APP-REVIEW-ACCESS-PLAN.md` proposed filling the reviewer's
-- discovery with demonstration profiles and writing "please practise on B" in
-- the App Review notes. Both halves are insufficient, and for the same reason:
--
--   Filling discovery is arithmetic, not a boundary. It relies on the real
--   population staying small enough that demo profiles crowd it out. The
--   population is supposed to grow, so the mitigation gets weaker exactly as
--   the product succeeds.
--
--   Asking the reviewer not to touch real members puts a privacy guarantee in
--   the hands of somebody with no way to tell which profiles are real. It is
--   also a request, and a request is not a control.
--
-- So isolation is enforced here instead, where neither client, neither set of
-- notes, and no amount of reviewer curiosity can get around it.
--
-- THE RULE, IN ONE LINE
--
-- An account meets only accounts of its own kind. Demonstration accounts see
-- and are seen by demonstration accounts; members see and are seen by members.
-- Symmetric, total, and enforced in the same `security definer` functions that
-- already decide who may see whom.
--
-- WHAT THIS DELIBERATELY IS NOT
--
--   Not a privilege. A demonstration account is an ordinary member in every
--   other respect: same sign-in, same RLS, same entitlements, no moderator
--   rights, no bypass of any kind. It can see LESS than a member, never more.
--
--   Not a UI filter. Hiding demonstration profiles in a client would leave the
--   RPCs returning them, and would do nothing about the reverse direction --
--   which is the direction that matters, because it is the one where a real
--   member gets the notification.
--
--   Not a back door for sign-in. Nothing here creates an account, sets a
--   password, fixes an OTP or weakens authentication. The reviewer signs in
--   exactly as a member does; that problem is a mailbox, not a migration.
--
-- ❗ PRODUCTION IS UNCHANGED BY APPLYING THIS. The column defaults to 'member'
-- and every existing row takes the default, so `discover_members` returns
-- precisely what it returned before for every account that exists today. The
-- feature does nothing until somebody is deliberately marked as a
-- demonstration account, which is a service-role act and not part of this file.

-- ---------------------------------------------------------------------------
-- The kinds of account
-- ---------------------------------------------------------------------------
--
-- An enum rather than a boolean. `is_demo` would have to be reinterpreted the
-- first time a third kind appears -- a staff account, a support account, a
-- deliberately retired profile -- and a boolean column that has come to mean
-- three things is how a privacy boundary quietly stops being one.

create type public.account_kind as enum (
  -- A real person who signed up. Everything today.
  'member',
  -- A fabricated account that exists to be demonstrated against. Can only ever
  -- meet other demonstration accounts.
  'demonstration'
);

comment on type public.account_kind is
  'Whether an account belongs to a real person or exists for demonstration. Accounts of different kinds cannot discover, contact or notify one another.';

alter table public.profiles
  add column account_kind public.account_kind not null default 'member';

comment on column public.profiles.account_kind is
  'Set by the service role only; a member cannot change their own. Demonstration accounts are isolated from members in both directions.';

-- Discovery filters on this on every call, for every member.
create index profiles_account_kind_idx on public.profiles (account_kind);

-- ---------------------------------------------------------------------------
-- A member cannot promote themselves into the other population
-- ---------------------------------------------------------------------------
--
-- The same two defences the photo moderation state uses, for the same reason:
-- the privilege is not granted, AND a trigger refuses it anyway. Either alone
-- would be enough today and neither alone survives somebody adding a
-- convenience grant in two years.
--
-- The direction that matters is `demonstration` -> `member`: an account that
-- could do that would walk out of the isolation and into the real population.
-- But both directions are refused, because a member who could mark themselves
-- `demonstration` would vanish from every real member's discovery while still
-- appearing to be in the product, which is a support problem nobody would
-- diagnose.

revoke update (account_kind) on public.profiles from authenticated, anon, public;

create or replace function public.profiles_guard_account_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.account_kind is distinct from old.account_kind
     -- `auth.uid()` is null for the service role, which is the only caller
     -- allowed to do this.
     and auth.uid() is not null then
    raise exception 'account_kind is not self-assignable'
      using errcode = 'ERA02';
  end if;

  return new;
end;
$$;

revoke execute on function public.profiles_guard_account_kind()
  from public, anon, authenticated;

create trigger profiles_guard_account_kind
  before update on public.profiles
  for each row execute function public.profiles_guard_account_kind();

-- ---------------------------------------------------------------------------
-- May these two accounts meet at all?
-- ---------------------------------------------------------------------------
--
-- One definition, called from every place that decides visibility or contact,
-- so the rule cannot drift between discovery and messaging -- which is exactly
-- how a boundary ends up holding in one direction only.
--
-- Fails CLOSED: a missing profile on either side answers false. An id that does
-- not resolve is not a reason to allow contact.
--
-- Not granted to any client role. It takes two ids and answers about other
-- people, so exposing it would let anybody classify the whole population.

create or replace function public.accounts_may_meet(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pa.account_kind from public.profiles pa where pa.id = a)
      = (select pb.account_kind from public.profiles pb where pb.id = b),
    false
  );
$$;

revoke execute on function public.accounts_may_meet(uuid, uuid)
  from public, anon, authenticated;

comment on function public.accounts_may_meet(uuid, uuid) is
  'True when two accounts are of the same kind and may therefore see and contact each other. Fails closed when either profile is missing.';

-- ---------------------------------------------------------------------------
-- Discovery
-- ---------------------------------------------------------------------------
--
-- Re-declared in full rather than patched, because this file must be read
-- alongside `20261127100100_content_moderation.sql` and a reader needs to see
-- the whole predicate. The ONLY change from that version is the `account_kind`
-- equality, marked below.

create or replace function public.discover_members(
  max_results integer default 10,
  page_offset integer default 0,
  min_age integer default null,
  max_age integer default null,
  city_ids uuid[] default null,
  language_ids uuid[] default null,
  relationship_statuses public.relationship_status[] default null,
  religions public.religion[] default null
)
returns setof public.member_card
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      p.id,
      p.city_id as my_city_id,
      p.gender  as my_gender,
      p.seeking as my_seeking,
      p.account_kind as my_kind,
      c.state   as my_state,
      p.suspended_at is not null as suspended
    from public.profiles p
    left join public.cities c on c.id = p.city_id
    where p.id = auth.uid()
  )
  select
    p.id,
    p.first_name,
    date_part('year', age(p.date_of_birth))::integer,
    coalesce(c.name, p.other_city),
    c.state,
    p.relationship_status,
    p.gender,
    coalesce(
      (select array_agg(l.name order by l.name)
         from public.profile_languages pl
         join public.languages l on l.id = pl.language_id
        where pl.profile_id = p.id),
      '{}'::text[]
    ),
    p.about,
    p.looking_for,
    public.visible_photo_path(p.id),
    public.visible_photo_count(p.id),
    public.phone_is_verified(p.phone_verified_at, p.phone_verified_via),
    u.email_confirmed_at is not null,
    public.disclosed_religion(p.religion)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.cities c on c.id = p.city_id, me
  where p.onboarding_stage = 'onboarding_completed'
    and p.id <> me.id
    -- ⬇ THE ONLY NEW CONDITION. A demonstration account sees demonstration
    -- accounts; a member sees members. Both directions, from one predicate.
    and p.account_kind = me.my_kind
    and p.first_name is not null
    and p.date_of_birth is not null
    and not me.suspended
    and p.suspended_at is null
    and public.genders_are_compatible(
          me.my_seeking, me.my_gender, p.seeking, p.gender)
    and not exists (
      select 1 from public.member_blocks b
      where (b.blocker_id = me.id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = me.id)
    )
    and not exists (
      select 1 from public.member_interests i
      where i.from_id = me.id and i.to_id = p.id
    )
    and (min_age is null or date_part('year', age(p.date_of_birth))::integer >= min_age)
    and (max_age is null or date_part('year', age(p.date_of_birth))::integer <= max_age)
    and (city_ids is null or p.city_id = any(city_ids))
    and (
      language_ids is null
      or exists (
        select 1 from public.profile_languages pl
        where pl.profile_id = p.id and pl.language_id = any(language_ids)
      )
    )
    and (relationship_statuses is null or p.relationship_status = any(relationship_statuses))
    and (religions is null or p.religion = any(religions))
  order by
    (p.city_id is not distinct from me.my_city_id) desc,
    (c.state is not distinct from me.my_state) desc,
    p.created_at desc,
    p.id
  limit greatest(least(coalesce(max_results, 10), 50), 1)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

revoke execute on function public.discover_members(
  integer, integer, integer, integer, uuid[], uuid[],
  public.relationship_status[], public.religion[]
) from public, anon;

grant execute on function public.discover_members(
  integer, integer, integer, integer, uuid[], uuid[],
  public.relationship_status[], public.religion[]
) to authenticated;

-- ---------------------------------------------------------------------------
-- Opening a profile directly
-- ---------------------------------------------------------------------------
--
-- Discovery filtering alone would be a UI filter with extra steps: a member id
-- is a UUID in a URL, and anybody who learned one could open the profile
-- behind it. So the same rule is applied here, which is the surface a
-- hand-written request would use.

create or replace function public.member_profile(member_id uuid)
returns setof public.member_card
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.first_name,
    date_part('year', age(p.date_of_birth))::integer,
    coalesce(c.name, p.other_city),
    c.state,
    p.relationship_status,
    p.gender,
    coalesce(
      (select array_agg(l.name order by l.name)
         from public.profile_languages pl
         join public.languages l on l.id = pl.language_id
        where pl.profile_id = p.id),
      '{}'::text[]
    ),
    p.about,
    p.looking_for,
    public.visible_photo_path(p.id),
    public.visible_photo_count(p.id),
    public.phone_is_verified(p.phone_verified_at, p.phone_verified_via),
    u.email_confirmed_at is not null,
    public.disclosed_religion(p.religion)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.cities c on c.id = p.city_id
  where p.id = member_id
    and p.onboarding_stage = 'onboarding_completed'
    -- Same rule as discovery, on the surface a crafted request would use.
    and public.accounts_may_meet(auth.uid(), p.id)
    and not exists (
      select 1 from public.member_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    );
$$;

revoke execute on function public.member_profile(uuid) from public, anon;
grant execute on function public.member_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Expressing interest
-- ---------------------------------------------------------------------------
--
-- The one that actually protects a member's inbox. Everything a reviewer could
-- do to a real person starts here: an interest is what creates a connection,
-- and a connection is what permits a message and raises an activity badge.
--
-- Refused with the existing 'unavailable' message rather than a new one, so
-- nothing about the refusal tells a caller that a separate population exists.
-- An error that says "that is a demonstration account" is an oracle for
-- enumerating which profiles are real.

create or replace function public.express_interest(
  target_id uuid,
  decision public.interest_kind default 'interested'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  reciprocated boolean;
  connection uuid;
begin
  if me is null or me = target_id then
    raise exception 'invalid target';
  end if;

  -- Before anything is written. A cross-kind interest must not leave a row
  -- behind even if a later step would have failed anyway.
  if not public.accounts_may_meet(me, target_id) then
    raise exception 'unavailable';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id in (me, target_id) and p.suspended_at is not null
  ) then
    raise exception 'unavailable';
  end if;

  if exists (
    select 1 from public.member_blocks b
    where (b.blocker_id = me and b.blocked_id = target_id)
       or (b.blocker_id = target_id and b.blocked_id = me)
  ) then
    raise exception 'unavailable';
  end if;

  insert into public.member_interests (from_id, to_id, kind)
  values (me, target_id, decision)
  on conflict (from_id, to_id) do update set kind = excluded.kind;

  if decision <> 'interested' then
    return null;
  end if;

  -- Only the positive decision is an event. Passing on someone is a private
  -- act and counting it would turn discovery into a scored experience.
  perform public.record_product_event('interest_expressed');

  select exists (
    select 1 from public.member_interests i
    where i.from_id = target_id and i.to_id = me and i.kind = 'interested'
  ) into reciprocated;

  if not reciprocated then
    return null;
  end if;

  insert into public.connections (member_a, member_b)
  values (least(me, target_id), greatest(me, target_id))
  on conflict (member_a, member_b) do update set ended_at = null, ended_by = null
  returning id into connection;

  perform public.record_product_event('connection_created');

  return connection;
end;
$$;

revoke execute on function public.express_interest(uuid, public.interest_kind)
  from public, anon;
grant execute on function public.express_interest(uuid, public.interest_kind)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Defence in depth on the interest table itself
-- ---------------------------------------------------------------------------
--
-- `express_interest` is the only route a client has, so this trigger should
-- never fire. It exists because "should never fire" is a statement about the
-- code as it is today, and the cost of being wrong is a real member receiving
-- a notification from a reviewer. A BEFORE trigger also covers any future RPC
-- that writes this table without remembering the rule.

create or replace function public.member_interests_guard_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.accounts_may_meet(new.from_id, new.to_id) then
    raise exception 'unavailable';
  end if;

  return new;
end;
$$;

revoke execute on function public.member_interests_guard_kind()
  from public, anon, authenticated;

create trigger member_interests_guard_kind
  before insert or update on public.member_interests
  for each row execute function public.member_interests_guard_kind();

-- ---------------------------------------------------------------------------
-- And on messages
-- ---------------------------------------------------------------------------
--
-- A connection cannot form across kinds now, so a cross-kind message has no
-- route either. This covers the one case the above does not: a connection that
-- ALREADY existed before an account was marked as a demonstration account.
-- Marking an account is a service-role act; doing it to somebody with live
-- connections should not leave those conversations writable.

create or replace function public.messages_guard_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other uuid;
begin
  select case when c.member_a = new.sender_id then c.member_b else c.member_a end
    into other
    from public.connections c
   where c.id = new.connection_id;

  -- No connection row is not this trigger's business to refuse: the existing
  -- RLS policy on messages already requires one.
  if other is null then
    return new;
  end if;

  if not public.accounts_may_meet(new.sender_id, other) then
    raise exception 'unavailable';
  end if;

  return new;
end;
$$;

revoke execute on function public.messages_guard_kind()
  from public, anon, authenticated;

create trigger messages_guard_kind
  before insert on public.messages
  for each row execute function public.messages_guard_kind();

-- ---------------------------------------------------------------------------
-- What a moderator can see
-- ---------------------------------------------------------------------------
--
-- "Clearly identified as demonstration accounts" needs somewhere to be read
-- from. It is deliberately NOT on `member_card`: a demonstration account is
-- only ever shown to another demonstration account, so an in-product badge
-- would be a label with no audience, and adding a field to the card would
-- change a type both clients depend on for no member's benefit.
--
-- So it is answerable here, by a moderator, which is who actually needs to ask
-- "how many of these exist and are they where I think they are".

create or replace function public.account_kind_counts()
returns table (account_kind public.account_kind, profiles integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.account_kind, count(*)::integer
    from public.profiles p
   where public.is_moderator()
   group by p.account_kind
   order by p.account_kind;
$$;

revoke execute on function public.account_kind_counts() from public, anon;
grant execute on function public.account_kind_counts() to authenticated;

comment on function public.account_kind_counts() is
  'How many profiles exist of each kind. Moderator only; returns nothing to an ordinary member.';
