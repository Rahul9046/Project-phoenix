-- A reservation nobody used must not be waiting to absorb somebody's next send.
--
-- `confirm_phone_otp_send` closes the caller's most recent open reservation,
-- which is the right row every time. What the first version did not consider is
-- what happens to the ones behind it. A member whose widget failed to load,
-- then tried again, leaves two rows `requested`; the send that follows closes
-- the newer, and the older sits there indefinitely, still open, still fresh
-- enough to be found.
--
-- `npm run phone:probe` caught it on the idempotency check, which is the cheap
-- way to have found it. Confirming twice -- a client retrying a request whose
-- response was lost, which is an ordinary thing for a browser on a bad
-- connection to do -- counted two sends for one message, because the second
-- call found the abandoned reservation and closed that instead of reporting
-- that there was nothing to close. The cost lands on the member: an allowance
-- of five spent at two a time.
--
-- So an abandoned reservation is now retired at the moment it is superseded. It
-- was never sent and never will be, `expired` says exactly that, and it keeps
-- no `sent_at` -- so it goes on counting as the attempt it was and against no
-- spending limit at all. What it stops being is a row a later call can mistake
-- for a live one.

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
  v_requested_at timestamptz;
begin
  select id, requested_at into v_id, v_requested_at
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

  /*
   * And everything older that was still open is retired with it. Bounded to
   * this profile and to rows strictly older than the one just closed, so a
   * request opened concurrently by the same member is never swept up by it.
   */
  update public.phone_otp_requests
     set status = 'expired'
   where profile_id = p_profile
     and status = 'requested'
     and requested_at < v_requested_at;

  return case when p_sent then 'confirmed' else 'recorded' end;
end;
$$;

comment on function public.confirm_phone_otp_send(uuid, boolean) is
  'Closes the caller''s own most recent open reservation after the browser widget reported MSG91 accepting or refusing the send, and retires any older open reservation so it cannot absorb a later confirmation. Takes no request id, so it cannot reach another account''s row.';

revoke execute on function public.confirm_phone_otp_send(uuid, boolean)
  from public, anon, authenticated;
