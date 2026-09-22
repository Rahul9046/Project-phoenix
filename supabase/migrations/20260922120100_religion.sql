-- Religion, as profile context.
--
-- Eraya's members are Indian adults beginning again, and for many of them
-- religion is part of who they are and part of who they would find it easy to
-- be with. Asking is right. What matters is the shape of the asking, and three
-- decisions define it.
--
-- **Declining is a first-class answer.** `prefer_not_to_say` is in the enum,
-- exactly as it is for gender, rather than being a second boolean beside it.
-- Somebody who does not want to say has answered the question, and the product
-- must be able to tell that apart from somebody who has not been asked yet --
-- which is what null is for, and what every existing member will have.
--
-- **Nothing is inferred, ever.** Not from a name, a city, a language or
-- anything else. Only an explicit choice is stored. That is not merely a
-- privacy nicety in this country: a guess at somebody's religion from their
-- name is the same guess that is used to discriminate against them, and a
-- product that made it would be doing that work for whoever asked next.
--
-- **And this is context, not a credential.** There is no caste, no community,
-- no sub-caste, no gotra, no horoscope and no denomination here, and none of
-- those are coming. That list is what separates Eraya from a biodata form, and
-- the absence is the product.

create type public.religion as enum (
  'hindu',
  'muslim',
  'christian',
  'sikh',
  'buddhist',
  'jain',
  'other',
  -- An answer, not the absence of one. Null is the absence of one.
  'prefer_not_to_say'
);

comment on type public.religion is
  'A member''s own statement about themselves. Never inferred from a name, a place or a language. prefer_not_to_say is a choice; null means the question has not been answered.';

alter table public.profiles
  add column if not exists religion public.religion;

comment on column public.profiles.religion is
  'Explicitly chosen by the member, or null if never answered. Existing profiles keep null -- nothing here invents one. Only a disclosed value ever leaves this table; see disclosed_religion().';

-- ---------------------------------------------------------------------------
-- What another member is allowed to learn
-- ---------------------------------------------------------------------------
--
-- Two states mean "you do not get to know this": never answered, and answered
-- with "prefer not to say". They are different facts about the member and the
-- same fact about the reader, so the boundary collapses them into null rather
-- than handing both across and trusting each client to render one of them as
-- nothing.
--
-- Doing it here rather than in the UI is the point. A client that receives
-- `prefer_not_to_say` can display it by mistake -- and "Religion: Prefer not to
-- say" is worse than silence, because it advertises that the question was asked
-- and draws attention to the one member who declined. A client that never
-- receives it cannot make that mistake.

create or replace function public.disclosed_religion(p_religion public.religion)
returns public.religion
language sql
immutable
parallel safe
as $$
  select case
    when p_religion is null then null
    when p_religion = 'prefer_not_to_say' then null
    else p_religion
  end;
$$;

comment on function public.disclosed_religion(public.religion) is
  'The religion another member may see, or null. Collapses "not answered" and "prefer not to say" into the same silence.';

revoke execute on function public.disclosed_religion(public.religion)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The card gains a field
-- ---------------------------------------------------------------------------
--
-- Adding an attribute to the returned type is the compatible kind of change --
-- the lesson written down in 20260830160600 was that renaming a parameter or
-- changing the cardinality is not, and this does neither. Every function that
-- merely passes a card through (interests_received, my_conversations,
-- home_summary) keeps working untouched; the two that build one are redefined
-- below because they now have a column to fill.

alter type public.member_card add attribute religion public.religion cascade;

-- From 20260922100100, plus the new column.
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
    -- Null unless they said, and null if they said they would rather not.
    public.disclosed_religion(p.religion)
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

-- ---------------------------------------------------------------------------
-- Discovery, with religion as a filter
-- ---------------------------------------------------------------------------
--
-- Free, like every other filter. Age, city, language and chapter decide whether
-- meeting somebody is practical at all, and religion decides it for a great
-- many people here; putting that behind a subscription would make the free
-- product deliberately worse rather than the paid one better.
--
-- The old signature is dropped rather than left beside the new one. An added
-- parameter is a new overload, and PostgREST resolving between two of them by
-- argument name is a coin toss nobody wants to debug. `home_summary` calls this
-- positionally with two arguments and keeps working, because everything after
-- them still has a default.
--
-- Ranking is untouched. The filter narrows the set and the order within it is
-- decided exactly as before.

drop function if exists public.discover_members(
  integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[]
);

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

revoke execute on function
  public.discover_members(integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[], public.religion[])
  from public, anon;
grant execute on function
  public.discover_members(integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[], public.religion[])
  to authenticated;
