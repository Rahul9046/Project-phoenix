-- Moderation: someone reads the reports.
--
-- Members could already report each other. Nothing read the rows. A report that
-- goes nowhere is worse than no report button, because the person who pressed it
-- believes something is happening -- and on a product for people deciding
-- whether to meet a stranger, that belief is the whole of the trust being asked
-- for.
--
-- This is the smallest thing that closes the loop: a queue, three actions, and a
-- record of who did what. No warnings workflow, no automated moderation, no
-- ticketing. Those can come when there is enough volume to know what they should
-- do.
--
-- Every decision below is enforced in the database rather than in a screen. An
-- admin page that hides a button is a suggestion; `is_moderator()` inside a
-- SECURITY DEFINER function is a boundary. A member who discovers the name of an
-- RPC must get nothing from calling it.

-- ---------------------------------------------------------------------------
-- Who may moderate
-- ---------------------------------------------------------------------------
--
-- An allowlist in `ops_config`, which is service-role only and unreadable by any
-- client. Deliberately not a column on `profiles`: a flag on a row a member can
-- reach is a flag somebody will eventually find a way to write, and privilege
-- that lives next to user data tends to leak into queries about user data.
--
-- Email rather than id so the first two admins can be named before their
-- accounts exist, and so adding a third is an update to one row rather than a
-- deploy. Compared case-insensitively and trimmed, because an address typed by a
-- human is not a reliable string.

insert into public.ops_config (key, value)
values ('moderation_admins', '["tech@eraya.app", "rahul@eraya.app"]'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.ops_config c,
           jsonb_array_elements_text(c.value) as allowed(email)
     where c.key = 'moderation_admins'
       and lower(btrim(allowed.email)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
       and coalesce(auth.jwt() ->> 'email', '') <> ''
  );
$$;

comment on function public.is_moderator() is
  'True when the caller''s verified session email is on the ops_config allowlist. The one place moderation privilege is decided.';

revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- ---------------------------------------------------------------------------
-- Suspension
-- ---------------------------------------------------------------------------
--
-- Suspension is not deletion. The account keeps its data, because moderation
-- that destroys the evidence it acted on cannot be reviewed, appealed or
-- corrected. A suspended member simply stops participating.

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users (id) on delete set null,
  add column if not exists suspension_reason text;

comment on column public.profiles.suspended_at is
  'Set by a moderator. Non-null means the member is excluded from discovery and cannot express interest or send messages.';

create index if not exists profiles_suspended_idx on public.profiles (suspended_at) where suspended_at is not null;

-- ---------------------------------------------------------------------------
-- Report lifecycle
-- ---------------------------------------------------------------------------
--
-- Most of this already exists. 20260830160300_reports_and_reading.sql gave
-- reports a `reason_code` category, an optional `description` in the reporter's
-- own words, and a `status` of received / reviewing / actioned / dismissed --
-- written, in its own words, so that "when a review process does exist, it has
-- somewhere to record itself". This is that process; the shape is already right
-- and inventing a parallel one would be the mistake.
--
-- The only column missing is who reviewed it. `reviewed_at` records when.

alter table public.member_reports
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null;

comment on column public.member_reports.reviewed_by is
  'The moderator who last changed this report''s status. Null while nobody has.';

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
--
-- Who did what, to whom, when. Kept separate from the report so the history
-- survives a report being reopened, and so a member's moderation history can be
-- read without joining through every report they appear in.
--
-- `actor` is set null on delete rather than cascading: an admin leaving must not
-- erase the record of decisions they made about other people.

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users (id) on delete set null,
  action text not null,
  report_id uuid references public.member_reports (id) on delete set null,
  target_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),

  constraint moderation_actions_known check (action in ('dismissed', 'suspended', 'restored'))
);

alter table public.moderation_actions enable row level security;

comment on table public.moderation_actions is
  'Moderation audit trail. No policies: reachable only through SECURITY DEFINER functions that check is_moderator().';

create index if not exists moderation_actions_target_idx on public.moderation_actions (target_id, created_at desc);

-- ---------------------------------------------------------------------------
-- The queue
-- ---------------------------------------------------------------------------
--
-- Returns only what a human needs to make one decision. An admin sees the
-- reporter and the reported member, not their phone numbers, payment history or
-- message contents -- privilege to moderate is not privilege to browse.

