-- Keeping fabricated profiles away from real members, in the database.
--
-- WHY THIS FILE EXISTS WHEN 20261128100100 ALREADY SAID ALL THIS
--
-- `20261128100100_demonstration_accounts.sql` designed this boundary and got
-- the design right. It could not be deployed, for a reason that is only
-- visible when you try: it re-declares `discover_members` in full, and the
-- version it re-declares calls `public.visible_photo_path(uuid)` and
-- `public.visible_photo_count(uuid)` -- two functions created by
-- `20261127100100_content_moderation.sql` and by nothing else.
--
-- Production has not applied the moderation migration, so applying the
-- demonstration one alone fails outright:
--
--     ERROR:  function public.visible_photo_path(uuid) does not exist
--     LINE 47:     public.visible_photo_path(p.id),
--
-- Measured, not supposed: the statement was run against a local stack with
-- those two functions dropped, inside a transaction that was rolled back.
--
-- That left a choice between applying content moderation -- which needs a
-- staffed photograph queue before it is switched on, and so is deliberately
-- deferred -- and isolating demonstration accounts. Those must not be the same
-- decision. So this file supersedes `20261128100100`, which is deleted in the
-- same change: it carries that design forward against the schema production
-- actually has, and it can be applied on its own today.
--
-- Its timestamp sits between the newest applied migration (`20261126100100`)
-- and the deferred moderation one (`20261127100100`) on purpose. Applied now
-- it is contiguous, and moderation still applies cleanly afterwards without
-- the out-of-order refusal that a later timestamp would have caused.
-- `20261127100100` is amended in the same change so that landing it later
-- cannot quietly undo any of this.
--
-- THE RULE, IN ONE LINE
--
-- An account meets only accounts of its own kind. Demonstration accounts see
-- and are seen by demonstration accounts; members see and are seen by members.
-- Symmetric, total, and enforced in the database.
--
-- WHAT THIS ADDS BEYOND THE ORIGINAL DESIGN
--
-- The original closed every surface that CREATES something -- discovery, the
-- profile, interest, messages. It did not close the surfaces that READ what
-- already exists, and marking an account is something done to an account that
-- has a history. Four holes were found by asking, for each table, "what does a
-- hand-written request get?":
--
--   `public.messages`      SELECT needed only membership of the connection, so
--                          an entire past conversation stayed readable in both
--                          directions after conversion.
--   `public.connections`   SELECT needed only membership, so the row -- and the
--                          other party's id -- stayed readable.
--   `public.member_interests` SELECT needed only `from_id = me`, so outgoing
--                          interests stayed enumerable.
--   `storage.objects`      SELECT allowed any signed-in member to read any
--                          object in `profile-photos` unless blocked. A path
--                          was enough. This is the one that mattered most:
--                          photographs are the thing an App Review account
--                          must never be able to fetch from a real member.
--
-- And one inconsistency: `interests_received_count` counted interests the
-- premium list would refuse to show, so after conversion a member would have
-- been told "1 person is interested in you" above an empty list.
--
-- WHAT THIS DELIBERATELY IS NOT
--
--   Not a privilege. A demonstration account is an ordinary member in every
--   other respect: same sign-in, same RLS, same entitlements, no moderator
--   rights, no bypass of any kind. It can see LESS than a member, never more.
--
--   Not a deletion. Nothing here removes a profile, a photograph, an interest,
--   a message, a subscription or a payment. Records that become unreachable
--   through member-facing surfaces are still there, and still reachable by the
--   service role and by a moderator.
--
--   Not a UI filter. Both clients already drop a connection whose other party
--   will not load, so the member-facing experience is handled -- but that is
--   the client being well written, not a boundary. Everything below holds
--   against a hand-written request with a valid token.
--
--   Not a back door for sign-in. Nothing here creates an account, sets a
--   password, fixes an OTP or weakens authentication.
--
-- ❗ PRODUCTION IS UNCHANGED BY APPLYING THIS. The column defaults to 'member'
-- and every existing row takes the default, so every account that exists today
-- may meet every other account exactly as it could before. The feature does
-- nothing until somebody is deliberately marked as a demonstration account,
-- which is a service-role act and not part of this file.
--
-- ❗ ONE WINDOW THIS CANNOT CLOSE. A signed photograph URL is a self-contained
-- token checked by the storage service without re-consulting these policies,
-- and both clients sign for 3600 seconds. A URL issued in the hour before an
-- account is converted goes on resolving until it expires. See
-- `docs/19-demonstration-isolation.md`.

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
  'Whether an account belongs to a real person or exists for demonstration. Accounts of different kinds cannot discover, contact, read or notify one another.';

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
-- The privilege is not granted, AND a trigger refuses it anyway. Either alone
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
-- Not granted to any client role. It takes two arbitrary ids and answers about
-- other people, so exposing it would let anybody classify the whole population.

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
  'True when two accounts are of the same kind and may therefore see and contact each other. Fails closed when either profile is missing. Not granted to clients: it classifies arbitrary ids.';

