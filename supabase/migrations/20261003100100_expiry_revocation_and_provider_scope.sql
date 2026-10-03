-- Making the money model safe to point at real rupees.
--
-- Four things, and each one is a thing that would cost somebody money or
-- credibility the first week a live key existed.
--
--   A term that has run out stops entitling, everywhere. It already did in
--   `my_membership_for`, and nowhere else. Three other readers decided premium
--   from `status` alone -- and since nothing in this project has ever written
--   `expired`, a lapsed term sat at `active` indefinitely and kept granting.
--
--   Premium advertises only what Premium does. Two of the three benefits sold
--   on both clients had no implementation anywhere. They are withdrawn here
--   rather than invented in a hurry.
--
--   A payment's grant can be taken back. Nothing in this system could shorten
--   or end a term, for any reason -- not a refund, not a chargeback, not a
--   mistake -- because until now money only ever moved one way.
--
--   An order is looked up by provider *and* id. The uniqueness model has
--   always been `(provider, provider_order_id)`; the lookup was not, which is
--   inert with one provider and wrong with two.
--
-- Nothing here changes a price, adds a renewal, or grants anybody anything.
-- Every function below stays revoked from `public`, `anon` and `authenticated`:
-- a client cannot settle a payment and cannot revoke one either.

-- ---------------------------------------------------------------------------
-- One answer to "is this member premium right now"
-- ---------------------------------------------------------------------------
--
-- The drift this migration exists to fix happened because the rule was written
-- out four times. Three copies forgot the date. So the rule gets one home, and
-- the callers ask it rather than restating it.
--
-- `current_period_end > now()` is the whole point. A nightly job that flips
-- statuses would be a second source of truth, and a job that has not run yet
-- is a member with access they have not paid for -- so correctness must not
-- depend on one, and here it does not.
--
-- `cancelled` is included deliberately, as it has been since the enum was
-- written: cancelling stops a renewal, it does not refund the current term.
-- `pending` is excluded, equally deliberately -- it records intent and nothing
-- more, and honouring it would be granting premium for free.

create or replace function public.has_active_premium(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.subscriptions s
      join public.membership_plans mp on mp.id = s.plan_id
     where s.profile_id = p_profile
       and mp.tier = 'premium'
       and s.status in ('trialing', 'active', 'past_due', 'cancelled')
       and s.current_period_end > now()
  );
$$;

comment on function public.has_active_premium(uuid) is
  'Whether a profile holds premium at this moment. The date is the authority, not the status.';

/*
 * Takes an arbitrary profile id, so it stays off the client entirely.
 *
 * A member asking about their own membership has `my_membership()`. This one
 * would answer about anybody, which is a tier-disclosure endpoint nobody asked
 * for. The revoke is from `public` rather than from `anon`: `create function`
 * grants EXECUTE to PUBLIC and `anon` inherits it, so revoking from `anon`
 * alone does nothing. The security-definer callers below run as the owner,
 * which keeps its own privileges regardless.
 */
revoke execute on function public.has_active_premium(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The two readers that kept granting after the money ran out
-- ---------------------------------------------------------------------------
--
-- Recreated from 20260830160400_discovery_v2.sql with one change each: the
-- premium test is now `has_active_premium(...)` instead of an inline status
-- check. Everything else -- the allowance, the daily count, what may be
-- reverted, the insert -- is byte for byte what it was.
--
-- The effect is not theoretical. `revertLimit` is the one entitlement this
-- product actually enforces, so these two functions were the whole of what a
-- lapsed premium member kept.

create or replace function public.revert_last_pass()
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  allowance integer;
  used_today integer;
  target uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  select coalesce(max((e.value)::integer), 3)
    into allowance
  from public.entitlements e
  where e.key = 'revertLimit'
    and e.tier = (
      select case
        when public.has_active_premium(me) then 'premium'::public.membership_tier
        else 'free'::public.membership_tier
      end
    );

  select count(*)::integer into used_today
  from public.member_reverts r
  where r.profile_id = me
    and r.created_at >= date_trunc('day', now());

  if used_today >= allowance then
    return null;
  end if;

  -- The most recent pass, and only a pass.
  select i.to_id into target
  from public.member_interests i
  where i.from_id = me
    and i.kind = 'passed'
  order by i.created_at desc
  limit 1;

  if target is null then
    return null;
  end if;

  delete from public.member_interests
   where from_id = me and to_id = target;

  insert into public.member_reverts (profile_id, reverted_id)
  values (me, target);

  return target;
end;
$$;

/** How many reverts are left today, for the client to show honestly. */
create or replace function public.reverts_remaining()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0,
    coalesce((
      select max((e.value)::integer) from public.entitlements e
      where e.key = 'revertLimit'
        and e.tier = (
          select case
            when public.has_active_premium((select auth.uid())) then 'premium'::public.membership_tier
            else 'free'::public.membership_tier
          end
        )
    ), 3)
    - (
      select count(*)::integer from public.member_reverts r
      where r.profile_id = (select auth.uid())
        and r.created_at >= date_trunc('day', now())
    )
  );
