-- Put `member_profile` back to the signature its callers already use.
--
-- The previous migration rewrote it as `member_profile(target_id uuid) returns
-- member_card`. Both halves of that were a mistake. The web app calls it as
-- `member_profile(member_id => ...)` and reads the result as a set, and PostgREST
-- dispatches on argument *name*, so the rename alone would have turned every
-- profile view on the web into a 404 -- a mobile migration breaking the shipped
-- product, which is precisely what a shared backend must never do.
--
-- The lesson is worth writing down: the function signature is a public contract
-- between two clients. Adding a column to the returned type is compatible and
-- fine; renaming a parameter or changing the cardinality is not, whatever the
-- new name would have read like.
--
-- Body unchanged from the version above -- same columns, same block checks.

drop function if exists public.member_profile(uuid);

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
    p.phone_verified_at is not null,
    u.email_confirmed_at is not null
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.cities c on c.id = p.city_id
  where p.id = member_id
    and p.onboarding_stage = 'onboarding_completed'
    and not exists (
      select 1 from public.member_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    );
$$;

revoke execute on function public.member_profile(uuid) from public, anon;
grant execute on function public.member_profile(uuid) to authenticated;

-- Both dependants were dropped with the function above.

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
    )
  order by i.created_at desc;
end;
$$;

revoke execute on function public.interests_received() from public, anon;
grant execute on function public.interests_received() to authenticated;

create or replace function public.my_conversations()
returns setof public.conversation_row
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id),
  mine as (
    select
      c.id,
      case when c.member_a = me.id then c.member_b else c.member_a end as other_id,
      case when c.member_a = me.id then c.member_a_read_at else c.member_b_read_at end as my_read_at,
      c.ended_at,
      c.ended_by = me.id as ended_by_me
    from public.connections c, me
    where me.id in (c.member_a, c.member_b)
  ),
  latest as (
    select distinct on (m.connection_id)
      m.connection_id, m.body, m.created_at, m.sender_id
    from public.messages m
    join mine on mine.id = m.connection_id
    order by m.connection_id, m.created_at desc
  )
  select
    mine.id,
    card,
    latest.body,
    latest.created_at,
    latest.sender_id = me.id,
    coalesce(
      latest.sender_id <> me.id
        and (mine.my_read_at is null or latest.created_at > mine.my_read_at),
      false
    ),
    mine.ended_at,
    coalesce(mine.ended_by_me, false)
  from mine
  cross join me
  -- A lateral over a set-returning function drops rows where it returns nothing,
  -- which is what silently removes a blocked person's conversation from the
  -- inbox without a separate check.
  cross join lateral public.member_profile(mine.other_id) as card
  left join latest on latest.connection_id = mine.id
  order by coalesce(latest.created_at, mine.ended_at, now()) desc;
$$;

revoke execute on function public.my_conversations() from anon;
grant execute on function public.my_conversations() to authenticated;

create or replace function public.home_summary()
returns table (
  introductions integer,
  new_connections integer,
  unread_conversations integer,
  interests_received integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer from public.discover_members(10, 0)),
    (select count(*)::integer from public.my_conversations() c
      where c.last_message_at is null and c.ended_at is null),
    (select count(*)::integer from public.my_conversations() c where c.unread),
    (select public.interests_received_count());
$$;

revoke execute on function public.home_summary() from anon;
grant execute on function public.home_summary() to authenticated;