-- ---------------------------------------------------------------------------
-- The same question, but only ever about the caller
-- ---------------------------------------------------------------------------
--
-- Row-level security expressions are evaluated as the querying role, so a
-- policy may only call a function that role can EXECUTE. `accounts_may_meet`
-- is deliberately not that function. This is: one argument, the other side,
-- with the caller's own id supplied from `auth.uid()` rather than passed in.
--
-- ❗ It must be a `security definer` function and NOT an inline subquery. The
-- predicate has to read `profiles.account_kind` for somebody who is not the
-- caller, and `profiles`' own row-level security allows a member to read only
-- their own row. Inline, the comparison would be null for every other account
-- and the policies below would hide every photograph and every conversation in
-- the product. `20261127100100` records the same trap costing the same mistake.
--
-- What granting this gives away, stated rather than glossed: for an id the
-- caller already holds, whether that account is of the caller's own kind. It
-- discloses no profile content, and the alternative -- a policy that cannot
-- read the column -- is not a safer boundary but a broken product.

create or replace function public.may_meet(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.accounts_may_meet(auth.uid(), other);
$$;

revoke execute on function public.may_meet(uuid) from public, anon;
grant execute on function public.may_meet(uuid) to authenticated;

comment on function public.may_meet(uuid) is
  'True when the calling account and the given account are of the same kind. Caller-relative on purpose, so it cannot be used to classify the population.';

-- ---------------------------------------------------------------------------
-- Discovery
-- ---------------------------------------------------------------------------
--
-- Re-declared in full rather than patched, because a reader needs to see the
-- whole predicate. This is production's current body -- the one from
-- `20260922120100_religion.sql`, which reads photographs through inline
-- subqueries because `visible_photo_path` does not exist yet -- with ONE new
-- condition, marked below.

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
    (select ph.storage_path from public.profile_photos ph
      where ph.profile_id = p.id order by ph.position limit 1),
    (select count(*)::integer from public.profile_photos ph where ph.profile_id = p.id),
    public.phone_is_verified(p.phone_verified_at, p.phone_verified_via),
    u.email_confirmed_at is not null,
    public.disclosed_religion(p.religion)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.cities c on c.id = p.city_id, me
  where p.onboarding_stage = 'onboarding_completed'
    and p.id <> me.id
    -- ⬇ THE ONLY NEW CONDITION. A demonstration account sees demonstration
    -- accounts; a member sees members. Both directions, from one predicate,
    -- applied before LIMIT so paging stays correct.
    and p.account_kind = me.my_kind
    and p.first_name is not null
    and p.date_of_birth is not null
    -- A suspended member sees nobody.
    and not me.suspended
    -- ...and is shown to nobody.
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
    and (min_age is null
         or date_part('year', age(p.date_of_birth))::integer >= min_age)
    and (max_age is null
         or date_part('year', age(p.date_of_birth))::integer <= max_age)
    and (city_ids is null or array_length(city_ids, 1) is null
         or p.city_id = any (city_ids))
    and (relationship_statuses is null or array_length(relationship_statuses, 1) is null
         or p.relationship_status = any (relationship_statuses))
    /*
     * Matched on the *disclosed* value, so a member who has not answered and a
     * member who chose not to say are both absent from every specific religion
     * filter. That is the whole reason the comparison is not `p.religion`
     * directly: with the raw column, asking for 'prefer_not_to_say' would
     * return the people who declined -- turning a filter into a way of finding
     * exactly the members who asked not to be found this way.
     */
    and (religions is null or array_length(religions, 1) is null
         or public.disclosed_religion(p.religion) = any (religions))
    and (language_ids is null or array_length(language_ids, 1) is null
         or exists (
           select 1 from public.profile_languages pl
           where pl.profile_id = p.id and pl.language_id = any (language_ids)
         ))
  order by
    case
      when me.my_city_id is not null and p.city_id = me.my_city_id then 0
      when me.my_state is not null and c.state = me.my_state then 1
      else 2
    end,
    md5(p.id::text || me.id::text || current_date::text)
  offset greatest(0, coalesce(page_offset, 0))
  limit greatest(1, least(coalesce(max_results, 10), 30));
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
--
-- This is also the function that makes the member-facing experience correct
-- without a line of client code. `interests_received`, `my_conversations` and
-- `member_photos` all reach a profile through `cross join lateral` or `exists`
-- over this function, and a lateral over a set-returning function that returns
-- nothing drops the row -- which is what already removes a blocked person's
-- conversation from the inbox. Both clients, independently, also drop a
-- connection whose other party will not load.

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
    (select ph.storage_path from public.profile_photos ph
      where ph.profile_id = p.id order by ph.position limit 1),
    (select count(*)::integer from public.profile_photos ph where ph.profile_id = p.id),
    public.phone_is_verified(p.phone_verified_at, p.phone_verified_via),
    u.email_confirmed_at is not null,
    public.disclosed_religion(p.religion)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.cities c on c.id = p.city_id
  where p.id = member_id
    and p.onboarding_stage = 'onboarding_completed'
    -- ⬇ NEW. Same rule as discovery, on the surface a crafted request uses.
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

  -- ⬇ NEW, and before anything is written. A cross-kind interest must not
  -- leave a row behind even if a later step would have failed anyway.
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
-- that writes this table without remembering the rule -- and it is what makes
-- the conversion itself safe against a concurrent `express_interest` that
-- passed its check a moment before the kind changed.

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
-- And on connections
-- ---------------------------------------------------------------------------
--
-- The row `express_interest` writes when two interests meet. A connection
-- cannot form across kinds through that function now, but this is the table
-- whose existence permits a message and raises a badge, so it refuses for
-- itself. It also closes the race the conversion has to survive: two
-- reciprocal interests already in flight when an account is converted.
--
-- INSERT and UPDATE both, because `express_interest` revives an ended
-- connection with `on conflict ... do update set ended_at = null`, and a
-- revival across kinds is a new connection by another name.

create or replace function public.connections_guard_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.accounts_may_meet(new.member_a, new.member_b) then
    raise exception 'unavailable';
  end if;

  return new;
end;
$$;

revoke execute on function public.connections_guard_kind()
  from public, anon, authenticated;

create trigger connections_guard_kind
  before insert or update on public.connections
  for each row execute function public.connections_guard_kind();

-- ---------------------------------------------------------------------------
-- And on messages
-- ---------------------------------------------------------------------------
--
-- This covers the one case the above do not: a connection that ALREADY existed
-- before an account was marked as a demonstration account. Marking an account
-- is a service-role act; doing it to somebody with live connections must not
-- leave those conversations writable.

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
-- Reading what already exists: the conversation
-- ---------------------------------------------------------------------------
--
-- Writing was closed above. Reading was not, and marking an account is
-- something done to an account that already has a history.
--
-- The policy being replaced required only membership of the connection, so a
-- past conversation stayed fully readable in BOTH directions -- the real
-- member could read it back, and, worse, the converted account could read
-- every message a real person had sent it. The records are kept; only the
-- member-facing route to them closes. The service role is unaffected (it
-- bypasses row-level security), so moderation, support and any legally
-- necessary retrieval are untouched.

drop policy if exists "Members read messages in their connections" on public.messages;

create policy "Members read messages in their connections"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.connections c
    where c.id = messages.connection_id
      and (select auth.uid()) in (c.member_a, c.member_b)
      -- The other party, whoever they are in this row.
      and public.may_meet(
            case when c.member_a = (select auth.uid()) then c.member_b else c.member_a end)
  ));