$$;

-- `create or replace` keeps existing privileges, but restating them is what
-- makes the rule checkable rather than inherited.
revoke execute on function public.revert_last_pass() from public, anon;
revoke execute on function public.reverts_remaining() from public, anon;
grant execute on function public.revert_last_pass() to authenticated;
grant execute on function public.reverts_remaining() to authenticated;

-- ---------------------------------------------------------------------------
-- Withdrawing two benefits that were never built
-- ---------------------------------------------------------------------------
--
-- `canUseIncognito` and `canUsePriorityVisibility` were seeded, advertised by
-- name on two membership screens and on the public pricing page, and
-- implemented nowhere: no SQL and no TypeScript referenced either key outside
-- the entitlements plumbing itself, and `discover_members` has never carried a
-- tier term, so a paying profile was ordered exactly like a free one.
--
-- Deleted rather than set to false on both tiers, for the same reason
-- `canSeeInteresters` was deleted on 2026-09-20: `loadTierComparison` builds
-- the public pricing table from whatever rows exist, so a false/false row would
-- go on advertising a capability nobody can buy and nobody has.
--
-- This is a withdrawal, not a decision that the features are unwanted. Either
-- one can come back the way any capability arrives here -- two rows and the
-- feature -- and the point of deleting them is that it cannot come back as a
-- row alone.
--
-- `revertLimit` is untouched: free 3, premium 15, and it is the one capability
-- enforced where a client cannot edit it.

delete from public.entitlements
 where key in ('canUseIncognito', 'canUsePriorityVisibility');

-- ---------------------------------------------------------------------------
-- Taking a grant back
-- ---------------------------------------------------------------------------
--
-- One row per payment whose time has been withdrawn. The unique key is the
-- payment, which is what makes revocation idempotent: a provider that sends a
-- refund twice, or a webhook retried after a timeout, finds the payment already
-- revoked and changes nothing.
--
-- Deliberately provider-independent. Nothing here knows what Razorpay is. A
-- refund, a chargeback, a Google Play `VOIDED_PURCHASE` and a mistake somebody
-- is correcting by hand are the same operation on the same primitive, and the
-- only difference between them is the word in `kind`.
--
-- The before and after are both stored. A revocation that cannot be explained
-- afterwards is a support conversation with no evidence in it, and the first
-- question is always "what did this actually do".

create table public.payment_revocations (
  id uuid primary key default gen_random_uuid(),

  -- The payment whose grant is withdrawn. Unique: one revocation per payment,
  -- ever, which is the idempotency key the whole mechanism rests on.
  payment_id uuid not null unique references public.payments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- Copied from the payment so this row can be read without a join, and so it
  -- still says what happened if the catalogue is edited later.
  provider public.payment_provider not null,
  provider_order_id text,
  -- The provider's own id for the reversal: a Razorpay refund id, a Play void.
  -- Null when a human did this rather than a provider.
  provider_reversal_id text,

  kind text not null,
  -- Free text, for whoever reads this in six months. Never shown to a member.
  reason text,
  -- What was returned, when the provider says. Not used to compute anything --
  -- this primitive withdraws a payment's whole grant, and a partial refund is
  -- a product decision nobody has made.
  amount_paise integer,

  -- The term before and after, so the arithmetic is auditable and a mistake is
  -- reversible by hand.
  previous_period_end timestamptz,
  resulting_period_end timestamptz,

  revoked_at timestamptz not null default now(),

  constraint payment_revocations_kind
    check (kind in ('refund', 'chargeback', 'voided', 'manual')),
  constraint payment_revocations_amount_non_negative
    check (amount_paise is null or amount_paise >= 0)
);