-- `p_filter` is 'open' (received or reviewing), 'resolved' (actioned or
-- dismissed), or 'all'. Deliberately not the raw enum: the queue thinks in terms
-- of needs-attention versus done, and a filter that leaks four states into a UI
-- invites someone to invent a workflow the product has not decided on.
create or replace function public.admin_list_reports(p_filter text default 'open')
returns table (
  id uuid,
  status public.report_status,
  reason_code public.report_reason,
  description text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reporter_id uuid,
  reporter_name text,
  reported_id uuid,
  reported_name text,
  reported_suspended_at timestamptz,
  reports_against_reported integer
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id,
         r.status,
         r.reason_code,
         r.description,
         r.created_at,
         r.reviewed_at,
         r.reporter_id,
         rep.first_name,
         r.reported_id,
         tgt.first_name,
         tgt.suspended_at,
         (select count(*)::integer from public.member_reports x where x.reported_id = r.reported_id)
    from public.member_reports r
    join public.profiles rep on rep.id = r.reporter_id
    join public.profiles tgt on tgt.id = r.reported_id
   where public.is_moderator()
     and (
       p_filter = 'all'
       or (p_filter = 'open' and r.status in ('received', 'reviewing'))
       or (p_filter = 'resolved' and r.status in ('actioned', 'dismissed'))
     )
   order by (r.status in ('received', 'reviewing')) desc, r.created_at desc
   limit 200;
$$;

comment on function public.admin_list_reports(text) is
  'Moderation queue. Returns nothing at all to a caller who is not on the allowlist.';

revoke execute on function public.admin_list_reports(text) from public, anon;
grant execute on function public.admin_list_reports(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------
--
-- Each one checks `is_moderator()` itself and raises rather than returning
-- quietly. A function that silently does nothing when called by the wrong person
-- is indistinguishable from one that is broken, and the difference matters when
-- somebody is debugging at speed.

create or replace function public.admin_dismiss_report(p_report uuid, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  if not public.is_moderator() then
    raise exception 'Not permitted' using errcode = '42501';
  end if;

  update public.member_reports
     set status = 'dismissed', reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_report
  returning reported_id into v_target;

  if v_target is null then
    raise exception 'No such report' using errcode = 'P0002';
  end if;

  insert into public.moderation_actions (actor, action, report_id, target_id, note)
  values (auth.uid(), 'dismissed', p_report, v_target, p_note);
end;
$$;

create or replace function public.admin_suspend_member(
  p_profile uuid,
  p_reason text default null,
  p_report uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Not permitted' using errcode = '42501';
  end if;

  -- Idempotent: suspending an already-suspended member refreshes the reason
  -- rather than failing, because the second click is usually a human unsure
  -- whether the first one worked.
  update public.profiles
     set suspended_at = coalesce(suspended_at, now()),
         suspended_by = auth.uid(),
         suspension_reason = coalesce(p_reason, suspension_reason)
   where id = p_profile;

  if not found then
    raise exception 'No such member' using errcode = 'P0002';
  end if;

  if p_report is not null then
    update public.member_reports
       set status = 'actioned', reviewed_at = now(), reviewed_by = auth.uid()
     where id = p_report;
  end if;

  insert into public.moderation_actions (actor, action, report_id, target_id, note)
  values (auth.uid(), 'suspended', p_report, p_profile, p_reason);
end;
$$;

create or replace function public.admin_restore_member(p_profile uuid, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Not permitted' using errcode = '42501';
  end if;

  update public.profiles
     set suspended_at = null, suspended_by = null, suspension_reason = null
   where id = p_profile;

  if not found then
    raise exception 'No such member' using errcode = 'P0002';
  end if;

  insert into public.moderation_actions (actor, action, report_id, target_id, note)
  values (auth.uid(), 'restored', null, p_profile, p_note);
end;
$$;

revoke execute on function public.admin_dismiss_report(uuid, text) from public, anon;
revoke execute on function public.admin_suspend_member(uuid, text, uuid) from public, anon;
revoke execute on function public.admin_restore_member(uuid, text) from public, anon;
grant execute on function public.admin_dismiss_report(uuid, text) to authenticated;
grant execute on function public.admin_suspend_member(uuid, text, uuid) to authenticated;
grant execute on function public.admin_restore_member(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- What suspension actually does
-- ---------------------------------------------------------------------------
--
-- Enforced where the data is, not where the buttons are. A suspended member who
-- keeps a session open, or who talks to the API directly, stops participating
-- just the same.

create or replace function public.is_suspended(p_profile uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = p_profile and p.suspended_at is not null
  );
$$;

revoke execute on function public.is_suspended(uuid) from public, anon;
grant execute on function public.is_suspended(uuid) to authenticated;

-- Suspended members disappear from discovery in both directions: they are shown
-- to nobody, and they are shown nobody.
--
-- This is the function from 20260902110100_seeking.sql, unchanged except for the
-- two clauses marked below and `me.suspended` carried through. Redefined in full
-- rather than wrapped: a wrapper around a discovery query that already sorts and
-- paginates would have to reproduce both, and the version that eventually drifts
-- is the one nobody is looking at.

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
    p.phone_verified_at is not null,
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

-- A suspended member cannot express new interest. Existing interest is left
-- alone: withdrawing it retroactively would tell the other person something
-- happened, and moderation is not something to announce to a third party.
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

  -- Suspension, checked before anything is written. Deliberately the same
  -- 'unavailable' a block raises: a suspended account learns that the action
  -- did not work, not that it has been moderated, and a member on the other
  -- side learns nothing at all.
  if exists (
    select 1 from public.profiles p
    where p.id in (me, target_id) and p.suspended_at is not null
  ) then
    raise exception 'unavailable';
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
  'Records a decision and opens a connection when it is mutual. Atomic, so a race cannot create two. Refuses when either side is suspended.';

revoke execute on function public.express_interest(uuid, public.interest_kind) from public, anon;
grant execute on function public.express_interest(uuid, public.interest_kind) to authenticated;

-- A suspended member cannot send messages. Reading is left as it was: a
-- conversation someone is already part of does not vanish, and taking away the
-- history would look like data loss rather than moderation.
drop policy if exists "Members send messages in their open connections" on public.messages;

create policy "Members send messages in their open connections"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and not exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.suspended_at is not null
    )
    and exists (
      select 1 from public.connections c
      where c.id = messages.connection_id
        and c.ended_at is null
        and (select auth.uid()) in (c.member_a, c.member_b)
    )
  );
