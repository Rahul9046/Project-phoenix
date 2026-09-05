-- Who someone is hoping to meet.
--
-- Discovery showed everyone to everyone. For a product whose whole purpose is
-- introducing two people, that is not a missing filter so much as a missing
-- question: nobody had ever been asked.
--
-- Stored as an array rather than a single value, because the honest answers are
-- "women", "men", "either" and sometimes "these two but not that one", and a
-- single column forces the last two into a category that does not fit. An empty
-- or absent array means no preference stated.
--
-- ---------------------------------------------------------------------------
-- It is mutual, and it is permissive where nothing was said
-- ---------------------------------------------------------------------------
-- The rule is applied in both directions: someone appears in your introductions
-- only if they match what you are looking for AND you match what they are. A
-- one-sided filter would keep showing you to people who have already said they
-- are not looking for someone like you, which wastes their time and exposes you
-- for no purpose.
--
-- Where either side has not answered, or where a gender is `prefer_not_to_say`,
-- the rule does not exclude. That is deliberate. A strict reading would make
-- every member who declined to state a gender invisible to everybody, which
-- punishes the people most likely to have thought carefully about the question.
-- Silence means "no constraint", never "no match".

alter table public.profiles
  add column seeking public.gender[];

comment on column public.profiles.seeking is
  'Genders this member hopes to meet. Null or empty means no preference. Applied mutually in discover_members, and never used to exclude when either side has not answered.';

/*
 * Does `viewer` want to see `candidate`, and vice versa?
 *
 * A function rather than repeated SQL because the same rule has to hold in
 * discovery and in anything added later that surfaces a member -- and because
 * "permissive where unstated" is exactly the kind of condition that gets
 * simplified into strictness by someone tidying up a WHERE clause.
 */
create or replace function public.genders_are_compatible(
  viewer_seeking public.gender[],
  viewer_gender public.gender,
  candidate_seeking public.gender[],
  candidate_gender public.gender
)
returns boolean
language sql
immutable
as $$
  select
    -- What the viewer is looking for, unless they said nothing, or the
    -- candidate declined to say what they are.
    (
      viewer_seeking is null
      or array_length(viewer_seeking, 1) is null
      or candidate_gender is null
      or candidate_gender = 'prefer_not_to_say'
      or candidate_gender = any (viewer_seeking)
    )
    and
    -- The same question from the other side.
    (
      candidate_seeking is null
      or array_length(candidate_seeking, 1) is null
      or viewer_gender is null
      or viewer_gender = 'prefer_not_to_say'
      or viewer_gender = any (candidate_seeking)
    );
$$;

comment on function public.genders_are_compatible is
  'Mutual gender preference. Permissive wherever either side has not answered -- silence is not a mismatch.';

-- ---------------------------------------------------------------------------
-- Discovery honours it
-- ---------------------------------------------------------------------------

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
      p.gender  as my_gender,
      p.seeking as my_seeking,
      c.state   as my_state
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

revoke execute on function
  public.discover_members(integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[])
  from public, anon;
grant execute on function
  public.discover_members(integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[])
  to authenticated;
