-- Two new event names: `google_auth_requested` and `facebook_auth_requested`.
--
-- Why this exists.
--
-- On 2026-11-25, auditing the 22-24 November signup spike, `auth_events` held
-- three `facebook_auth_success` rows -- and `auth.identities` held no Facebook
-- identity at all. Nobody has ever completed a Facebook sign-in. The reason the
-- contradiction survived unnoticed is that the web app recorded
-- `facebook_auth_success` at the moment it handed the browser off to Facebook,
-- before Facebook had said anything, with `reason = 'handoff'` as the only hint
-- that the word "success" was not meant literally.
--
-- That is the same mistake as a trust mark for something Eraya has not checked:
-- a success Eraya did not witness. A handoff is a handoff, so it gets its own
-- name, and `*_auth_success` goes back to meaning a session exists.
--
-- Email already had this shape -- `email_auth_requested`, then success or
-- failure. The providers now match it, which is also what makes the funnel
-- legible: `requested` far exceeding `success + failure` means people are
-- leaving for the provider and never coming back, which is a diagnosis no
-- single event could give.
--
-- Additive only. No existing row is touched and no existing name is withdrawn,
-- so the three historical `facebook_auth_success` rows stay exactly as they
-- are. They are still evidence -- of what the old code recorded, which is the
-- point.

alter table public.auth_events
  drop constraint auth_events_known_event;

alter table public.auth_events
  add constraint auth_events_known_event check (
    event in (
      'email_auth_requested',
      'email_auth_success',
      'email_auth_failure',
      'google_auth_requested',
      'google_auth_success',
      'google_auth_failure',
      'facebook_auth_requested',
      'facebook_auth_success',
      'facebook_auth_failure',
      'phone_otp_requested',
      'phone_otp_sent',
      'phone_otp_send_failed',
      'phone_otp_verified',
      'phone_otp_verification_failed',
      'phone_otp_resent'
    )
  );

-- The client-facing allowlist has to learn the names too, or the two new events
-- are silently dropped by the very function meant to record them.
--
-- Unchanged from the original in every other respect: `phone_otp_` is still
-- refused outright because those are tied to money and are written server-side
-- with the service role, `actor` is still taken from the token rather than from
-- the caller, and `detail` is still capped and fixed-key so it cannot be used
-- as free storage.

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
    'google_auth_requested',
    'google_auth_success',
    'google_auth_failure',
    'facebook_auth_requested',
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

-- `create or replace` keeps the existing privileges, but they are restated
-- because this file has to be readable on its own: `create function` grants
-- EXECUTE to PUBLIC and anon inherits it, so revoking from anon alone does
-- nothing -- see CLAUDE.md.
revoke execute on function public.record_auth_event(text, text, text) from public, anon, authenticated;

-- Both roles, deliberately. A failed sign-in is recorded by somebody who is not
-- signed in, and that failure is the most interesting one there is. This is now
-- load-bearing in a second place: `/auth/callback` records the outcome of an
-- OAuth round trip, and on the failure path there is by definition no session.
grant execute on function public.record_auth_event(text, text, text) to anon, authenticated;
