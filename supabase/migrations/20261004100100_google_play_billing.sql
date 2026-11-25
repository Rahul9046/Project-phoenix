-- Making the last Razorpay-biased primitives provider-aware, and giving a Play
-- purchase somewhere to be recorded.
--
-- Phase 2a of the billing work: server groundwork only. Nothing here grants
-- anybody anything, nothing changes a price, and no Play product id is written
-- -- the two mapping columns are added NULL and stay NULL until somebody has
-- created the products in Play Console and decided what they are called.
--
-- Four things:
--
--   `begin_payment` can name a provider. It is the only function that creates
--   a `payments` row, and it inserted without a `provider` value -- taking the
--   column default `'razorpay'`. That was inert with one provider and is the
--   last place in the schema that assumes there is only one.
--
--   `claim_payment_event` can name a provider. `payment_events` has been keyed
--   on `(provider, provider_event_id)` since it was written, but the function
--   that writes it was not, so a Google notification id would have been
--   deduplicated inside Razorpay's namespace. Two providers can and do issue
--   the same opaque id, and the cost of that collision is a dropped void
--   notification -- a refunded member keeping premium.
--
--   A payment can record that the store was told. Play auto-refunds and revokes
--   a purchase that is not acknowledged within three days, so "did we
--   acknowledge this" has to be a fact on the row rather than something
--   inferred from a log. Null means not yet, which is what makes a retry
--   findable.
--
--   A plan can carry its Play product ids. Two columns rather than one, because
--   a Play one-time product has exactly one price and the monthly plan has two
--   (₹199 introductory, ₹299 standard). Which of them a purchase may use is
--   decided by `intro_offer_used`, server-side, exactly as it already is for
--   Razorpay.
--
-- Additive and safe for the currently deployed clients. Both replaced
-- functions keep their original parameters in their original order and gain a
-- defaulted third, so `payments-create-order` and `payments-webhook` -- which
-- call them with named arguments and no provider -- go on behaving exactly as
-- they do today, against `'razorpay'`. That is deliberate: the schema may be
-- applied before the functions are deployed, and must not break the apps that
-- are live while it is.
--
-- No existing row is read or written. No RLS policy is added, removed or
-- changed. Every function below is revoked from `public`, `anon` and
-- `authenticated`: a client cannot create a payment, cannot claim an event,
-- and cannot settle or revoke one either.

-- ---------------------------------------------------------------------------
-- Recording that the store was told
-- ---------------------------------------------------------------------------
--
-- Set only after Google has confirmed the acknowledgement, never alongside the
-- grant. The two are separate facts and conflating them is what would hide the
-- failure that matters: a term granted on a purchase the store still considers
-- unacknowledged is a term Google will refund out from under us on day three.
--
-- Nullable with no default, so every row that exists today reads "not
-- acknowledged" -- which is true of all of them, because they are all Razorpay
-- and Razorpay has no such step. Razorpay payments simply never set it.

alter table public.payments
  add column if not exists acknowledged_at timestamptz;

comment on column public.payments.acknowledged_at is
  'When the store confirmed acknowledgement of this purchase. Google Play only; null means not yet, and a null on a paid Play payment is a retry waiting to happen.';

-- ---------------------------------------------------------------------------
-- Where a plan's Play products are named
-- ---------------------------------------------------------------------------
--
-- Deliberately left NULL. Inventing product ids here would put strings in the
-- database that do not exist in Play Console, and the first thing that happened
-- would be a purchase failing in front of a member with no way to tell whether
-- the id or the configuration was wrong.
--
-- `payments-play-begin` refuses to start a purchase whose required column is
-- null, which is the behaviour these columns are added for: the feature is
-- off until somebody turns it on by naming the products, and it is off in the
-- safe direction.
--
-- Two columns rather than a price-keyed table because the product catalogue has
-- exactly two price points per plan and only the monthly plan uses the second.
-- A plan with no introductory price leaves `play_intro_product_id` null for
-- ever, and nothing will ask for it -- `intro_offer_applied` on the payment row
-- is what decides which column is read.

alter table public.membership_plans
  add column if not exists play_product_id text;

alter table public.membership_plans
  add column if not exists play_intro_product_id text;

comment on column public.membership_plans.play_product_id is
  'Google Play one-time product id charged at the ordinary price. NULL means this plan cannot be bought on Play yet.';
comment on column public.membership_plans.play_intro_product_id is
  'Google Play one-time product id charged at the introductory price. NULL on every plan without introductory pricing, and that is correct rather than missing.';

/*
 * A product id identifies exactly one plan.
 *
 * Partial, because both columns are null on every row today and will stay null
 * on most of them. Without this, the same product id could be set on two plans
 * and a purchase of it would grant whichever period the lookup happened to
 * find -- so the twelve-month product could quietly deliver one month, or the
 * other way round.
 *
 * Two separate indexes rather than one across both columns: a product id must
 * be unique among ordinary products and unique among introductory products,
 * and the pair (ordinary on one plan, introductory on another) is the same
 * mistake. Enforcing the union properly needs an exclusion constraint over a
 * union of both columns, which Postgres cannot express as a plain unique index
 * -- so the cross-column case is asserted in `scripts/payments-probe.mjs`
 * instead of here, and said out loud rather than left as a silent gap.
 */
create unique index if not exists membership_plans_play_product_unique
  on public.membership_plans (play_product_id)
  where play_product_id is not null;

create unique index if not exists membership_plans_play_intro_product_unique
  on public.membership_plans (play_intro_product_id)
  where play_intro_product_id is not null;

