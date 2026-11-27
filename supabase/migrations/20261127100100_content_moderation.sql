-- Moderating what members post.
--
-- App Store Review Guideline 1.2 asks four things of an app with user-generated
-- content: a way to report, a way to block, published contact information, and
-- "a method for filtering objectionable material from being posted to the app".
-- Eraya already had the first three -- `SafetyActions` on both a profile and a
-- conversation, `member_blocks`, support@eraya.app, and a moderation queue with
-- a child-safety priority lane. It had nothing for the fourth.
--
-- This is the fourth. Two mechanisms, because photographs and text fail
-- differently:
--
--   Photographs are reviewed BEFORE anybody else can see them. A photo is the
--   single most consequential thing a member publishes here -- it is what a
--   stranger decides about -- and there is no automated check worth trusting
--   with it. So the gate is a person, and the wait is the cost.
--
--   Text is screened AT THE MOMENT OF POSTING, by pattern. Holding every
--   message for review would make conversation impossible, and conversation is
--   the product. So the screen is narrow, aimed at the things that are
--   unambiguous, and everything else continues to rely on reporting.
--
-- Neither is a safety system on its own and this file does not pretend
-- otherwise. A keyword list does not understand context, a reviewer cannot see
-- intent, and the honest claim is "objectionable material is filtered before it
-- is posted", which is what the guideline asks and what this does.
--
-- WHERE THE ENFORCEMENT LIVES
--
-- In the database, not in a client. Two clients already exist in the wild --
-- eraya.app and Android v0.1.4 -- and neither knows this migration happened.
-- Anything enforced in application code would be enforced for exactly the
-- builds that ship after it and for nobody who already has the app. So:
--
--   * a photo's state cannot be set by its owner, because the privilege to
--     write that column is not granted and a trigger refuses it anyway;
--   * an unapproved photo's BYTES are unreachable, because the storage policy
--     reads the state -- not merely absent from a query that a different query
--     could replace;
--   * text screening is a BEFORE trigger, so an old client, a new client and a
--     hand-written REST call all meet the same wall.

-- ---------------------------------------------------------------------------
-- The states a photo can be in
-- ---------------------------------------------------------------------------
--
-- `grandfathered` is the interesting one, and it exists to avoid two bad
-- options at the moment this migration runs.
--
-- Defaulting every existing photo to `pending` would blank every profile in the
-- product until somebody worked through a queue -- members who did nothing
-- wrong, punished for a policy change they never saw. Defaulting them to
-- `approved` would be a lie: it would record, permanently and in the same
-- column a moderator writes, that a human reviewed photographs no human has
-- looked at.
--
-- So existing photographs stay visible AND stay honestly labelled. They are
-- `grandfathered`: visible like an approved photo, distinguishable from one
-- forever, and listable for retrospective review. `moderated_by` is null on
-- them, which is the audit trail saying nobody approved this.

create type public.photo_moderation_state as enum (
  'pending',
  'approved',
  'rejected',
  'grandfathered'
);

comment on type public.photo_moderation_state is
  'pending: uploaded, not yet reviewed, visible only to its owner and moderators. approved: a moderator said yes. rejected: a moderator said no; never visible to anyone else. grandfathered: predates moderation, visible, and never claimed to have been reviewed.';

-- Why a photo was refused. A fixed list rather than free text, for the same
-- reason report reasons are a fixed list: a hand-typed reason cannot be
-- counted, cannot be triaged, and cannot be translated for the person who has
-- to act on it.
create type public.photo_rejection_reason as enum (
  'no_person',        -- not a photograph of a person
  'multiple_people',  -- a group photo; whose profile is this
  'not_the_member',   -- a celebrity, a stock photo, somebody else
  'explicit',         -- sexual or otherwise not permitted
  'contact_details',  -- a phone number or handle written into the image
  'unclear',          -- too dark, too small, too blurred to show a face
  'other'
);

-- ---------------------------------------------------------------------------
-- The columns
-- ---------------------------------------------------------------------------

