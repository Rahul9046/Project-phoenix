-- Discovery that can actually be browsed.
--
-- The first version returned three people, ordered by a per-viewer daily hash,
-- with no filters and no way to ask for more. That was the right shape for
-- "considered introductions" and the wrong shape for a product someone opens
-- every day: after the third card there was nothing to do, and no way to say
-- "people in my city" or "people who speak Bengali".
--
-- This keeps the model and removes the dead end. Filters are free -- age, city,
-- language, chapter -- and results are paged rather than endless, so someone can
-- explore deliberately without the screen turning into a feed to be thumbed
-- through. There is still no swiping, no infinite scroll and no ranking by
-- attractiveness; a page is a page, and it runs out.
--
-- The card gains the two profile fields and a photo. Everything else about the
-- privacy boundary is unchanged: date of birth never leaves the server, email
-- and phone are not on the card at all, and the whole surface is still these
-- four functions.

-- ---------------------------------------------------------------------------
-- The card
-- ---------------------------------------------------------------------------
--
-- Dropped and recreated rather than altered: three functions return `setof
-- member_card`, and Postgres will not let the type change underneath them.
-- Recreating all four below is the honest way to do it, and it makes this
-- migration the single place the shape of a member is defined.

drop function if exists public.discover_members(integer);
drop function if exists public.member_profile(uuid);
drop function if exists public.interests_received();
drop type if exists public.member_card;

create type public.member_card as (
  id uuid,
  first_name text,
  age integer,
  city text,
  state text,
  relationship_status public.relationship_status,
  gender public.gender,
  languages text[],
  about text,
  looking_for text,
  -- The object path of their first photo, or null. The client turns this into a
  -- short-lived signed URL; the bucket is private, so a path on its own is not
  -- a readable image outside the app.
  photo_path text,
  photo_count integer,
  phone_verified boolean,
  email_verified boolean
);

comment on type public.member_card is
  'Everything one member may learn about another. This type IS the privacy boundary -- adding a field here exposes it to every member.';

-- ---------------------------------------------------------------------------
-- One member
-- ---------------------------------------------------------------------------

create or replace function public.member_profile(target_id uuid)
returns public.member_card
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
    p.phone_verified_at is not null,
    u.email_confirmed_at is not null
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.cities c on c.id = p.city_id
  where p.id = target_id
    and p.onboarding_stage = 'onboarding_completed'
    -- A block hides both people from each other, in both directions, including
    -- by direct link. Someone who has been blocked must not be able to keep
    -- opening the profile from a bookmark.
    and not exists (
      select 1 from public.member_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    );
$$;

-- ---------------------------------------------------------------------------
-- Introductions
-- ---------------------------------------------------------------------------
--
-- Every filter is optional and every one of them is free. Paywalling "people in
-- my city" would make the free product deliberately worse rather than the paid
-- product better, and that is the kind of decision this codebase should make
-- hard to take by accident -- so none of these consult the entitlements table.

create or replace function public.discover_members(
  max_results integer default 10,
  page_offset integer default 0,
  min_age integer default null,
  max_age integer default null,
  city_ids uuid[] default null,
  language_ids uuid[] default null,
  relationship_statuses public.relationship_status[] default null
)
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
    p.phone_verified_at is not null,
    u.email_confirmed_at is not null
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
    -- Someone already decided on does not come back. This is what makes the
    -- collection finite instead of a carousel.
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
    and (language_ids is null or array_length(language_ids, 1) is null
         or exists (
           select 1 from public.profile_languages pl
           where pl.profile_id = p.id and pl.language_id = any (language_ids)
         ))
  -- Stable per viewer per day: the same people in the same order all day, so
  -- paging back and forth does not reshuffle, and refreshing is not a slot
  -- machine. It rolls over at midnight, which is the whole of the novelty.
  order by md5(p.id::text || me.id::text || current_date::text)
  offset greatest(0, coalesce(page_offset, 0))
  limit greatest(1, least(coalesce(max_results, 10), 30));
$$;

-- ---------------------------------------------------------------------------
-- Who expressed interest in you
-- ---------------------------------------------------------------------------
--
-- Premium, and checked here rather than in either client. A free member's app
-- shows the real, honest thing -- that this is what premium is for -- and no
-- blurred silhouettes or invented counts, because a fabricated "7 people like
-- you" is a lie told to sell a subscription.

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
    and c.id is not null
    -- Only people you have not yet decided on. Once you have, they are either a
    -- connection or a pass, and neither belongs in a list of pending interest.
    and not exists (
      select 1 from public.member_interests mine
      where mine.from_id = me and mine.to_id = i.from_id
    )
  order by i.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- How many are waiting
