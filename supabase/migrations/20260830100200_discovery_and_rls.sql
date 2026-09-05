-- Discovery, and the rules for who may see whom.
--
-- `profiles` stays locked to your own row. That guarantee is not relaxed here,
-- and it is worth being explicit about why: a permissive select policy on the
-- table would expose every column, including `date_of_birth`. Eraya shows an
-- age, never a birth date, and the difference between those two matters to
-- someone deciding how much of themselves to hand over.
--
-- So discovery goes through SECURITY DEFINER functions that return a chosen set
-- of fields and nothing else. The column list below IS the privacy policy; there
-- is no second place where it could quietly widen.

alter table public.member_blocks    enable row level security;
alter table public.member_interests enable row level security;
alter table public.connections      enable row level security;
alter table public.messages         enable row level security;
alter table public.member_reports   enable row level security;

-- ---------------------------------------------------------------------------
-- Blocks: yours to create and to lift. Never readable by the person blocked.
-- ---------------------------------------------------------------------------
create policy "Members manage their own blocks"
  on public.member_blocks for all to authenticated
  using ((select auth.uid()) = blocker_id)
  with check ((select auth.uid()) = blocker_id);

-- ---------------------------------------------------------------------------
-- Interests: you may record your own and read your own outgoing decisions.
--
-- Deliberately NO policy for reading interest sent TO you. That is the premium
-- capability, and it is served by a function that checks the subscription in the
-- database. A select policy here would make the paywall a UI suggestion.
-- ---------------------------------------------------------------------------
create policy "Members record their own interest"
  on public.member_interests for insert to authenticated
  with check ((select auth.uid()) = from_id);

create policy "Members read their own decisions"
  on public.member_interests for select to authenticated
  using ((select auth.uid()) = from_id);

create policy "Members may change their mind"
  on public.member_interests for delete to authenticated
  using ((select auth.uid()) = from_id);

-- ---------------------------------------------------------------------------
-- Connections and messages: only the two people in them.
-- ---------------------------------------------------------------------------
create policy "Members read their own connections"
  on public.connections for select to authenticated
  using ((select auth.uid()) in (member_a, member_b));

create policy "Either member may end a connection"
  on public.connections for update to authenticated
  using ((select auth.uid()) in (member_a, member_b))
  with check ((select auth.uid()) in (member_a, member_b));

create policy "Members read messages in their connections"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.connections c
    where c.id = messages.connection_id
      and (select auth.uid()) in (c.member_a, c.member_b)
  ));

-- Sending requires being in the connection AND the connection still being open.
-- Ending a connection has to actually stop messages, not merely hide them.
create policy "Members send messages in their open connections"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.connections c
      where c.id = messages.connection_id
        and c.ended_at is null
        and (select auth.uid()) in (c.member_a, c.member_b)
    )
  );

-- ---------------------------------------------------------------------------
-- Reports: file your own, read nothing. Moderation is not self-service.
-- ---------------------------------------------------------------------------
create policy "Members file their own reports"
  on public.member_reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id);

-- ---------------------------------------------------------------------------
-- The shape a member is seen in.
--
-- Age, not date of birth. City name, not city id. Verification as booleans the
-- product can actually stand behind.
-- ---------------------------------------------------------------------------
create type public.member_card as (
  id uuid,
  first_name text,
  age integer,
  city text,
  state text,
  relationship_status public.relationship_status,
  gender public.gender,
  languages text[],
  phone_verified boolean,
  email_verified boolean
);

