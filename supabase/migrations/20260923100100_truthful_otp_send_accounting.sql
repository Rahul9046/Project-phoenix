-- What counts as an OTP send, and what merely counts as asking.
--
-- The limits in `20260905120100_real_phone_verification.sql` were written for
-- one client. On the app, Eraya calls MSG91 itself, so `phone-otp-request`
-- knows whether a message was accepted and writes `sent_at` accordingly. On the
-- web, MSG91's widget sends from the browser and `phone-widget-begin`
-- deliberately left every row `requested` with `sent_at` null, because the
-- server genuinely did not know.
--
-- The consequence was not noticed for eighteen days. Three of the five limits
-- read `sent_at`: the sixty-second resend cooldown, the daily spend cap and the
-- purchased-capacity ceiling. On the web all three read as though nothing had
-- ever been sent, permanently -- the cooldown never fired, and the two limits
-- that exist to bound money never counted a single message. The one limit that
-- did work, the per-account daily cap, read `requested_at`, so it counted
-- *widget openings*: a captcha abandoned, a tab closed, a send MSG91 refused,
-- each consumed a member's daily allowance for twenty-four hours exactly as if
-- a code had arrived.
--
-- This migration separates the two ideas that were being conflated.
--
--   An *attempt* is a member asking. It creates a reservation row and is free
--   of the send caps, because nothing has been spent yet.
--
--   A *send* is the provider accepting the message. It is recorded afterwards,
--   by whichever client is in a position to know, and it is what every spending
--   limit and the cooldown now count.
--
-- What the server can honestly claim is different on the two clients, and this
-- file does not pretend otherwise. The app's `sent_at` is MSG91's own answer to
-- Eraya's server. The web's is the browser reporting that MSG91's widget
-- invoked its success callback -- the closest provider-confirmed point that
-- exists when the provider is talking to the browser and not to us. It is
-- written through `confirm_phone_otp_send` below, which takes no request id
-- from the caller and can only ever close the caller's own open reservation.
--
-- The honest limit of that: a modified client can decline to report a send and
-- so avoid the send caps. It cannot become verified that way, and it was always
-- able to open the widget without asking us at all -- `phone-widget-begin` has
-- been a gate rather than a wall since it was written. What bounds that client
-- is the attempt ceiling added here, which counts reservations and needs no
-- cooperation from anybody.

-- ---------------------------------------------------------------------------
-- The attempt ceiling
-- ---------------------------------------------------------------------------
--
-- Deliberately looser than the send cap rather than equal to it. Its job is to
-- bound a client that never reports, not to ration an honest member: somebody
-- whose captcha fails twice and whose network drops once should still have
-- every one of their five codes. Two attempts per send is the room that buys.