-- ---------------------------------------------------------------------------
--
-- A count, available to everyone, because it is true. A free member is told the
-- real number of people who have expressed interest and that seeing who they are
-- is part of premium. That is an honest reason to upgrade; a made-up number is
-- not, and a hidden one just makes the free product feel broken.

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

-- A ledger, so the allowance can be counted without inspecting deletions.
create table public.member_reverts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reverted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index member_reverts_daily_idx
  on public.member_reverts (profile_id, created_at desc);

alter table public.member_reverts enable row level security;

-- Written only by `revert_last_pass`, which runs as definer. No client policy
-- for insert: a client that could write this row could grant itself reverts.
create policy "Members read their own reverts"
  on public.member_reverts for select to authenticated
  using ((select auth.uid()) = profile_id);

-- ---------------------------------------------------------------------------
-- Changing your mind
-- ---------------------------------------------------------------------------
--
-- Undoing the last decision. People tap the wrong thing, and on a phone they do
-- it often; without this, one mis-tap permanently removes someone from your
-- introductions with no way back.
--
-- Only a pass can be reverted, and only the most recent one. Reverting an
-- expressed interest is a different thing entirely -- the other person may
-- already have seen it, and a connection may already exist -- and quietly
-- withdrawing it would be a worse experience for them than a clear block.
--
-- The limit comes from the entitlements table, read here rather than in the
-- client, so premium's "more reverts" is enforced where it cannot be edited.
-- Note what it is not: there is no timer, no "reverts refresh in 4 hours", and
-- no purchasable pack. A finite allowance that resets daily is a guard against
-- thoughtless tapping; a countdown would be manufactured scarcity.

create or replace function public.revert_last_pass()
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  allowance integer;
  used_today integer;
  target uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  select coalesce(max((e.value)::integer), 3)
    into allowance
  from public.entitlements e
  where e.key = 'revertLimit'
    and e.tier = (
      select case when exists (
        select 1 from public.subscriptions s
        join public.membership_plans mp on mp.id = s.plan_id
        where s.profile_id = me
          and mp.tier = 'premium'
          and s.status in ('trialing', 'active', 'past_due', 'cancelled')
      ) then 'premium'::public.membership_tier else 'free'::public.membership_tier end
    );

  select count(*)::integer into used_today
  from public.member_reverts r
  where r.profile_id = me
    and r.created_at >= date_trunc('day', now());

  if used_today >= allowance then
    return null;
  end if;

  -- The most recent pass, and only a pass.
  select i.to_id into target
  from public.member_interests i
  where i.from_id = me
    and i.kind = 'passed'
  order by i.created_at desc
  limit 1;

  if target is null then
    return null;
  end if;

  delete from public.member_interests
   where from_id = me and to_id = target;

  insert into public.member_reverts (profile_id, reverted_id)
  values (me, target);

  return target;
end;
$$;

/** How many reverts are left today, for the client to show honestly. */
create or replace function public.reverts_remaining()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0,
    coalesce((
      select max((e.value)::integer) from public.entitlements e
      where e.key = 'revertLimit'
        and e.tier = (
          select case when exists (
            select 1 from public.subscriptions s
            join public.membership_plans mp on mp.id = s.plan_id
            where s.profile_id = auth.uid()
              and mp.tier = 'premium'
              and s.status in ('trialing', 'active', 'past_due', 'cancelled')
          ) then 'premium'::public.membership_tier else 'free'::public.membership_tier end
        )
    ), 3)
    - (
      select count(*)::integer from public.member_reverts r
      where r.profile_id = auth.uid()
        and r.created_at >= date_trunc('day', now())
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- Revoked from `anon` on every one of them. None of this is public data, and a
-- function that is executable by an unauthenticated caller is a data leak
-- waiting for someone to notice the endpoint.

revoke execute on function public.member_profile(uuid) from anon;
revoke execute on function public.discover_members(integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[]) from anon;
revoke execute on function public.interests_received() from anon;
revoke execute on function public.interests_received_count() from anon;
revoke execute on function public.revert_last_pass() from anon;
revoke execute on function public.reverts_remaining() from anon;

grant execute on function public.member_profile(uuid) to authenticated;
grant execute on function public.discover_members(integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[]) to authenticated;
grant execute on function public.interests_received() to authenticated;
grant execute on function public.interests_received_count() to authenticated;
grant execute on function public.revert_last_pass() to authenticated;
grant execute on function public.reverts_remaining() to authenticated;