alter table public.profile_photos
  -- Added as `grandfathered` so every row that already exists becomes
  -- grandfathered in this statement, then the default is swapped to `pending`
  -- so every row inserted afterwards is unreviewed. One migration, atomic, and
  -- no UPDATE scan that could half-apply.
  add column moderation_state public.photo_moderation_state
    not null default 'grandfathered',
  add column moderated_at timestamptz,
  add column moderated_by uuid references auth.users (id) on delete set null,
  add column rejection_reason public.photo_rejection_reason;

alter table public.profile_photos
  alter column moderation_state set default 'pending';

-- A rejection must say why, and anything else must not pretend to.
alter table public.profile_photos
  add constraint profile_photos_rejection_reason_matches_state
    check (
      (moderation_state = 'rejected' and rejection_reason is not null)
      or (moderation_state <> 'rejected' and rejection_reason is null)
    );

-- A decision records who made it and when. `grandfathered` has neither, which
-- is precisely the point -- see the note above.
alter table public.profile_photos
  add constraint profile_photos_decision_is_attributed
    check (
      (moderation_state in ('approved', 'rejected')
        and moderated_at is not null and moderated_by is not null)
      or (moderation_state in ('pending', 'grandfathered')
        and moderated_at is null and moderated_by is null)
    );

comment on column public.profile_photos.moderation_state is
  'Whether anybody other than the owner may see this photograph. Not writable by the owner: see the column privileges and the trigger below.';

-- The queue's only access pattern: oldest unreviewed first.
create index profile_photos_pending_idx
  on public.profile_photos (created_at)
  where moderation_state = 'pending';

-- Retrospective review of the grandfathered backlog, same shape.
create index profile_photos_grandfathered_idx
  on public.profile_photos (created_at)
  where moderation_state = 'grandfathered';

-- ---------------------------------------------------------------------------
-- A member cannot approve their own photograph
-- ---------------------------------------------------------------------------
--
-- `profile_photos` has one policy -- "Members manage their own photos", FOR ALL
-- -- and row-level security cannot restrict WHICH COLUMNS an update touches. So
-- without this, a member could `update profile_photos set moderation_state =
-- 'approved'` on their own row and the policy would allow it. Every photo in
-- the product would be self-approved within a day of somebody noticing.
--
-- Two defences, because this one is worth two:
--
--   1. Column privileges. `authenticated` may update `position` and nothing
--      else, so the UPDATE is refused before any policy is consulted.
--   2. A trigger, for the service role and anything that acquires wider
--      privileges later. Privileges can be re-granted by a future migration
--      that means well; the trigger would still refuse.

revoke update on public.profile_photos from authenticated;
grant select, insert, delete on public.profile_photos to authenticated;
grant update (position) on public.profile_photos to authenticated;

create or replace function public.profile_photos_guard_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A moderator acting through `approve_photo` / `reject_photo`, or the service
  -- role doing operational work, is the only legitimate writer of these
  -- columns. Both are checked here rather than trusted by the caller.
  if public.is_moderator() or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Whatever the client sent, a new photograph is unreviewed. A client that
    -- inserts `moderation_state => 'approved'` is not rejected with an error --
    -- it is simply overruled, because the alternative is a failure mode that
    -- depends on client version.
    new.moderation_state := 'pending';
    new.moderated_at := null;
    new.moderated_by := null;
    new.rejection_reason := null;
    return new;
  end if;

  if new.moderation_state is distinct from old.moderation_state
     or new.moderated_at is distinct from old.moderated_at
     or new.moderated_by is distinct from old.moderated_by
     or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'photo moderation state is not yours to set'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.profile_photos_guard_moderation()
  from public, anon, authenticated;

create trigger profile_photos_guard_moderation
  before insert or update on public.profile_photos
  for each row execute function public.profile_photos_guard_moderation();

-- ---------------------------------------------------------------------------
-- Which photographs other people may see
-- ---------------------------------------------------------------------------
--
-- One definition, called everywhere, so the rule cannot drift between the
-- discovery card, the profile screen and the storage policy. `member_profile`
-- and `discover_members` inlined this subquery; they now call this instead,
-- which means a future redefinition that copies their body carries the
-- moderation filter with it rather than silently dropping it.
--
-- Not granted to any client role. It takes a member id and answers without
-- asking whether the caller may see that member -- the callers do that -- so
-- exposing it directly would hand out photo paths for anybody. Inside a
-- `security definer` function the effective user is the owner, which has
-- execute, so the callers are unaffected.

