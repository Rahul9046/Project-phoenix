-- What happened during authentication, and how much of it.
--
-- Two jobs, and they justify each other. The first is diagnosis: an
-- authentication failure that nobody can see is a support conversation that
-- cannot be had. The second is money -- SMS costs real rupees per message, and
-- the way that goes wrong is not a bill, it is a member being told "we could not
-- send your code" because capacity ran out while nobody was counting.
--
-- What is deliberately NOT here:
--
--   No OTP values, ever. The code lives at the provider and in somebody's
--   message list, and nowhere else. A ledger that stores codes is a ledger that
--   can be read to sign in as somebody.
--
--   No tokens, no provider secrets, no full phone numbers or addresses. `detail`
--   is for a masked identifier and a reason, not for a copy of the payload.
--
-- Rows are never updated. This is an append-only account of things that already
-- happened, which is what makes it usable as evidence later.

create table public.auth_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),

  -- The names are constrained rather than free text. A metric spelled two ways
  -- is two metrics, and the first anybody notices is when a chart reads zero.
  event text not null,

  /*
   * Who, when there is a who.
   *
   * Null is normal and not a defect: a failed sign-in has no authenticated user
   * by definition. `on delete set null` keeps the count honest when somebody
   * deletes their account -- the event still happened, it simply stops being
   * attributable, which is the correct outcome for a deletion.
   */
  actor uuid references auth.users (id) on delete set null,

  /*
   * Masked identifiers and a reason. Never a raw address or number.
   *
   * The convention is `r****l@gmail.com` and `+91XXXXX43210`: enough to match a
   * support conversation to a row, not enough to be a contact list if this table
   * is ever read by somebody who should not have it.
   */
  detail jsonb not null default '{}'::jsonb,

  constraint auth_events_known_event check (
    event in (
      'email_auth_requested',
      'email_auth_success',
      'email_auth_failure',
      'google_auth_success',
      'google_auth_failure',
      'facebook_auth_success',
      'facebook_auth_failure',
      'phone_otp_requested',
      'phone_otp_sent',
      'phone_otp_send_failed',
      'phone_otp_verified',
      'phone_otp_verification_failed',
      'phone_otp_resent'
    )
  )
);

comment on table public.auth_events is
  'Append-only record of authentication activity. Never contains codes, tokens or unmasked contact details.';

-- Every question asked of this table is "what happened recently", usually for
-- one event name.
create index auth_events_occurred_at_idx
  on public.auth_events (occurred_at desc);
create index auth_events_event_occurred_at_idx
  on public.auth_events (event, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Nobody reads this but the service role.
-- ---------------------------------------------------------------------------
--
-- RLS on with no policies at all is the strongest statement available: every
-- ordinary client, signed in or not, gets nothing -- no select, no insert, no
-- update, no delete. The service role bypasses RLS and is the only thing that
-- reads it.
--
-- This is operations data. It says how many people failed to sign in this
-- morning and how close the SMS budget is to running out, and neither is a
-- member's business.

alter table public.auth_events enable row level security;

-- ---------------------------------------------------------------------------
-- The one thing a client may do: record its own outcome.
-- ---------------------------------------------------------------------------
--
-- Email and OAuth happen between the client and Supabase, with no server of
-- ours in the middle, so the client is the only witness to whether they worked.
-- This function is how it testifies, and it is written on the assumption that
-- the witness may be lying:
--
--   Only the events a client could legitimately observe are accepted. Anything
--   beginning `phone_otp_` is refused outright -- those are written by the edge
--   functions with the service role, and they are the ones tied to money.
--
--   `actor` is taken from the token, never from the caller's argument.
--
--   `detail` is capped and its keys are fixed, so it cannot be used as free
--   storage or as a way to smuggle a code into the table.
--
-- The worst a hostile client achieves is inflating counts of events that cost
-- nothing. That is worth accepting to get real numbers from real sign-ins.

create or replace function public.record_auth_event(
  event_name text,
  masked_identifier text default null,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if event_name not in (
    'email_auth_requested',
    'email_auth_success',
    'email_auth_failure',
    'google_auth_success',
    'google_auth_failure',
    'facebook_auth_success',
    'facebook_auth_failure'
  ) then
    -- Silent rather than an error. A client that asks for something it may not
    -- have should not learn what else exists, and an authentication screen must
    -- never fail because its metrics did.
    return;
  end if;

  insert into public.auth_events (event, actor, detail)
  values (
    event_name,
    (select auth.uid()),
    jsonb_strip_nulls(
      jsonb_build_object(
        'identifier', left(masked_identifier, 120),
        'reason', left(reason, 200)
      )
    )
  );
end;
$$;

comment on function public.record_auth_event(text, text, text) is
  'Client-reported authentication outcome. Accepts only events a client can witness; phone OTP events are written server-side.';

-- `create function` grants EXECUTE to PUBLIC, and anon inherits it. Revoking
-- from anon alone does nothing -- see CLAUDE.md.
revoke execute on function public.record_auth_event(text, text, text) from public, anon, authenticated;

-- Both roles, deliberately. A failed sign-in is recorded by somebody who is not
-- signed in, and that failure is the most interesting one there is.
grant execute on function public.record_auth_event(text, text, text) to anon, authenticated;