-- ---------------------------------------------------------------------------
-- Everyone this member could be shown, in a deterministic order.
--
-- Excluded: themselves, anyone either of them has blocked, anyone they have
-- already decided about, and anyone who has not finished onboarding. Someone
-- half-registered is not a person to be introduced to.
-- ---------------------------------------------------------------------------
create or replace function public.discover_members(max_results integer default 3)
returns setof public.member_card
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id)
  select
    p.id,
    p.first_name,
    date_part('year', age(p.date_of_birth))::integer as age,
    coalesce(c.name, p.other_city) as city,
    c.state,
    p.relationship_status,
    p.gender,
    coalesce(
      (select array_agg(l.name order by l.name)
         from public.profile_languages pl
         join public.languages l on l.id = pl.language_id
        where pl.profile_id = p.id),
      '{}'::text[]
    ) as languages,
    p.phone_verified_at is not null as phone_verified,
    u.email_confirmed_at is not null as email_verified
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.cities c on c.id = p.city_id, me
  where p.onboarding_stage = 'onboarding_completed'
    and p.id <> me.id
    and p.first_name is not null
    and p.date_of_birth is not null
    and not exists (
      select 1 from public.member_blocks b
      where (b.blocker_id = me.id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = me.id)
    )
    and not exists (
      select 1 from public.member_interests i
      where i.from_id = me.id and i.to_id = p.id
    )
  -- Stable per viewer per day: the same few people all day rather than a
  -- different set on every refresh. Refreshing is how a considered few turns
  -- back into a feed.
  order by md5(p.id::text || me.id::text || current_date::text)
  limit greatest(1, least(coalesce(max_results, 3), 20));
$$;

comment on function public.discover_members(integer) is
  'A considered few. Deterministic per viewer per day so refreshing does not deal a new hand.';

-- ---------------------------------------------------------------------------
-- One member, for the profile screen. Same field set, same exclusions.
-- ---------------------------------------------------------------------------
create or replace function public.member_profile(member_id uuid)
returns setof public.member_card
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id)
  select
    p.id,
    p.first_name,
    date_part('year', age(p.date_of_birth))::integer as age,
    coalesce(c.name, p.other_city) as city,
    c.state,
    p.relationship_status,
    p.gender,
    coalesce(
      (select array_agg(l.name order by l.name)
         from public.profile_languages pl
         join public.languages l on l.id = pl.language_id
        where pl.profile_id = p.id),
      '{}'::text[]
    ) as languages,
    p.phone_verified_at is not null as phone_verified,
    u.email_confirmed_at is not null as email_verified
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.cities c on c.id = p.city_id, me
  where p.id = member_id
    and p.onboarding_stage = 'onboarding_completed'
    and not exists (
      select 1 from public.member_blocks b
      where (b.blocker_id = me.id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = me.id)
    );
$$;

-- ---------------------------------------------------------------------------
-- Expressing interest, and the connection it may create.
--
-- One function rather than an insert plus a check, because "did they already
-- like me" and "create the connection" have to be one atomic step. Two calls
-- racing each other produce either two connections or none.
-- ---------------------------------------------------------------------------
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

  -- A block in either direction ends this before anything is written.
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

  return connection;
end;
$$;

comment on function public.express_interest(uuid, public.interest_kind) is
  'Records a decision and opens a connection when it is mutual. Atomic, so a race cannot create two.';

-- ---------------------------------------------------------------------------
-- Who expressed interest in you. Premium, enforced here rather than in the UI.
--
-- The subscription is checked in the database, so this cannot be unlocked by
-- calling the API directly. That is the difference between a paid feature and a
-- hidden div.
-- ---------------------------------------------------------------------------
create or replace function public.interests_received()
returns setof public.member_card
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  premium boolean;
begin
  select exists (
    select 1
    from public.subscriptions s
    join public.membership_plans mp on mp.id = s.plan_id
    where s.profile_id = me
      and mp.tier = 'premium'
      and s.status in ('trialing', 'active', 'past_due', 'cancelled')
  ) into premium;

  if not premium then
    return;
  end if;

  return query
  select c.*
  from public.member_interests i
  cross join lateral public.member_profile(i.from_id) c
  where i.to_id = me
    and i.kind = 'interested'
    and not exists (
      select 1 from public.member_interests mine
      where mine.from_id = me and mine.to_id = i.from_id
    );
end;
$$;

-- Nothing in `public` should be callable by `anon` unless it needs to be. These
-- all read member data and require a session.
revoke execute on function public.discover_members(integer) from public, anon;
revoke execute on function public.member_profile(uuid) from public, anon;
revoke execute on function public.express_interest(uuid, public.interest_kind) from public, anon;
revoke execute on function public.interests_received() from public, anon;

grant execute on function public.discover_members(integer) to authenticated;
grant execute on function public.member_profile(uuid) to authenticated;
grant execute on function public.express_interest(uuid, public.interest_kind) to authenticated;
grant execute on function public.interests_received() to authenticated;