create or replace function public.visible_photo_path(member uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ph.storage_path
    from public.profile_photos ph
   where ph.profile_id = member
     and ph.moderation_state in ('approved', 'grandfathered')
   order by ph.position
   limit 1;
$$;

create or replace function public.visible_photo_count(member uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.profile_photos ph
   where ph.profile_id = member
     and ph.moderation_state in ('approved', 'grandfathered');
$$;

revoke execute on function public.visible_photo_path(uuid)
  from public, anon, authenticated;
revoke execute on function public.visible_photo_count(uuid)
  from public, anon, authenticated;

/*
 * Is this storage object a photograph anybody may see?
 *
 * This exists because of a trap that a first attempt at the storage policy fell
 * straight into, and the runtime probe caught: the policy originally asked the
 * question inline,
 *
 *     exists (select 1 from public.profile_photos ph
 *              where ph.storage_path = storage.objects.name
 *                and ph.moderation_state in ('approved','grandfathered'))
 *
 * which READS CORRECTLY AND DOES NOT WORK. A storage policy is evaluated as the
 * requesting role, and `profile_photos` has row-level security permitting a
 * member to see only their OWN rows. So for anybody else the subquery found
 * nothing, the policy denied, and every approved photograph in the product
 * became unreadable to every other member -- discovery would have gone blank.
 *
 * `security definer` is what makes the question answerable: the check needs to
 * see a row the caller may not select. It is safe to expose, because all it
 * reveals is whether a given path is a publishable photo -- which anybody who
 * can read the bytes already knows, and anybody who cannot learns nothing
 * actionable from.
 *
 * It deliberately does NOT consider blocks. The policy applies that separately,
 * so neither concern can be lost by editing the other.
 */
create or replace function public.photo_is_publishable(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profile_photos ph
     where ph.storage_path = object_name
       and ph.moderation_state in ('approved', 'grandfathered')
  );
$$;

revoke execute on function public.photo_is_publishable(text) from public, anon;
grant execute on function public.photo_is_publishable(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The storage policy -- where this is actually enforced
-- ---------------------------------------------------------------------------
--
-- This is the part that makes the pending state real rather than cosmetic.
--
-- The previous policy let any signed-in member read ANY object in the bucket
-- whose owner had not blocked them. That was right when every photo was
-- publishable: discovery needs to load other people's pictures, and a policy
-- restricted to connections would have left every card blank. But it means a
-- path is enough -- so filtering the RPCs alone would leave the bytes reachable
-- to anyone who learned or guessed a path, and "pending" would be a label in a
-- UI rather than a boundary.
--
-- So the policy now reads the state. Three ways to be allowed, and no fourth:
--
--   your own folder          -- you can always see your own photographs,
--                               whatever state they are in; you have to be able
--                               to see what you are waiting on
--   a moderator              -- reviewing a photo requires looking at it
--   approved or grandfathered, and not blocked in either direction
--
-- It fails closed in a way worth noticing: an object with no `profile_photos`
-- row matches nothing. `uploadPhoto` writes the file first and the row second,
-- so between those two statements -- and forever, if the row insert fails --
-- the object is readable by its owner and by nobody else.

drop policy if exists "Members read photos of people they may see" on storage.objects;

create policy "Members read approved photos of people they may see"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      -- Your own, in any state.
      (storage.foldername(name))[1] = (select auth.uid())::text

      -- A moderator, so the queue can be worked.
      or public.is_moderator()

      -- Everybody else: reviewed-and-permitted only, and not blocked.
      --
      -- Through a `security definer` function, NOT an inline subquery -- see the
      -- note on `photo_is_publishable`. Inline, this clause is evaluated under
      -- `profile_photos`' own row-level security and is false for everybody but
      -- the owner, which silently hides every approved photograph in the
      -- product.
      or (
        public.photo_is_publishable(name)
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
-- The read paths, filtered
-- ---------------------------------------------------------------------------
--
-- The storage policy above already makes an unapproved photo's bytes
-- unreachable. These are still necessary, for two reasons: a path is itself
-- information about somebody, and a card carrying a path whose bytes 403 would
-- render as a broken image rather than falling back to the monogram -- so a
-- member with a pending photo would look broken to everybody instead of simply
-- looking like a member without a photograph yet.
--
-- Bodies are otherwise unchanged from `20260922120100_religion.sql`. The only
-- edit is that the two inline photo subqueries became calls to
-- `visible_photo_path` / `visible_photo_count`.

create or replace function public.member_photos(member_id uuid)
returns table (storage_path text, photo_position smallint)
language sql
stable
security definer
set search_path = public
as $$
  select ph.storage_path, ph.position
  from public.profile_photos ph
  where ph.profile_id = member_id
    and ph.moderation_state in ('approved', 'grandfathered')
    and exists (select 1 from public.member_profile(member_id))
  order by ph.position;
$$;

revoke execute on function public.member_photos(uuid) from public, anon;
grant execute on function public.member_photos(uuid) to authenticated;

comment on function public.member_photos(uuid) is
  'Every reviewed-and-permitted photo of one member, in their order. Returns nothing when member_profile would, and never returns a pending or rejected photograph.';

/*
 * A member's own photographs, including the ones nobody else can see yet.
 *
 * `member_photos` deliberately hides pending and rejected photos, and that is
 * wrong for exactly one caller: the person who uploaded them. They need to see
 * what is waiting, what was refused and why, or the product has taken a
 * photograph and said nothing about it.
 *
 * Reads the session rather than taking an id, so there is no argument to
 * substitute and no way to ask about anybody else.
 */
create or replace function public.my_photos()
returns table (
  id uuid,
  storage_path text,
  photo_position smallint,
  moderation_state public.photo_moderation_state,
  rejection_reason public.photo_rejection_reason,
  moderated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ph.id, ph.storage_path, ph.position,
         ph.moderation_state, ph.rejection_reason, ph.moderated_at
    from public.profile_photos ph
   where ph.profile_id = auth.uid()
   order by ph.position;
$$;

revoke execute on function public.my_photos() from public, anon;
grant execute on function public.my_photos() to authenticated;

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
    and not exists (
      select 1 from public.member_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    );
$$;

revoke execute on function public.member_profile(uuid) from public, anon;
grant execute on function public.member_profile(uuid) to authenticated;

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
    and (min_age is null
         or date_part('year', age(p.date_of_birth))::integer >= min_age)
    and (max_age is null
         or date_part('year', age(p.date_of_birth))::integer <= max_age)
    and (city_ids is null or array_length(city_ids, 1) is null
         or p.city_id = any (city_ids))
    and (relationship_statuses is null or array_length(relationship_statuses, 1) is null
         or p.relationship_status = any (relationship_statuses))
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
  limit greatest(0, least(coalesce(max_results, 10), 50))
  offset greatest(0, coalesce(page_offset, 0));
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
-- The moderator's side
-- ---------------------------------------------------------------------------
--
-- Three functions, each re-checking `is_moderator()` itself. The admin pages
-- check it too, for rendering, but a page that forgot would still get nothing
-- useful -- the same arrangement every other moderation RPC uses.

create or replace function public.photo_review_queue(
  max_results integer default 50,
  include_grandfathered boolean default false
)
returns table (
  id uuid,
  profile_id uuid,
  first_name text,
  storage_path text,
  photo_position smallint,
  moderation_state public.photo_moderation_state,
  uploaded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ph.id, ph.profile_id, p.first_name, ph.storage_path, ph.position,
         ph.moderation_state, ph.created_at
    from public.profile_photos ph
    join public.profiles p on p.id = ph.profile_id
   where public.is_moderator()
     and (
       ph.moderation_state = 'pending'
       or (include_grandfathered and ph.moderation_state = 'grandfathered')
     )
   -- Oldest first. Somebody has been waiting.
   order by ph.created_at
   limit greatest(0, least(coalesce(max_results, 50), 200));
$$;

revoke execute on function public.photo_review_queue(integer, boolean)
  from public, anon;
grant execute on function public.photo_review_queue(integer, boolean)
  to authenticated;

create or replace function public.approve_photo(photo_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  update public.profile_photos
     set moderation_state = 'approved',
         moderated_at = now(),
         moderated_by = auth.uid(),
         rejection_reason = null
   where id = photo_id
     -- A decision can be revisited, including un-rejecting and reviewing the
     -- grandfathered backlog. Re-approving an approved photo is a no-op that
     -- refreshes the timestamp, which is harmless and simpler than refusing it.
     and moderation_state in ('pending', 'rejected', 'grandfathered', 'approved');

  return found;
end;
$$;

revoke execute on function public.approve_photo(uuid) from public, anon;
grant execute on function public.approve_photo(uuid) to authenticated;

create or replace function public.reject_photo(
  photo_id uuid,
  reason public.photo_rejection_reason
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if reason is null then
    raise exception 'a rejection must say why' using errcode = '22004';
  end if;

  update public.profile_photos
     set moderation_state = 'rejected',
         moderated_at = now(),
         moderated_by = auth.uid(),
         rejection_reason = reason
   where id = photo_id;

  return found;
end;
$$;

revoke execute on function public.reject_photo(uuid, public.photo_rejection_reason)
  from public, anon;
grant execute on function public.reject_photo(uuid, public.photo_rejection_reason)
  to authenticated;

-- How much is waiting, for the admin landing page.
create or replace function public.photo_review_counts()
returns table (pending integer, grandfathered integer, rejected integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where moderation_state = 'pending')::integer,
    count(*) filter (where moderation_state = 'grandfathered')::integer,
    count(*) filter (where moderation_state = 'rejected')::integer
  from public.profile_photos
  where public.is_moderator();
$$;

revoke execute on function public.photo_review_counts() from public, anon;
grant execute on function public.photo_review_counts() to authenticated;

-- ---------------------------------------------------------------------------
-- Text screening
-- ---------------------------------------------------------------------------
--
-- What this is for, stated narrowly so it is not mistaken for more.
--
-- The categories below are the ones where a pattern can be close to certain:
-- contact details being pushed off-platform, unambiguous sexual solicitation,
-- and a short list of slurs and clearly prohibited content. Everything else --
-- tone, intent, pressure, a conversation that turns -- is not detectable by
-- pattern and continues to depend on reporting, blocking and a person reading
-- the report. `SafetyActions` is untouched by this file.
--
-- FALSE POSITIVES ARE THE REAL RISK, and the product makes them expensive.
-- Eraya's members are divorced, separated and widowed adults writing about
-- marriage, children, bereavement, illness, religion and sex in six languages.
-- A filter that refuses "my husband died of cancer" or a religious phrase has
-- not made anybody safer; it has told a grieving person their words are
-- obscene. So:
--
--   * matching is on WORD BOUNDARIES, never substrings. The alternative finds
--     a slur inside an ordinary place name and refuses it;
--   * the lists are short and specific, not broad categories;
--   * nothing medical, religious, anatomical-but-clinical, or
--     relationship-related is in them;
--   * the terms live in a TABLE, not in this file, so a false positive found in
--     production is a row to delete rather than a migration to write and deploy.

create type public.content_rejection_reason as enum (
  'contact_details',
  'external_link',
  'sexual_solicitation',
  'abuse',
  'prohibited'
);

comment on type public.content_rejection_reason is
  'Why a piece of text was refused at the moment of posting. Narrow by design: everything subtler is a matter for reporting, not for a pattern.';

/*
 * Normalisation, so the obvious evasions do not work.
 *
 * Lower-cases, folds the digit-and-symbol substitutions people use to get a
 * word past a filter, strips zero-width characters (which are invisible and
 * split a word for a matcher while leaving it readable to a human), collapses
 * runs of the same letter, and reduces every remaining separator to a single
 * space.
 *
 * IMMUTABLE and pure, so it can be reasoned about and tested directly.
 */
create or replace function public.normalise_for_screening(input text)
returns text
language sql
immutable
as $$
  with lowered as (
    select translate(
      lower(coalesce(input, '')),
      -- leet-speak and lookalikes
      '0134578@$!|',
      'oieasatasi'
    ) as t
  ),
  stripped as (
    -- zero-width space, ZWNJ, ZWJ, word joiner, BOM, soft hyphen. Invisible to
    -- a reader and word-splitting to a matcher, which is the whole appeal.
    select regexp_replace(t, '[​‌‍⁠﻿­]', '', 'g') as t from lowered
  ),
  joined as (
    /*
     * Punctuation BETWEEN two letters is removed rather than replaced, so
     * `nu**des` becomes `nudes` instead of `nu des`. This is the step the first
     * version of this function lacked, and the probe caught it: collapsing
     * every separator to a space defeats padding but *helps* the commonest
     * evasion there is, because it splits the word it was trying to join.
     *
     * Whitespace is excluded from the class on purpose -- "well. done" must not
     * become one word, and more importantly "9 8 7 6 5" must not become a
     * number, which is a different check's job.
     *
     * Applied twice because the pattern consumes the letter it matched on, so a
     * single pass leaves every second separator in `a.b.c.d`.
     */
    select regexp_replace(
             regexp_replace(t, '([[:alpha:]])[^[:alnum:][:space:]]+([[:alpha:]])', '\1\2', 'g'),
             '([[:alpha:]])[^[:alnum:][:space:]]+([[:alpha:]])', '\1\2', 'g'
           ) as t
      from stripped
  ),
  collapsed as (
    -- three or more of the same character becomes one
    select regexp_replace(t, '(.)\1{2,}', '\1', 'g') as t from joined
  )
  -- any remaining run of punctuation or whitespace becomes one space
  select btrim(regexp_replace(t, '[^[:alnum:]]+', ' ', 'g')) from collapsed;
$$;

comment on function public.normalise_for_screening(text) is
  'Lower-cases, folds leet-speak, strips zero-width characters and collapses repeats and separators. Pure and immutable.';

/*
 * The terms, in a table rather than in code.
 *
 * Service-role only: `screen_text` is `security definer` and reads it as the
 * owner, so no client needs or gets access. Publishing the list to clients
 * would also publish the evasion instructions.
 */
create table public.content_filter_terms (
  id uuid primary key default gen_random_uuid(),
  reason public.content_rejection_reason not null,
  -- A POSIX regular expression, matched against the NORMALISED text. Authors
  -- should anchor on word boundaries (\m and \M) unless they really mean a
  -- substring.
  pattern text not null,
  -- Why this row exists, for whoever finds it causing a false positive.
  note text,
  -- Off without deleting, so a bad pattern can be disabled in one statement.
  enabled boolean not null default true,
  created_at timestamptz not null default now(),

  constraint content_filter_terms_pattern_not_blank
    check (length(btrim(pattern)) > 0)
);

alter table public.content_filter_terms enable row level security;
-- No policy, deliberately: with RLS on and no policy, no client role can read,
-- write or even count the rows. The service role bypasses RLS.
revoke all on public.content_filter_terms from public, anon, authenticated;

comment on table public.content_filter_terms is
  'Patterns that refuse a piece of text at posting time. Unreadable by any client: publishing the list would publish how to evade it.';

create index content_filter_terms_enabled_idx
  on public.content_filter_terms (reason) where enabled;

/*
 * The screen itself. Returns the reason, or null when the text is allowed.
 *
 * Contact details and links are handled in code rather than as rows, because
 * they are structural rather than lexical -- a phone number is a shape, not a
 * word, and writing that shape as a list of patterns invites both misses and
 * false positives.
 */
create or replace function public.screen_text(input text)
returns public.content_rejection_reason
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalised text;
  digits text;
  hit public.content_rejection_reason;
begin
  if input is null or length(btrim(input)) = 0 then
    return null;
  end if;

  normalised := public.normalise_for_screening(input);

  /*
   * An email address. Checked on the raw text, because normalisation has
   * already removed the '@' and the dots that make it one.
   */
  if input ~* '[[:alnum:]._%%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}' then
    return 'contact_details';
  end if;

  /*
   * A phone number.
   *
   * Nine or more digits, counted after every separator is removed, so
   * "9 8 7 6 5 4 3 2 1 0" and "98765-43210" are the same thing. Nine rather
   * than ten because an Indian mobile is ten and people drop or add one.
   *
   * The length guard matters: a member writing "I was married in 1998 and we
   * separated in 2016" has eight digits across the whole sentence, and this
   * counts digits in a single unbroken run rather than in the text as a whole.
   */
  digits := regexp_replace(coalesce(input, ''), '[^0-9]', '', 'g');
  if length(digits) >= 9
     and input ~ '([0-9][^[:alnum:]]{0,2}){8,}[0-9]' then
    return 'contact_details';
  end if;

  /*
   * A social handle or a messaging invitation. Narrow on purpose: "@" followed
   * by a plausible handle, or a named platform next to a word that means
   * "reach me".
   */
  if input ~ '(^|[^[:alnum:]])@[[:alnum:]._]{3,}'
     or normalised ~ '\m(whatsapp|telegram|instagram|insta|snapchat|signal)\M.{0,24}\m(number|num|id|handle|me|dm|add|message|msg)\M'
     or normalised ~ '\m(number|num|id|handle)\M.{0,24}\m(whatsapp|telegram|instagram|insta|snapchat|signal)\M' then
    return 'contact_details';
  end if;

  -- A URL. Members have no reason to send links to each other, and every
  -- reason somebody running a scam does.
  if input ~* '(https?://|www\.)[[:alnum:]-]+\.[[:alpha:]]{2,}'
     or input ~* '[[:alnum:]-]+\.(com|net|org|in|co|io|me|xyz|link|site)(/|$|[[:space:]])' then
    return 'external_link';
  end if;

  -- Everything lexical, from the table, most serious first so a message that
  -- trips two categories is reported as the worse one.
  select t.reason into hit
    from public.content_filter_terms t
   where t.enabled
     and normalised ~ t.pattern
   order by case t.reason
              when 'prohibited' then 0
              when 'sexual_solicitation' then 1
              when 'abuse' then 2
              else 3
            end
   limit 1;

  return hit;
end;
$$;

revoke execute on function public.screen_text(text) from public, anon, authenticated;

comment on function public.screen_text(text) is
  'The reason a piece of text is refused, or null when it is allowed. Not granted to clients: it is called by triggers, and exposing it would turn the filter into an oracle for testing evasions against.';

-- ---------------------------------------------------------------------------
-- The seed list
-- ---------------------------------------------------------------------------
--
-- Deliberately short. Each pattern is anchored on word boundaries, and each has
-- a note saying what it is for so that whoever hits a false positive can judge
-- whether to delete the row.
--
-- Transliterations are included for the terms that are commonly written in
-- Latin script across all six languages -- which is how they are actually
-- typed on an Indian phone keyboard, far more often than in Devanagari or
-- Tamil script. Native-script forms are deliberately NOT guessed at here: a
-- wrong pattern in an script nobody on this side reads is a false positive
-- waiting to happen, and adding them properly needs a speaker.

insert into public.content_filter_terms (reason, pattern, note) values
  -- Prohibited: commercial sexual services and anything suggesting a minor.
  -- These are the categories where a false negative is worst and the words are
  -- least ambiguous.
  ('prohibited', '\m(escort|escorts|callgirl|call girl|callboy|call boy)\M',
   'Commercial sexual services. Not a word that appears in an honest profile here.'),
  ('prohibited', '\m(randi|veshya|kothi)\M',
   'Transliterated terms for a prostitute, used as both solicitation and abuse.'),
  ('prohibited', '\m(minor|underage|under age|school girl|schoolgirl|school boy)\M.{0,20}\m(sex|nude|photo|pic|meet)\M',
   'Sexualising a minor. Paired with an intent word so that the word "minor" alone -- which has innocent uses -- does not trip it.'),
  ('prohibited', '\m(child|baccha|bacchi)\M.{0,16}\m(sex|nude|naked)\M',
   'As above. The pairing is what makes this safe to match: members write about their children constantly.'),

  -- Sexual solicitation. Unambiguous requests, not anatomy and not desire.
  ('sexual_solicitation', '\m(nude|nudes|naked)\M.{0,20}\m(pic|pics|photo|photos|pix|selfie|send|bhejo|bhej)\M',
   'Asking for or offering nude photographs.'),
  ('sexual_solicitation', '\m(send|bhejo|bhej|share)\M.{0,20}\m(nude|nudes|naked|boobs)\M',
   'The same request with the words the other way round.'),
  ('sexual_solicitation', '\m(sex chat|sexchat|sexting|hookup|one night stand|onenightstand)\M',
   'Explicitly not what Eraya is for, and named as such in the terms.'),
  ('sexual_solicitation', '\m(physical relation|physical relationship)\M.{0,24}\m(only|chahiye|want|looking)\M',
   'A very common Indian-English phrasing for soliciting sex. Paired with an intent word because the phrase alone is also used to say the opposite.'),

  -- Abuse. A short list of unambiguous slurs and threats.
  ('abuse', '\m(madarchod|behenchod|bhenchod|bhosdi|bhosdike|gandu|chutiya|chutiye)\M',
   'Transliterated Hindi/Urdu profanity used as direct abuse. No non-abusive use.'),
  ('abuse', '\m(i will|main|mai)\M.{0,16}\m(kill|maar dunga|maardunga|rape)\M',
   'A direct threat of violence. Paired with a first-person subject so that discussing violence -- which a widow may need to do -- is not refused.'),
  ('abuse', '\m(kill yourself|kys)\M',
   'Telling somebody to end their life.');

-- ---------------------------------------------------------------------------
-- Where the screen is applied
-- ---------------------------------------------------------------------------
--
-- Triggers, so that the two clients already in the wild are covered. An
-- application-level check would apply only to builds shipped after today, which
-- is to say not to the published Android app and not to anybody who has not
-- updated.
--
-- `errcode` 'ERA01' is a custom SQLSTATE in the user-defined range. The message
-- is a stable machine-readable token, `content_rejected:<reason>`, so a client
-- can map it to a sentence in the member's own language. An older client that
-- does not know the token shows its generic failure copy -- which is the right
-- failure: the post is refused either way, and the member is not told something
-- untrue.

create or replace function public.messages_screen_body()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reason public.content_rejection_reason;
begin
  reason := public.screen_text(new.body);

  if reason is not null then
    raise exception 'content_rejected:%', reason using errcode = 'ERA01';
  end if;

  return new;
end;
$$;

revoke execute on function public.messages_screen_body()
  from public, anon, authenticated;

create trigger messages_screen_body
  before insert on public.messages
  for each row execute function public.messages_screen_body();

/*
 * Profile free text.
 *
 * `about` and `looking_for` are the two fields every other member reads, and
 * `first_name` is shown on every card. `other_city` is free text too and is
 * screened for the same reason -- it is displayed verbatim when a member's city
 * is not in the dataset.
 *
 * Only on INSERT or an actual change to one of those columns, so a profile
 * update that touches none of them -- a language, a filter, an onboarding stage
 * -- pays nothing and cannot be refused by a pattern added later.
 */
create or replace function public.profiles_screen_text()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reason public.content_rejection_reason;
begin
  if tg_op = 'UPDATE'
     and new.about is not distinct from old.about
     and new.looking_for is not distinct from old.looking_for
     and new.first_name is not distinct from old.first_name
     and new.other_city is not distinct from old.other_city then
    return new;
  end if;

  reason := coalesce(
    public.screen_text(new.about),
    public.screen_text(new.looking_for),
    public.screen_text(new.first_name),
    public.screen_text(new.other_city)
  );

  if reason is not null then
    raise exception 'content_rejected:%', reason using errcode = 'ERA01';
  end if;

  return new;
end;
$$;

revoke execute on function public.profiles_screen_text()
  from public, anon, authenticated;

create trigger profiles_screen_text
  before insert or update on public.profiles
  for each row execute function public.profiles_screen_text();

-- ---------------------------------------------------------------------------
-- Deleting an account still works
-- ---------------------------------------------------------------------------
--
-- Nothing above changes that, and this comment is here so the next person does
-- not have to work it out:
--
--   * `profile_photos` rows go with the profile, by the existing
--     `on delete cascade`, in every moderation state including rejected;
--   * `moderated_by` is `on delete set null`, so deleting a MODERATOR's account
--     does not cascade into deleting the photographs they reviewed -- which
--     would be a spectacular way to lose a member's profile;
--   * the storage objects are removed by the client before the account goes,
--     through the existing "Members delete their own photo files" policy, which
--     is unchanged and does not consult moderation state;
--   * `content_filter_terms` references nobody and is unaffected.