comment on table public.payment_revocations is
  'One row per payment whose granted time has been withdrawn. Unique on payment_id, which is what makes revocation idempotent.';
comment on column public.payment_revocations.kind is
  'refund | chargeback | voided | manual. The only thing that differs between providers.';

create index payment_revocations_profile_idx
  on public.payment_revocations (profile_id, revoked_at desc);

/*
 * No policies at all, and RLS on.
 *
 * Not even a select. The member-visible fact is `payments.status`, which
 * `my_payments()` already returns, and that is the whole of what somebody needs
 * to understand their own history. Everything in this table is the provider's
 * reference and our own arithmetic, and a table with no policy is the clearest
 * possible statement that only the service role touches it -- the same stance
 * `subscriptions` has taken since it was written.
 */
alter table public.payment_revocations enable row level security;

-- ---------------------------------------------------------------------------
-- Settlement, now scoped to a provider and refusing to re-grant
-- ---------------------------------------------------------------------------
--
-- Two changes, and the second one is a hole this migration would otherwise have
-- opened.
--
-- The lookup takes a provider. `payments` is unique on
-- `(provider, provider_order_id)` and always has been; matching on the id alone
-- happened to be safe with exactly one provider and stops being safe the moment
-- there are two. Making the argument required rather than defaulted is the
-- point: every caller now has to say which provider it is talking about, so the
-- next one cannot inherit an assumption.
--
-- And a revoked payment can never buy time again. Without this, somebody
-- refunded on Monday could press "check again" on Tuesday: Razorpay still
-- reports the payment as captured, `payments-verify` would reconcile against
-- that record, and `settle_payment` -- seeing a status of `refunded` rather than
-- `paid` -- would fall straight through to the granting path and hand the term
-- back. The early return on `paid` was never enough on its own; it only looked
-- like it was because nothing could set any other terminal status.
--
-- Everything else is unchanged, including the two properties worth not
-- breaking: the row is locked and an already-paid payment returns what it did
-- the first time, and a new term starts from `greatest(now(), current expiry)`
-- so time already paid for is never discarded.

drop function if exists public.settle_payment(text, text, public.payment_status);

