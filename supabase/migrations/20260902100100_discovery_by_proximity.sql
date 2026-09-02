-- Show the people nearest first.
--
-- Discovery ordered by a per-viewer daily hash: stable, unbiased, and indifferent
-- to where anybody lives. Stability is worth keeping -- it is what stops paging
-- from reshuffling and refreshing from being a slot machine -- but indifference
-- turned out to be wrong. Meeting someone is a physical act, and a member in
-- Kolkata being shown someone in Kochi before someone two streets away is not
-- neutral, it is unhelpful.
--
-- So proximity becomes the first sort key, and the hash stays as the tiebreak
-- within each band. Someone in your city is shown before someone in your state,
-- who is shown before everyone else; inside each of those groups the order is
-- still the same all day and still unrelated to anything about the person.
--
-- What this deliberately is not:
--
-- It is not a filter. Everyone still appears, and someone in a town with no
-- other members sees the whole country rather than an empty screen. The city
-- filter remains separate, optional and free.
--
-- It is not a distance calculation. The cities table carries latitude and
-- longitude, so real distance is available -- and using it would order Thane
-- before Pune for a member in Mumbai, which is correct, and would also imply a
-- precision the product does not have. Nobody's city is where they are; it is
-- where they said they live. Three bands say what can honestly be said.
--
-- A member who typed a city rather than choosing one (`other_city`) has no
-- city_id to compare, so they fall into the third band. That is the honest
-- outcome: an unmatched free-text string is not evidence of proximity.

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
  with me as (
    select
      p.id,
      p.city_id as my_city_id,
      c.state    as my_state
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
  order by
    -- Same city, then same state, then everyone else.
    case
      when me.my_city_id is not null and p.city_id = me.my_city_id then 0
      when me.my_state is not null and c.state = me.my_state then 1
      else 2
    end,
    -- Within a band: the same order all day, unrelated to anything about the
    -- person, rolling over at midnight.
    md5(p.id::text || me.id::text || current_date::text)
  offset greatest(0, coalesce(page_offset, 0))
  limit greatest(1, least(coalesce(max_results, 10), 30));
$$;

revoke execute on function
  public.discover_members(integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[])
  from public, anon;
grant execute on function
  public.discover_members(integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[])
  to authenticated;

comment on function public.discover_members(integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[]) is
  'Introductions, nearest first: same city, then same state, then everywhere else. Proximity orders and never filters -- everyone remains reachable.';

-- The state comparison is the one new predicate that touches every row.
create index if not exists cities_state_idx on public.cities (state);