-- ---------------------------------------------------------------------------
-- Creating a payment, for a named provider
-- ---------------------------------------------------------------------------
--
-- Recreated from 20260906100100_payments.sql with one change: the provider is a
-- parameter and is inserted, instead of being left to the column default.
-- Everything else -- the plan lookup, the introductory eligibility rule, the
-- amount the server picks, the row it writes -- is what it was.
--
-- The old two-argument version is dropped explicitly rather than left to be
-- shadowed. Postgres would keep it as a separate overload, and two functions
-- that differ only in whether they can name a provider is precisely the
-- ambiguity this migration exists to remove: a caller that meant to pass
-- `google_play` and mistyped the parameter name would silently reach the old
-- one and write a Razorpay row.
--
-- The default stays `'razorpay'` so the deployed `payments-create-order`, which
-- passes `p_profile` and `p_plan_code` only, is unaffected. New callers pass the
-- provider; that is the whole of the difference.

drop function if exists public.begin_payment(uuid, text);

create or replace function public.begin_payment(
  p_profile uuid,
  p_plan_code text,
  p_provider public.payment_provider default 'razorpay'
)
returns table (
  payment_id uuid,
  amount_paise integer,
  currency text,
  intro_applies boolean,
  plan_name text,
  period_months integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.membership_plans;
  v_intro boolean;
  v_amount integer;
  v_id uuid;
begin
  select * into v_plan
    from public.membership_plans
   where code = p_plan_code and is_active;

  if v_plan.id is null then
    raise exception 'unknown plan' using errcode = '22023';
  end if;

  /*
   * 'none' is not a provider a payment can be created for.
   *
   * It exists on `subscriptions` to mean "no provider is configured", which is
   * a sensible state for a membership and a meaningless one for a charge. A
   * payment row with no provider could never be settled, because every
   * settlement path looks the row up by provider and order id together.
   */
  if p_provider = 'none' then
    raise exception 'payments require a real provider' using errcode = '22023';
  end if;

  v_intro := v_plan.intro_price_paise is not null
             and not public.intro_offer_used(p_profile);

  v_amount := case when v_intro then v_plan.intro_price_paise else v_plan.price_paise end;

  insert into public.payments
    (profile_id, plan_id, provider, amount_paise, currency, intro_offer_applied)
  values
    (p_profile, v_plan.id, p_provider, v_amount, v_plan.currency, v_intro)
  returning id into v_id;

  return query
    select v_id, v_amount, v_plan.currency, v_intro, v_plan.name, v_plan.period_months;
end;
$$;

comment on function public.begin_payment(uuid, text, public.payment_provider) is
  'Writes the intended payment for one member and plan, against a named provider. The server picks the amount; the caller never does.';

-- Dropped above, so these are fresh grants rather than inherited ones.
-- `create function` grants EXECUTE to PUBLIC and `anon` inherits it, so the
-- revoke has to name `public` -- revoking from `anon` alone does nothing.
revoke execute on function public.begin_payment(uuid, text, public.payment_provider)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Claiming a provider's delivery, in that provider's namespace
-- ---------------------------------------------------------------------------
--
-- Same shape as before, with the provider now reaching the column it was always
-- part of the key for. `payment_events` is `primary key (provider,
-- provider_event_id)`, so this is the function catching up with the table.
--
-- Why it matters for Play specifically: a Real-time Developer Notification
-- carries a Pub/Sub message id, which is Google's own opaque string and shares
-- no namespace with a Razorpay event id. Inserted under the razorpay default,
-- the first Google message id that happened to collide with a Razorpay one
-- would be read as already processed and dropped -- and the notification most
-- worth not dropping is `VOIDED_PURCHASE`, which is the only thing that takes
-- premium back from a refunded member.
--
-- Returns true when the caller has the claim and null when somebody already
-- did, which is the contract `payments-webhook` already relies on.

drop function if exists public.claim_payment_event(text, text);

create or replace function public.claim_payment_event(
  p_event_id text,
  p_event_type text,
  p_provider public.payment_provider default 'razorpay'
)
returns boolean
language sql
security definer
set search_path = public
as $$
  insert into public.payment_events (provider, provider_event_id, event_type)
  values (p_provider, p_event_id, p_event_type)
  on conflict do nothing
  returning true;
$$;

comment on function public.claim_payment_event(text, text, public.payment_provider) is
  'Claims one provider delivery for processing. Scoped to the provider, because two providers'' event ids share no namespace.';

revoke execute on function public.claim_payment_event(text, text, public.payment_provider)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What this migration deliberately does not do
-- ---------------------------------------------------------------------------
--
-- No Play product id is written. The columns are the mechanism; the values are
-- a Play Console decision that has not been made.
--
-- `membership_catalogue()` is untouched. It is called by both live clients and
-- returns a fixed row shape; the Play product id is needed by the server when a
-- purchase begins, not by a client drawing a price list, and
-- `payments-play-begin` reads it directly with the service role. Widening a
-- function two deployed clients depend on, to carry a value neither of them
-- uses, would be a change with risk and no purpose.
--
-- `settle_payment`, `revoke_payment` and `has_active_premium` are untouched.
-- All three already take a provider or are provider-blind by design, which is
-- what Phase 1 was for. Google Play reaches entitlement through the same
-- `settle_payment` Razorpay does, and that is the point: there is one place
-- where money becomes time.
--
-- No new entitlement, tier or capability. A Play purchase grants exactly the
-- premium a Razorpay purchase grants, because it grants it the same way.
