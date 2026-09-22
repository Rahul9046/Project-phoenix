-- Phone verification becomes optional, and the mark starts telling the truth.
--
-- Two separate things had been sharing one column's worth of meaning, and this
-- migration pulls them apart before the product starts depending on the muddle.
--
--   *Where somebody is in the questions* is `profiles.onboarding_stage`. Its
--   value 'phone_verified' has always meant "the phone step is behind them",
--   which is why `recordPhoneStepComplete` on the web writes it without
--   touching any verification column. It is a position in a sequence, never a
--   claim about a person. A member who is offered the step and declines passes
--   exactly the same milestone as one who completes it: they were asked, and
--   they answered.
--
--   *Whether Eraya has checked a number* is `phone_verified_at` together with
--   `phone_verified_via`. Only the second of those separates a real SMS from
--   the pre-launch stand-in, and only the pair may ever be shown to another
--   member.
--
-- Nothing is added here. The state needed to express "skipped" already exists,
-- and a `phone_skipped_at` beside it would be a second source of truth that can
-- disagree with the first.
--
-- What does change is who gets a mark. `member_card.phone_verified` was
-- `phone_verified_at is not null`, which counts every account the mock verified
-- -- the demo members among them. That was harmless while no client rendered
-- the field, and becomes a lie the moment one does, which is exactly what the
-- accompanying change to both clients makes it do. The rule the 2026-09-05
-- migration wrote down -- "phone_verified_via = 'msg91' is the only thing any
-- future trust decision may look at" -- is now enforced where the decision is
-- actually made, rather than left as a note for whoever reads that file next.

-- ---------------------------------------------------------------------------
-- The rule, in one place
-- ---------------------------------------------------------------------------
--
-- A function rather than the expression repeated in each query. There are two
-- producers of `member_card` today and there will be more; the failure mode of
-- copying the predicate is that one of them keeps counting mock rows and nobody
-- notices, because a mark that is wrongly present looks exactly like a mark that
-- is rightly present.

create or replace function public.phone_is_verified(
  verified_at timestamptz,
  verified_via text
)
returns boolean
language sql
immutable
parallel safe
as $$
  select verified_at is not null and verified_via = 'msg91';
$$;

comment on function public.phone_is_verified(timestamptz, text) is
  'Whether an SMS was actually answered on this number. The mock never counts. The only predicate a member-facing trust mark may use.';

-- Called from the security definer functions below, which run as the owner. No
-- client has any business asking this question directly.
revoke execute on function public.phone_is_verified(timestamptz, text)
  from public, anon, authenticated;

comment on type public.onboarding_stage is
  'How far through the questions somebody is. phone_verified means the phone step is behind them -- completed or declined -- and is never evidence that a number was checked. phone_is_verified() answers that.';

comment on column public.profiles.phone_verified_at is
  'When an SMS was answered on this number, or null. Null is an ordinary state: phone verification is optional, and a member may decline it at onboarding and do it later, or never. Written only by the verify edge function.';

-- ---------------------------------------------------------------------------
-- The two producers of member_card
-- ---------------------------------------------------------------------------
--
-- Both redefined in full rather than wrapped, and both unchanged apart from the
-- single marked line -- the same reasoning the moderation migration gave for
-- redefining discovery rather than wrapping it. The signatures are untouched, so
-- `create or replace` leaves every dependant standing: interests_received,
-- my_conversations and home_summary are all built on member_profile.

-- From 20260830160600_restore_member_profile_signature.sql.
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
    -- Changed: the mock no longer earns a mark.
    public.phone_is_verified(p.phone_verified_at, p.phone_verified_via),
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

-- From 20260911100100_moderation.sql.
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
    -- Changed: the mock no longer earns a mark.
    public.phone_is_verified(p.phone_verified_at, p.phone_verified_via),
    u.email_confirmed_at is not null
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
