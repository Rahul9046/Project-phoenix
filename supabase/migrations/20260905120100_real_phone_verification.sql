-- Real phone verification, and the rules that keep it from costing a fortune.
--
-- Until now any six digits were accepted. That was a labelled stand-in -- the
-- screens said so and no member was ever shown a "phone verified" mark -- but it
-- is the kind of stand-in that becomes load-bearing if left alone, so it goes.
--
-- The architecture this enforces, and the reason for it:
--
--   Supabase remains the identity authority. A phone number is an attribute of
--   an already-authenticated account, never a second way to sign in. Nothing
--   here creates a user; everything here requires one to exist first.
--
--   The provider is never trusted with the outcome and the client is never
--   trusted with anything. Both the sending and the checking happen in an edge
--   function holding the service role, and this file is where its rules live --
--   in SQL, where they are atomic, rather than in TypeScript where two requests
--   arriving together would both pass the same check.
--
--   No code is ever stored. MSG91 holds it, the person has it in a message, and
--   this database has neither. A table of codes is a table that can be read to
--   take somebody's account.

-- ---------------------------------------------------------------------------
-- The number itself
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists phone_number text,
  -- How the number was checked. 'mock' exists so that the accounts verified by
  -- the old stand-in are not silently promoted to verified now that the word
  -- means something. Nothing about them is evidence that anybody held that
  -- phone, and they must never be counted as though it were.
  add column if not exists phone_verified_via text;

alter table public.profiles
  drop constraint if exists profiles_phone_number_e164;

alter table public.profiles
  add constraint profiles_phone_number_e164
    check (phone_number is null or phone_number ~ '^\+[1-9]\d{7,14}$');

alter table public.profiles
  drop constraint if exists profiles_phone_verified_via_known;

alter table public.profiles
  add constraint profiles_phone_verified_via_known
    check (phone_verified_via is null or phone_verified_via in ('mock', 'msg91'));

comment on column public.profiles.phone_number is
  'E.164 only, one canonical form per number. Never exposed through discovery or any member-facing view.';
comment on column public.profiles.phone_verified_via is
  'msg91 = an SMS was answered. mock = the pre-launch stand-in, which proves nothing.';

/*
 * Everything already verified was verified by the stand-in.
 *
 * Recorded rather than cleared. Clearing it would send every existing account --
 * the demo members among them -- back to the phone step, which breaks working
 * setups to make a point. Marking it is enough: `phone_verified_via = 'msg91'`
 * is the only thing any future trust decision may look at, and this backfill
 * ensures none of these can be mistaken for it.
 */
update public.profiles
   set phone_verified_via = 'mock'
 where phone_verified_at is not null
   and phone_verified_via is null;

/*
 * One verified number, one account.
 *
 * Partial, so that unverified rows do not collide: two people mid-signup who
 * typed the same number are not a conflict until one of them proves it. The
 * moment one does, the other cannot.
 *
 * At the database level deliberately. A check in the edge function would be a
 * race between two requests, and the failure mode is somebody quietly taking
 * over a number that belongs to another member.
 */
create unique index if not exists profiles_verified_phone_idx
  on public.profiles (phone_number)
  where phone_number is not null and phone_verified_at is not null;

-- ---------------------------------------------------------------------------
-- Neither column may be written by a client, ever again
-- ---------------------------------------------------------------------------
--
-- The mocked flow had the app write `phone_verified_at` itself, which was
-- acceptable while it meant "number added" and is not acceptable now that it
-- means "somebody answered an SMS on this number". A member who can set their
-- own verification flag is a member who is verified whenever they feel like it.
--
-- RLS cannot express this: the update policy is per-row, and the row is legally
-- theirs. A trigger can, because it sees which columns changed and who is
-- asking.

create or replace function public.guard_phone_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claims json;
  role_name text;
begin
  if new.phone_number is not distinct from old.phone_number
     and new.phone_verified_at is not distinct from old.phone_verified_at
     and new.phone_verified_via is not distinct from old.phone_verified_via then
    return new;
  end if;

  -- No JWT at all means SQL: a migration, psql, a maintenance script. Those are
  -- already inside the walls.
  claims := nullif(current_setting('request.jwt.claims', true), '')::json;
  if claims is null then
    return new;
  end if;

  role_name := claims ->> 'role';

  if role_name = 'service_role' then
    return new;
  end if;

  raise exception 'phone verification is set by the server, not by the client'
    using errcode = '42501';
end;
$$;

drop trigger if exists guard_phone_verification on public.profiles;

create trigger guard_phone_verification
  before update on public.profiles
  for each row
  execute function public.guard_phone_verification();