create or replace function public.settle_payment(
  p_provider public.payment_provider,
  p_order_id text,
  p_provider_payment_id text,
  p_status public.payment_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_plan public.membership_plans;
  v_live public.subscriptions;
  v_base timestamptz;
  v_end timestamptz;
begin
  select * into v_payment
    from public.payments
   where provider = p_provider
     and provider_order_id = p_order_id
     for update;

  if v_payment.id is null then
    return jsonb_build_object('outcome', 'unknown_order');
  end if;

  /*
   * Withdrawn time is not re-grantable, whatever the provider still says.
   *
   * Checked before the `paid` short-circuit rather than after, so it holds even
   * for a row that was somehow left at `paid` while revoked.
   */
  if exists (
    select 1 from public.payment_revocations where payment_id = v_payment.id
  ) then
    return jsonb_build_object(
      'outcome', 'revoked',
      'payment_id', v_payment.id
    );
  end if;

  -- Already settled. Say what happened rather than doing it again.
  if v_payment.status = 'paid' then
    return jsonb_build_object(
      'outcome', 'already_paid',
      'payment_id', v_payment.id,
      'expires_at', (
        select max(current_period_end) from public.subscriptions
         where profile_id = v_payment.profile_id
      )
    );
  end if;

  if p_status <> 'paid' then
    update public.payments
       set status = p_status,
           provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
           failed_at = case when p_status in ('failed', 'cancelled') then now() else failed_at end
     where id = v_payment.id;

    return jsonb_build_object('outcome', p_status::text, 'payment_id', v_payment.id);
  end if;

  select * into v_plan from public.membership_plans where id = v_payment.plan_id;

  update public.payments
     set status = 'paid',
         provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
         paid_at = now()
   where id = v_payment.id;

  /*
   * The live term, if there is one. Locked, so two settlements arriving
   * together cannot both read the same expiry and each add a month to it --
   * which would quietly lose one of them.
   */
  select * into v_live
    from public.subscriptions
   where profile_id = v_payment.profile_id
     and status in ('pending', 'trialing', 'active', 'past_due')
   order by current_period_end desc nulls last
   limit 1
     for update;

  v_base := greatest(now(), coalesce(v_live.current_period_end, now()));
  v_end := v_base + make_interval(months => v_plan.period_months);

  if v_live.id is null then
    insert into public.subscriptions
      (profile_id, plan_id, status, provider, started_at,
       current_period_start, current_period_end, is_introductory, periods_billed)
    values
      (v_payment.profile_id, v_plan.id, 'active', v_payment.provider, now(),
       now(), v_end, v_payment.intro_offer_applied, 1);
  else
    update public.subscriptions
       set plan_id = v_plan.id,
           status = 'active',
           provider = v_payment.provider,
           started_at = coalesce(started_at, now()),
           current_period_start = coalesce(current_period_start, now()),
           current_period_end = v_end,
           -- The introductory price is a property of a purchase, not of the
           -- term it extends. Once a term has been extended at the ordinary
           -- price, it is no longer an introductory membership.
           is_introductory = v_payment.intro_offer_applied,
           periods_billed = periods_billed + 1,
           cancel_at = null,
           cancelled_at = null,
           ended_at = null
     where id = v_live.id;
  end if;

  return jsonb_build_object(
    'outcome', 'paid',
    'payment_id', v_payment.id,
    'expires_at', v_end,
    'intro_offer_applied', v_payment.intro_offer_applied
  );
end;
$$;

revoke execute on function public.settle_payment(public.payment_provider, text, text, public.payment_status)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The revocation primitive
-- ---------------------------------------------------------------------------
--
-- Withdraws exactly what one payment granted, and nothing else.
--
-- The stacking rule is the hard part and the reason this subtracts rather than
-- rebuilds. A member's term is the accumulation of every payment they have
-- made: one month bought on the 1st and three months bought on the 5th are a
-- single row ending four months out, not two rows. So "revoke the one-month
-- payment" cannot mean "end the term" -- that would destroy three months
-- somebody paid for and did not get back -- and it cannot mean "recompute from
-- the surviving payments" either, because that rebuilds a live term from
-- derived history and would quietly erase anything granted by hand.
--
-- It means: take back the months this payment added. `current_period_end` minus
-- the plan's `period_months`. Whatever the other payments bought is still
-- there, and the subtraction is the exact inverse of the addition
-- `settle_payment` performed.
--
-- Calendar arithmetic is not perfectly associative -- 31 January plus one month
-- minus one month is 28 January, not the 31st -- so a term that straddles a
-- short month can land a day or two from where a full replay would put it. That
-- is accepted, and in exchange nothing can destroy a purchase it was not asked
-- to touch. Bounded by a couple of days, in the member's favour as often as not.
--
-- Idempotent by the unique index on `payment_id`, and serialised by the `for
-- update` on the payment row: of two refunds arriving together, one revokes and
-- the other is told what the first did.

create or replace function public.revoke_payment(
  p_provider public.payment_provider,
  p_order_id text,
  p_kind text,
  p_reason text default null,
  p_reversal_id text default null,
  p_amount_paise integer default null,
  p_status public.payment_status default 'refunded'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_existing public.payment_revocations;
  v_months integer;
  v_sub public.subscriptions;
  v_previous timestamptz;
  v_floor timestamptz;
  v_new timestamptz;
begin
  if p_kind not in ('refund', 'chargeback', 'voided', 'manual') then
    raise exception 'unknown revocation kind: %', p_kind using errcode = '22023';
  end if;

  -- The lock is the mutex for everything below, exactly as it is in
  -- `settle_payment`. The unique index is the backstop, not the mechanism.
  select * into v_payment
    from public.payments
   where provider = p_provider
     and provider_order_id = p_order_id
     for update;

  if v_payment.id is null then
    return jsonb_build_object('outcome', 'unknown_order');
  end if;

  -- Already done. Report what the first call did rather than doing it again.
  select * into v_existing
    from public.payment_revocations
   where payment_id = v_payment.id;

  if v_existing.id is not null then
    return jsonb_build_object(
      'outcome', 'already_revoked',
      'payment_id', v_payment.id,
      'previous_period_end', v_existing.previous_period_end,
      'resulting_period_end', v_existing.resulting_period_end,
      'premium_active', public.has_active_premium(v_payment.profile_id)
    );
  end if;

  /*
   * A payment that never bought anything has nothing to take back.
   *
   * Recorded anyway, and the payment's status updated, because the event did
   * happen and a second delivery of it must still be inert. The term is not
   * touched, because no term was granted.
   */
  if v_payment.status <> 'paid' then
    insert into public.payment_revocations
      (payment_id, profile_id, provider, provider_order_id, provider_reversal_id,
       kind, reason, amount_paise, previous_period_end, resulting_period_end)
    values
      (v_payment.id, v_payment.profile_id, v_payment.provider, v_payment.provider_order_id,
       p_reversal_id, p_kind, p_reason, p_amount_paise, null, null);

    update public.payments set status = p_status where id = v_payment.id;

    return jsonb_build_object(
      'outcome', 'no_grant_to_revoke',
      'payment_id', v_payment.id,
      'premium_active', public.has_active_premium(v_payment.profile_id)
    );
  end if;

  select period_months into v_months
    from public.membership_plans
   where id = v_payment.plan_id;

  /*
   * The row that holds the entitlement: the furthest-reaching term this member
   * has, which is the one every reader consults. Locked, so a settlement
   * arriving at the same moment cannot read an expiry this call is about to
   * change.
   */
  select * into v_sub
    from public.subscriptions
   where profile_id = v_payment.profile_id
   order by current_period_end desc nulls last
   limit 1
     for update;

  if v_sub.id is null then
    insert into public.payment_revocations
      (payment_id, profile_id, provider, provider_order_id, provider_reversal_id,
       kind, reason, amount_paise, previous_period_end, resulting_period_end)
    values
      (v_payment.id, v_payment.profile_id, v_payment.provider, v_payment.provider_order_id,
       p_reversal_id, p_kind, p_reason, p_amount_paise, null, null);

    update public.payments set status = p_status where id = v_payment.id;

    return jsonb_build_object(
      'outcome', 'no_subscription',
      'payment_id', v_payment.id,
      'premium_active', false
    );
  end if;

  v_previous := v_sub.current_period_end;
  v_new := coalesce(v_previous, now()) - make_interval(months => coalesce(v_months, 0));

  /*
   * A term cannot end before it began.
   *
   * `subscriptions_period_order` refuses it, and so does common sense. When the
   * subtraction lands at or before the start, the term granted nothing: it is
   * floored just past the start, which is in the past, which reads as expired
   * to every date check without rewriting when the membership began.
   */
  v_floor := coalesce(v_sub.current_period_start, v_sub.started_at, now())
             + interval '1 microsecond';
  if v_new < v_floor then
    v_new := v_floor;
  end if;

  update public.subscriptions
     set current_period_end = v_new,
         periods_billed = greatest(0, periods_billed - 1),
         /*
          * Only ever downgraded here. A term whose remaining time is gone is
          * `expired`; one that still has time left keeps whatever status it
          * had, so a revocation cannot resurrect a cancelled membership into
          * an active one.
          */
         status = case when v_new <= now() then 'expired'::public.subscription_status
                       else status end,
         ended_at = case when v_new <= now() then now() else ended_at end
   where id = v_sub.id;

  update public.payments set status = p_status where id = v_payment.id;

  insert into public.payment_revocations
    (payment_id, profile_id, provider, provider_order_id, provider_reversal_id,
     kind, reason, amount_paise, previous_period_end, resulting_period_end)
  values
    (v_payment.id, v_payment.profile_id, v_payment.provider, v_payment.provider_order_id,
     p_reversal_id, p_kind, p_reason, p_amount_paise, v_previous, v_new);

  return jsonb_build_object(
    'outcome', 'revoked',
    'payment_id', v_payment.id,
    'months_withdrawn', v_months,
    'previous_period_end', v_previous,
    'resulting_period_end', v_new,
    'premium_active', public.has_active_premium(v_payment.profile_id)
  );
end;
$$;

comment on function public.revoke_payment(public.payment_provider, text, text, text, text, integer, public.payment_status) is
  'Withdraws the months one settled payment granted. Idempotent on the payment, provider-independent, service role only.';

/*
 * Nobody but the service role, including the member whose payment it is.
 *
 * A client that can revoke can revoke somebody else's, and a client that can
 * call this at all is a client that can argue about what it was allowed to
 * call. The revoke is from `public` for the reason stated at the top of this
 * file, and `authenticated` is named explicitly so the absence is a decision
 * rather than an oversight.
 */
revoke execute on function public.revoke_payment(public.payment_provider, text, text, text, text, integer, public.payment_status)
  from public, anon, authenticated;