insert into public.ops_config (key, value) values
  ('otp_per_user_daily_attempt_cap', '10'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Recording a send the browser made
-- ---------------------------------------------------------------------------
--
-- The web counterpart of `record_phone_otp_send`, and deliberately not the same
-- function. That one takes a request id, which is correct when the caller is
-- `phone-otp-request` holding an id it created moments earlier in the same
-- server-side breath, and would be an identifier-shaped hole if the id arrived
-- from a browser: the service role would happily close a row belonging to
-- somebody else.
--
-- So this one takes no id. It finds the caller's own most recent open
-- reservation and closes that, which is the only row a browser could honestly
-- be talking about. Nothing else is reachable from here.
--
-- Idempotent by construction. A second call finds no row still `requested` --
-- the first call moved it to `sent` -- and returns `no_request` without
-- counting anything twice. A client retrying a flaky network cannot inflate its
-- own usage, and could only ever inflate its own.
--
-- Fifteen minutes, rather than the code's ten-minute life, because the window
-- being bounded here is the gap between asking MSG91 and hearing back from it,
-- and a slow captcha sits inside that gap. A reservation older than this was
-- not the one the browser just sent.

create or replace function public.confirm_phone_otp_send(
  p_profile uuid,
  p_sent boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from public.phone_otp_requests
   where profile_id = p_profile
     and status = 'requested'
     and requested_at > now() - interval '15 minutes'
   order by requested_at desc
   limit 1
     for update;

  if v_id is null then
    return 'no_request';
  end if;

  /*
   * A failure is recorded as a failure rather than left open. `send_failed`
   * carries no `sent_at`, so it counts against no spending limit and against no
   * cooldown -- which is the whole point: a member must not lose a code to a
   * message that was never sent. It still counts as an attempt, because it was
   * one.
   */
  update public.phone_otp_requests
     set sent_at = case when p_sent then now() else sent_at end,
         status  = case when p_sent then 'sent' else 'send_failed' end
   where id = v_id;

  return case when p_sent then 'confirmed' else 'recorded' end;
end;
$$;

comment on function public.confirm_phone_otp_send(uuid, boolean) is
  'Closes the caller''s own open reservation after the browser widget reported MSG91 accepting or refusing the send. Takes no request id, so it cannot reach another account''s row.';

revoke execute on function public.confirm_phone_otp_send(uuid, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- May this person have a code?
-- ---------------------------------------------------------------------------
--
-- Same shape, same statuses, same order of refusals as before. What changed is
-- which column three of the counts read, and one new ceiling at the end.
--
-- The order is still load-bearing and still worth stating: `number_taken` is
-- answered before anything is metered, so a refusal there costs the caller
-- nothing -- noted in `phone-widget-begin` as the thing to change if that trade
-- is ever revisited.

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
  v_attempt_cap integer := public.ops_setting('otp_per_user_daily_attempt_cap', 10)::integer;
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
   * Taken already. Unchanged, including the unique index behind it: one
   * verified number belongs to one account, and that is decided here and again
   * in `complete_phone_otp` for the race between them.
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

  /*
   * The cooldown, unchanged in its reading of `sent_at` and transformed in
   * effect, because `sent_at` is now written on both clients. It was never
   * wrong -- it was measuring against a column one client never filled in, so
   * the branch was simply unreachable there. Measured against the last *send*
   * rather than the last request, so a send that failed does not make somebody
   * wait for a message that never arrived.
   */
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

  -- Sends, per person and per number, over a rolling day. `sent_at` rather than
  -- `requested_at`: five codes a day means five codes, not five times a widget
  -- was opened.
  select count(*) into v_used
    from public.phone_otp_requests
   where profile_id = p_profile
     and sent_at > now() - interval '1 day';

  if v_used >= v_user_cap then
    return query select 'user_daily_cap'::text, null::uuid, null::integer;
    return;
  end if;

  select count(*) into v_used
    from public.phone_otp_requests
   where phone_number = p_phone
     and sent_at > now() - interval '1 day';

  if v_used >= v_number_cap then
    return query select 'number_daily_cap'::text, null::uuid, null::integer;
    return;
  end if;

  /*
   * And the ceiling on asking, which is what the send caps above cost.
   *
   * Counting sends is the truthful thing to do and it hands a modified client a
   * way to be quiet about them. This is the answer to that: reservations are
   * counted whatever anybody reports, so the number of times a browser can be
   * told "go ahead" is bounded even if it never comes back. Reached before the
   * send caps only by somebody failing repeatedly, which is why the sentence it
   * maps to talks about attempts rather than codes.
   */
  select count(*) into v_used
    from public.phone_otp_requests
   where profile_id = p_profile
     and requested_at > now() - interval '1 day';

  if v_used >= v_attempt_cap then
    return query select 'user_attempt_cap'::text, null::uuid, null::integer;
    return;
  end if;

  -- The day's spending, and then the whole allocation. Both now see web sends
  -- as well as app ones, which is the repair that matters commercially: these
  -- two have been counting zero on the web since the widget went live.
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

revoke execute on function public.begin_phone_otp(uuid, text, boolean)
  from public, anon, authenticated;

/*
 * Nothing is backfilled, and that is a decision rather than an omission.
 *
 * Every web row written before today carries `sent_at` null and status
 * `requested`, and some of them were real messages -- we simply never recorded
 * them. Writing a `sent_at` now would be inventing a timestamp for an event
 * nobody observed, in the one table whose whole purpose is to say what actually
 * happened. They stay as they are: counted as the attempts they certainly were,
 * not as sends they may or may not have been, and out of the rolling window
 * within a day of themselves either way.
 */