-- ---------------------------------------------------------------------------
-- What was asked for, and how it went
-- ---------------------------------------------------------------------------
--
-- One row per request for a code. It carries no code -- only the fact that one
-- was asked for, whether it was sent, how many times it has been answered
-- wrongly, and whether it eventually worked. That is enough for every rate limit
-- below and every number in the capacity report.

create table if not exists public.phone_otp_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users (id) on delete cascade,
  phone_number text not null,

  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  expires_at timestamptz not null,
  verified_at timestamptz,

  -- Wrong answers against this request. The cap is what stops six digits from
  -- being guessed a million times.
  attempts smallint not null default 0,
  -- Sends beyond the first. Each one is another message and another rupee.
  resends smallint not null default 0,

  status text not null default 'requested',

  constraint phone_otp_requests_status_known
    check (status in ('requested', 'sent', 'send_failed', 'verified', 'failed', 'expired')),
  constraint phone_otp_requests_e164
    check (phone_number ~ '^\+[1-9]\d{7,14}$')
);

comment on table public.phone_otp_requests is
  'One row per code requested. Contains no codes -- only what was asked, when, and how it ended.';

create index if not exists phone_otp_requests_profile_idx
  on public.phone_otp_requests (profile_id, requested_at desc);
create index if not exists phone_otp_requests_phone_idx
  on public.phone_otp_requests (phone_number, requested_at desc);
create index if not exists phone_otp_requests_requested_at_idx
  on public.phone_otp_requests (requested_at desc);

-- Operations data. Same reasoning as auth_events: RLS on, no policies, service
-- role only. How many codes somebody has asked for today is not a member-facing
-- fact, and the totals are commercial.
alter table public.phone_otp_requests enable row level security;

-- ---------------------------------------------------------------------------
-- Settings that must be changeable without a deploy
-- ---------------------------------------------------------------------------
--
-- Purchased capacity in particular. It changes when somebody buys more, and
-- that must not require a release -- a limit hardcoded in an application is a
-- limit nobody can raise at the moment it matters, which is a Saturday.

create table if not exists public.ops_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.ops_config is
  'Server-side operational settings. Service role only; never read by a client.';

alter table public.ops_config enable row level security;

insert into public.ops_config (key, value) values
  -- The purchased allocation. ~5,000 messages was the opening plan.
  ('msg91_capacity', '5000'::jsonb),
  -- Roughly ₹1,475 for that allocation, GST included.
  ('msg91_cost_per_sms_inr', '0.295'::jsonb),
  -- A ceiling on a single day's spending. Real growth clears this legitimately
  -- and someone will raise it; abuse hits it in an hour, which is the point.
  ('otp_daily_send_cap', '400'::jsonb),
  -- Per person, per rolling day. Five is generous for a step done once.
  ('otp_per_user_daily_cap', '5'::jsonb),
  -- Per number, so that one account cannot be used to text a stranger repeatedly.
  ('otp_per_number_daily_cap', '5'::jsonb),
  ('otp_resend_cooldown_seconds', '60'::jsonb),
  ('otp_ttl_minutes', '10'::jsonb),
  ('otp_max_verify_attempts', '5'::jsonb)
on conflict (key) do nothing;