-- The INSERT policy is left exactly as it was. `messages_guard_kind` already
-- refuses a cross-kind send, and a BEFORE trigger is the better place for it:
-- it covers the service role and every future writer, which a policy does not.

-- ---------------------------------------------------------------------------
-- ...and the connection row itself
-- ---------------------------------------------------------------------------
--
-- Both clients fetch connection rows and then resolve the other party through
-- `member_profile`, dropping any row that will not resolve -- so the lists are
-- already right. This is for the request that does not bother with the second
-- step: without it, `GET /rest/v1/connections` still hands back the row, its
-- timestamps and the other account's id.

drop policy if exists "Members read their own connections" on public.connections;

create policy "Members read their own connections"
  on public.connections for select to authenticated
  using (
    (select auth.uid()) in (member_a, member_b)
    and public.may_meet(
          case when member_a = (select auth.uid()) then member_b else member_a end)
  );

-- Ending a connection stays open to either member whatever the kinds are. A
-- member who wants out of a conversation that has become unreachable should
-- not be refused, and `ended_at` is not somebody else's information.
--
-- ❗ The UPDATE policy is deliberately NOT narrowed, but `connections_guard_kind`
-- fires on UPDATE, so an update must still leave the pair same-kind. Ending a
-- cross-kind connection would therefore be refused by the trigger. That is
-- accepted: the row is already invisible to both sides, so there is nothing to
-- end from either member's point of view, and the alternative is a trigger with
-- a hole in it.

-- ---------------------------------------------------------------------------
-- ...and the interests
-- ---------------------------------------------------------------------------
--
-- `from_id = me` was the whole test, so a member could enumerate every account
-- they had ever swiped on, converted or not. No client reads this table
-- directly -- both go through `express_interest` and the RPCs -- so narrowing
-- it costs nothing a member can see.

drop policy if exists "Members read their own decisions" on public.member_interests;

create policy "Members read their own decisions"
  on public.member_interests for select to authenticated
  using (
    (select auth.uid()) = from_id
    and public.may_meet(to_id)
  );

-- DELETE is left alone. `revert_last_pass` is `security definer` and does the
-- deleting, and a member withdrawing their own row harms nobody.

-- ---------------------------------------------------------------------------
-- ...and the photographs, which is the one that matters most
-- ---------------------------------------------------------------------------
--
-- The policy being replaced let any signed-in member read ANY object in
-- `profile-photos` whose owner had not blocked them. A path was enough. That
-- was tolerable when every account was a real person who had chosen to be in
-- discovery; it is not tolerable the moment one population must not be able to
-- fetch the other's photographs, which is the entire point of an App Review
-- account.
--
-- Three ways to be allowed, and no fourth:
--
--   your own folder   -- you must be able to see your own photographs
--   a moderator       -- reviewing a report means looking at what was reported
--   same kind, and not blocked in either direction
--
-- The policy name is kept EXACTLY as it was, so that
-- `20261127100100_content_moderation.sql` -- which drops this name and creates
-- its own -- still replaces it cleanly rather than leaving two permissive
-- policies that OR together and re-open the hole. That migration is amended in
-- the same change to carry the `may_meet` condition forward.

drop policy if exists "Members read photos of people they may see" on storage.objects;

create policy "Members read photos of people they may see"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      -- Your own, whatever state it is in.
      (storage.foldername(name))[1] = (select auth.uid())::text

      -- A moderator, so a report can be worked.
      or public.is_moderator()

      or (
        -- ⬇ NEW. Through a `security definer` function, never an inline
        -- subquery -- `profiles` row-level security would make the comparison
        -- null for everybody but the caller and hide every photograph in the
        -- product.
        public.may_meet(((storage.foldername(name))[1])::uuid)
        and not exists (
          select 1 from public.member_blocks b
          where (
            b.blocker_id = (select auth.uid())
            and b.blocked_id::text = (storage.foldername(name))[1]
          ) or (
            b.blocked_id = (select auth.uid())
            and b.blocker_id::text = (storage.foldername(name))[1]
          )
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- The count that would otherwise disagree with the list
-- ---------------------------------------------------------------------------
--
-- `interests_received` reaches each sender through `member_profile`, so it is
-- already right: a converted sender's row is dropped by the lateral. The count
-- beside it joined `profiles` directly, so after a conversion a member would
-- have been shown "1 person is interested in you" above an empty list -- and
-- a number that moves when a fabricated account is retired is itself a signal
-- about that account.

create or replace function public.interests_received_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.member_interests i
  join public.profiles p on p.id = i.from_id
  where i.to_id = auth.uid()
    and i.kind = 'interested'
    and p.onboarding_stage = 'onboarding_completed'
    -- ⬇ NEW, and the same authority discovery and the list use.
    and public.accounts_may_meet(auth.uid(), i.from_id)
    -- A suspended member is shown nobody, so they are shown no count of
    -- nobody either.
    and not exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.suspended_at is not null
    )
    -- And a suspended member is counted by nobody.
    and p.suspended_at is null
    and not exists (
      select 1 from public.member_interests mine
      where mine.from_id = auth.uid() and mine.to_id = i.from_id
    )
    and not exists (
      select 1 from public.member_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = i.from_id)
         or (b.blocker_id = i.from_id and b.blocked_id = auth.uid())
    );
$$;

revoke execute on function public.interests_received_count() from public, anon;
grant execute on function public.interests_received_count() to authenticated;

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