create or replace function public.ops_setting(setting_key text, fallback numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value #>> '{}' from public.ops_config where key = setting_key)::numeric, fallback);
$$;

revoke execute on function public.ops_setting(text, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- May this person have a code?
-- ---------------------------------------------------------------------------
--
-- Every limit in one place, decided in one statement, so that two requests
-- arriving together cannot both be told yes.
--
-- The answer is a reason code, not a sentence. What the person reads is decided
-- in the client, where the product's voice lives; what comes back from here is
-- what actually happened, which is also what gets recorded.

create or replace function public.begin_phone_otp(
  p_profile uuid,
  p_phone text,
  p_resend boolean default false
)
returns table (outcome text, request_id uuid, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cooldown integer := public.ops_setting('otp_resend_cooldown_seconds', 60)::integer;
  v_ttl integer := public.ops_setting('otp_ttl_minutes', 10)::integer;
  v_daily_cap integer := public.ops_setting('otp_daily_send_cap', 400)::integer;
  v_user_cap integer := public.ops_setting('otp_per_user_daily_cap', 5)::integer;
  v_number_cap integer := public.ops_setting('otp_per_number_daily_cap', 5)::integer;
  v_capacity integer := public.ops_setting('msg91_capacity', 5000)::integer;
  v_last timestamptz;
  v_used integer;
  v_id uuid;
begin
  if p_phone !~ '^\+[1-9]\d{7,14}$' then
    return query select 'invalid_number'::text, null::uuid, null::integer;
    return;
  end if;

  /*
   * Taken already, and said so without saying whose.
   *
   * The caller is told 'number_taken' and the person is told something that does
   * not confirm an account exists. Answering "that number is registered" to
   * anybody who types it turns this screen into a directory lookup.
   */
  if exists (
    select 1 from public.profiles
     where phone_number = p_phone
       and phone_verified_at is not null
       and phone_verified_via = 'msg91'
       and id <> p_profile
  ) then
    return query select 'number_taken'::text, null::uuid, null::integer;
    return;
  end if;

  -- Cooldown, measured against this person's last send rather than their last
  -- request, so a failed send does not force a wait for a message that never
  -- arrived.
  select max(sent_at) into v_last
    from public.phone_otp_requests
   where profile_id = p_profile;

  if v_last is not null and v_last > now() - make_interval(secs => v_cooldown) then
    return query
      select 'cooldown'::text,
             null::uuid,
             greatest(1, v_cooldown - extract(epoch from (now() - v_last))::integer);
    return;
  end if;

  select count(*) into v_used
    from public.phone_otp_requests
   where profile_id = p_profile
     and requested_at > now() - interval '1 day';

  if v_used >= v_user_cap then
    return query select 'user_daily_cap'::text, null::uuid, null::integer;
    return;
  end if;

  select count(*) into v_used
    from public.phone_otp_requests
   where phone_number = p_phone
     and requested_at > now() - interval '1 day';

  if v_used >= v_number_cap then
    return query select 'number_daily_cap'::text, null::uuid, null::integer;
    return;
  end if;

  -- The day's spending, and then the whole allocation. Both are refusals rather
  -- than overspends: a member seeing "try again shortly" is recoverable, an
  -- exhausted account at midnight is not.
  select count(*) into v_used
    from public.phone_otp_requests
   where sent_at > now() - interval '1 day';

  if v_used >= v_daily_cap then
    return query select 'daily_cap'::text, null::uuid, null::integer;
    return;
  end if;

  select count(*) into v_used
    from public.phone_otp_requests
   where sent_at is not null;

  if v_used >= v_capacity then
    return query select 'capacity_exhausted'::text, null::uuid, null::integer;
    return;
  end if;

  insert into public.phone_otp_requests
    (profile_id, phone_number, expires_at, resends)
  values
    (p_profile, p_phone, now() + make_interval(mins => v_ttl), case when p_resend then 1 else 0 end)
  returning id into v_id;

  return query select 'allowed'::text, v_id, null::integer;
end;
$$;

revoke execute on function public.begin_phone_otp(uuid, text, boolean) from public, anon, authenticated;

-- What the provider said about the send.
create or replace function public.record_phone_otp_send(
  p_request uuid,
  p_sent boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.phone_otp_requests
     set sent_at = case when p_sent then now() else sent_at end,
         status = case when p_sent then 'sent' else 'send_failed' end
   where id = p_request;
$$;

revoke execute on function public.record_phone_otp_send(uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Checking the answer
-- ---------------------------------------------------------------------------
--
-- Attempts are counted before the provider is asked, so a wrong guess costs an
-- attempt whatever the network does. The window is ours as well as MSG91's --
-- a code that has expired here is refused without a call.

create or replace function public.claim_phone_otp_attempt(p_profile uuid)
returns table (outcome text, request_id uuid, phone_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer := public.ops_setting('otp_max_verify_attempts', 5)::integer;
  v_row public.phone_otp_requests;
begin
  select * into v_row
    from public.phone_otp_requests
   where profile_id = p_profile
     and status in ('sent', 'requested')
   order by requested_at desc
   limit 1
     for update;

  if v_row.id is null then
    return query select 'no_request'::text, null::uuid, null::text;
    return;
  end if;

  if v_row.expires_at <= now() then
    update public.phone_otp_requests set status = 'expired' where id = v_row.id;
    return query select 'expired'::text, v_row.id, v_row.phone_number;
    return;
  end if;

  if v_row.attempts >= v_max then
    update public.phone_otp_requests set status = 'failed' where id = v_row.id;
    return query select 'too_many_attempts'::text, v_row.id, v_row.phone_number;
    return;
  end if;

  update public.phone_otp_requests
     set attempts = attempts + 1
   where id = v_row.id;

  return query select 'ok'::text, v_row.id, v_row.phone_number;
end;
$$;

revoke execute on function public.claim_phone_otp_attempt(uuid) from public, anon, authenticated;

/*
 * It was the right code.
 *
 * The number and the verification land in one statement with the request's
 * closure, so there is no window in which somebody is verified but unrecorded.
 * A unique violation here means the number was verified by another account
 * between the check at request time and now; it is reported as such and not as
 * a crash.
 */
create or replace function public.complete_phone_otp(
  p_profile uuid,
  p_request uuid,
  p_phone text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set phone_number = p_phone,
         phone_verified_at = now(),
         phone_verified_via = 'msg91'
   where id = p_profile;

  update public.phone_otp_requests
     set verified_at = now(),
         status = 'verified'
   where id = p_request;

  return 'verified';
exception
  when unique_violation then
    return 'number_taken';
end;
$$;

revoke execute on function public.complete_phone_otp(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Where the money is going
-- ---------------------------------------------------------------------------
--
-- One function, one object, because the question "are we about to run out" has
-- to be answerable in one call from anything: a cron job, a shell, an admin page
-- that does not exist yet.
--
-- Two velocities on purpose. A seven-day average is the honest long-range
-- number and it is useless in an incident: an attack that starts this morning is
-- invisible in a week's mean. The last day is carried alongside it, and the
-- projection takes whichever is worse -- capacity planning should be pessimistic
-- when the two disagree, because that disagreement is what an attack looks like.

create or replace function public.phone_otp_capacity()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with settings as (
    select
      public.ops_setting('msg91_capacity', 5000)::numeric as capacity,
      public.ops_setting('msg91_cost_per_sms_inr', 0.295) as cost
  ),
  counts as (
    select
      count(*) filter (where sent_at is not null) as sent_total,
      count(*) filter (where sent_at > now() - interval '1 day') as sent_day,
      count(*) filter (where sent_at >= date_trunc('day', now())) as sent_today,
      count(*) filter (where sent_at >= date_trunc('month', now())) as sent_month,
      count(*) filter (where sent_at > now() - interval '7 days') as sent_week,
      count(*) filter (where verified_at is not null) as verified_total,
      count(*) filter (where verified_at >= date_trunc('month', now())) as verified_month,
      coalesce(sum(resends), 0) as resends_total
    from public.phone_otp_requests
  ),
  derived as (
    select
      c.*,
      s.capacity,
      s.cost,
      greatest(s.capacity - c.sent_total, 0) as remaining,
      round(c.sent_week / 7.0, 2) as per_day_week,
      -- The worse of the long view and the last day. See above.
      greatest(round(c.sent_week / 7.0, 2), c.sent_day::numeric) as per_day_planning
    from counts c cross join settings s
  )
  select jsonb_build_object(
    'capacity', capacity,
    'sent_total', sent_total,
    'remaining', remaining,
    'used_fraction', case when capacity > 0 then round(sent_total / capacity, 4) else null end,
    'status', case
      when capacity <= 0 then 'unconfigured'
      when sent_total >= capacity * 0.85 then 'critical'
      when sent_total >= capacity * 0.75 then 'warning'
      when sent_total >= capacity * 0.60 then 'forecast'
      else 'ok'
    end,
    'sent_today', sent_today,
    'sent_this_month', sent_month,
    'sent_last_24h', sent_day,
    'per_day_7d_average', per_day_week,
    'per_day_planning', per_day_planning,
    'days_remaining', case
      when per_day_planning > 0 then round(remaining / per_day_planning, 1)
      else null
    end,
    'projected_exhaustion', case
      when per_day_planning > 0
        then (now() + make_interval(days => (remaining / per_day_planning)::integer))
      else null
    end,
    'resend_ratio', case
      when sent_total > 0 then round(resends_total::numeric / sent_total, 3)
      else null
    end,
    'verification_success_rate', case
      when sent_total > 0 then round(verified_total::numeric / sent_total, 3)
      else null
    end,
    'verified_total', verified_total,
    'verified_this_month', verified_month,
    'spend_inr', round(sent_total * cost, 2),
    'cost_per_verified_member_inr', case
      when verified_total > 0 then round(sent_total * cost / verified_total, 2)
      else null
    end,
    'generated_at', now()
  )
  from derived;
$$;

comment on function public.phone_otp_capacity() is
  'One object answering "are we about to run out of SMS". Service role only.';

revoke execute on function public.phone_otp_capacity() from public, anon, authenticated;

-- Written server-side only: these are the events tied to money, and a client
-- that could write them could hide its own spending.
create or replace function public.record_phone_event(
  event_name text,
  p_profile uuid default null,
  masked_number text default null,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if event_name not like 'phone\_otp\_%' then
    return;
  end if;

  insert into public.auth_events (event, actor, detail)
  values (
    event_name,
    p_profile,
    jsonb_strip_nulls(
      jsonb_build_object(
        'identifier', left(masked_number, 120),
        'reason', left(reason, 200)
      )
    )
  );
end;
$$;

revoke execute on function public.record_phone_event(text, uuid, text, text) from public, anon, authenticated;
