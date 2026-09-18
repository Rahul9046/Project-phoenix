-- Taking money, and what it buys.
--
-- The membership half of this already existed: `membership_plans` holds the
-- catalogue in paise, `subscriptions` holds a member's term, and `entitlements`
-- decides what a tier may do. None of that is replaced here. What was missing
-- is the record of a payment and the machinery that turns one into time.
--
-- Three rules shape everything below, and each is a thing a client must not be
-- able to do:
--
--   The server picks the price. A client sends a plan code and nothing else.
--   `begin_payment` reads the amount from the catalogue, decides introductory
--   eligibility itself, and writes both down before a provider is ever called.
--
--   The server decides when a payment is paid. `payments` has no client write
--   policy at all, and `settle_payment` runs as the service role from an edge
--   function that has verified a signature. A member marking their own row paid
--   is not a bug to be caught in review; it is impossible.
--
--   Nothing here grants time twice. Every settlement is keyed on the provider's
--   own order id, and a second call with the same one returns what the first
--   did without touching the membership.
--
-- Eraya sells prepaid terms. There is no mandate, no auto-renewal and nothing
-- to cancel: the term ends when it ends, and the person decides whether to buy
-- another. `is_recurring` on the monthly plan is corrected below to say so.

-- ---------------------------------------------------------------------------
-- The states a payment can be in
-- ---------------------------------------------------------------------------
--
-- 'authorized' is separate from 'paid' because Razorpay can hold an authorised
-- payment that has not been captured, and money that is merely authorised has
-- not been received. Only 'paid' buys anything.
--
-- The refund states exist and nothing writes them yet. Refund policy is a
-- product decision nobody has made, and inventing one here -- silently removing
-- membership when money goes back -- would be the wrong half of it to guess.

create type public.payment_status as enum (
  'created',
  'authorized',
  'paid',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded'
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.membership_plans (id),

  provider public.payment_provider not null default 'razorpay',
  -- The provider's order: created before the person sees a payment screen, and
  -- the key everything afterwards is matched on.
  provider_order_id text,
  -- The provider's payment: known only once something has actually been paid.
  provider_payment_id text,

  /*
   * What was charged, decided by the server.
   *
   * Stored rather than derived, because the catalogue may be edited and this
   * has to keep saying what was actually taken. Integer paise throughout: a
   * rupee float rounds wrongly eventually, and every provider settles in the
   * minor unit anyway.
   */
  amount_paise integer not null,
  currency text not null default 'INR',

  status public.payment_status not null default 'created',

  /*
   * Whether this purchase used the introductory price.
   *
   * The durable evidence behind the ₹199 rule. Eligibility is "no paid payment
   * of this member has this flag", which cannot be reset by reinstalling the
   * app, clearing storage or signing in elsewhere -- and which a failed or
   * cancelled attempt never consumes, because only 'paid' counts.
   */
  intro_offer_applied boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  failed_at timestamptz,

  constraint payments_amount_positive check (amount_paise > 0),
  constraint payments_currency check (currency = 'INR')
);

comment on table public.payments is
  'One row per attempt to pay. The server writes every field; no client policy exists.';
comment on column public.payments.intro_offer_applied is
  'True when the introductory price was charged. A paid row here is what consumes the offer.';

-- A provider id identifies exactly one payment. Partial, because an order id
-- exists from creation and a payment id only once money moves.
create unique index payments_provider_order_unique
  on public.payments (provider, provider_order_id)
  where provider_order_id is not null;
create unique index payments_provider_payment_unique
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

create index payments_profile_idx on public.payments (profile_id, created_at desc);
create index payments_status_idx on public.payments (status);

-- The introductory offer, answered in one index rather than a scan.
create index payments_intro_consumed_idx
  on public.payments (profile_id)
  where intro_offer_applied and status = 'paid';

create trigger payments_set_updated_at
  before update on public.payments
  for each row
  execute function public.touch_updated_at();

/*
 * Members read their own payments. Nobody writes them.
 *
 * The read is deliberate: a payment history somebody cannot see is a support
 * conversation waiting to happen. The absence of every other policy is equally
 * deliberate -- with no insert, update or delete policy, a member cannot create
 * a paid row, cannot change an amount, and cannot mark themselves premium. The
 * service role bypasses RLS and is the only thing that writes here.
 */
alter table public.payments enable row level security;

create policy "Members can read their own payments"
  on public.payments
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

-- ---------------------------------------------------------------------------
-- Webhook deliveries, so the same one cannot be acted on twice
-- ---------------------------------------------------------------------------
--
-- Razorpay retries. A retry after a successful delivery is normal, not an
-- error, and the only defence against it granting a second term is remembering
-- which deliveries have been seen. The id is the provider's own.

create table public.payment_events (
  provider public.payment_provider not null default 'razorpay',
  provider_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),

  primary key (provider, provider_event_id)
);

comment on table public.payment_events is
  'Provider webhook deliveries already processed. Exists so a retry changes nothing.';

alter table public.payment_events enable row level security;

-- ---------------------------------------------------------------------------
-- Eraya does not auto-renew
-- ---------------------------------------------------------------------------
--
-- The monthly plan was marked recurring when the catalogue was written, on the
-- assumption of a mandate. The decision since is that every plan is a prepaid
-- term: no mandate, nothing to cancel, and the person chooses when to buy
-- again. The column stays because a future subscription product would need it;
-- the value changes because nothing recurs today.

update public.membership_plans
   set is_recurring = false
 where is_recurring;

-- ---------------------------------------------------------------------------
-- What a plan costs this particular member
-- ---------------------------------------------------------------------------
--
-- One function answers it, and both clients call it rather than reimplementing
-- the rule. The introductory price is not a property of the plan alone -- it
-- depends on whether this person has already used it -- so a client that
-- computed the price from the catalogue would be right for most people and
-- wrong for exactly the ones it matters to.

create or replace function public.intro_offer_used(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.payments
     where profile_id = p_profile
       and intro_offer_applied
       and status = 'paid'
  );
$$;

revoke execute on function public.intro_offer_used(uuid) from public, anon, authenticated;

/*
 * The catalogue, priced for whoever is asking.
 *
 * `price_paise` is what this member would pay right now. `standard_price_paise`
 * is the ordinary price, so the monthly plan can say what it becomes afterwards
 * -- disclosed plainly rather than struck through, because ₹299 is not a
 * discount somebody is losing, it is what the plan costs.
 */
create or replace function public.membership_catalogue()
returns table (
  code text,
  name text,
  description text,
  period_months integer,
  price_paise integer,
  standard_price_paise integer,
  intro_applies boolean,
  currency text
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select (select auth.uid()) as id),
  used as (select public.intro_offer_used((select id from me)) as consumed)
  select
    p.code,
    p.name,
    p.description,
    p.period_months,
    case
      when p.intro_price_paise is not null and not (select consumed from used)
        then p.intro_price_paise
      else p.price_paise
    end,
    p.price_paise,
    p.intro_price_paise is not null and not (select consumed from used),
    p.currency
  from public.membership_plans p
  where p.is_active
  order by p.sort_order;
$$;

comment on function public.membership_catalogue() is
  'Plans priced for the calling member, including whether the introductory price applies.';

revoke execute on function public.membership_catalogue() from public, anon, authenticated;
grant execute on function public.membership_catalogue() to authenticated;

-- ---------------------------------------------------------------------------
-- Where a member stands
-- ---------------------------------------------------------------------------
--
-- Premium is a date, not a flag. A term that has run out is not premium even
-- while its row still says 'active', and the check is `current_period_end >
-- now()` rather than a nightly job flipping booleans -- a job that has not run
-- yet is a member with access they have not paid for.

create or replace function public.my_membership_for(p_profile uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select s.*, p.code as plan_code, p.name as plan_name, p.period_months
      from public.subscriptions s
      join public.membership_plans p on p.id = s.plan_id
     where s.profile_id = p_profile
       and s.status in ('trialing', 'active', 'past_due', 'cancelled')
       and s.current_period_end > now()
     order by s.current_period_end desc
     limit 1
  )
  select jsonb_build_object(
    'tier', coalesce((select 'premium' from live), 'free'),
    'active', exists (select 1 from live),
    'expires_at', (select current_period_end from live),
    'started_at', (select started_at from live),
    'plan_code', (select plan_code from live),
    'plan_name', (select plan_name from live),
    'period_months', (select period_months from live),
    'intro_offer_used', public.intro_offer_used(p_profile)
  );
$$;

comment on function public.my_membership_for(uuid) is
  'Membership for one profile. Called by the edge functions, which hold no session of their own.';

revoke execute on function public.my_membership_for(uuid) from public, anon, authenticated;

-- The same answer, for whoever is asking. Two functions rather than one because
-- the server side has no `auth.uid()` to read.
create or replace function public.my_membership()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.my_membership_for((select auth.uid()));
$$;

comment on function public.my_membership() is
  'The caller''s membership. Premium is true only while the paid term has not run out.';

revoke execute on function public.my_membership() from public, anon, authenticated;
grant execute on function public.my_membership() to authenticated;

-- ---------------------------------------------------------------------------
-- Starting a payment
-- ---------------------------------------------------------------------------
--
-- The client sends a plan code. Everything else -- the amount, the currency,
-- whether the introductory price applies -- is decided here and written down
-- before the provider is called, so what was charged can be compared with what
-- was meant afterwards.

create or replace function public.begin_payment(
  p_profile uuid,
  p_plan_code text
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

  v_intro := v_plan.intro_price_paise is not null
             and not public.intro_offer_used(p_profile);

  v_amount := case when v_intro then v_plan.intro_price_paise else v_plan.price_paise end;

  insert into public.payments
    (profile_id, plan_id, amount_paise, currency, intro_offer_applied)
  values
    (p_profile, v_plan.id, v_amount, v_plan.currency, v_intro)
  returning id into v_id;

  return query
    select v_id, v_amount, v_plan.currency, v_intro, v_plan.name, v_plan.period_months;
end;
$$;

revoke execute on function public.begin_payment(uuid, text) from public, anon, authenticated;

create or replace function public.attach_provider_order(
  p_payment uuid,
  p_order_id text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.payments
     set provider_order_id = p_order_id
   where id = p_payment;
$$;

revoke execute on function public.attach_provider_order(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Turning a paid payment into time
-- ---------------------------------------------------------------------------
--
-- Idempotent by construction: the row is locked, and a payment already marked
-- paid returns what it did the first time without touching the membership. Two
-- webhook deliveries, a webhook racing the client callback, a retry after a
-- timeout -- all of them land here and only the first one buys anything.
--
-- Stacking is the other half. Time already paid for is never discarded: a new
-- term starts from whichever is later, now or the current expiry. Somebody who
-- buys three months on the first of October with a term running to the
-- fifteenth ends in the middle of January, not at the start of it.
--
-- Calendar months rather than thirty-day blocks, because `+ 1 month` is what a
-- person means. Postgres already handles the awkward end of the month: the 31st
-- of January plus one month is the 28th of February, not the 3rd of March.

create or replace function public.settle_payment(
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
   where provider_order_id = p_order_id
     for update;

  if v_payment.id is null then
    return jsonb_build_object('outcome', 'unknown_order');
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

revoke execute on function public.settle_payment(text, text, public.payment_status) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Have we seen this delivery before?
-- ---------------------------------------------------------------------------
--
-- Returns true the first time and false every time after, in one statement, so
-- two deliveries arriving together cannot both be told they are the first.

create or replace function public.claim_payment_event(
  p_event_id text,
  p_event_type text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  insert into public.payment_events (provider_event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict do nothing
  returning true;
$$;

revoke execute on function public.claim_payment_event(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What a member has paid
-- ---------------------------------------------------------------------------
--
-- The provider's ids are deliberately absent. They identify the payment to
-- Razorpay, not to the person, and a support conversation is better served by a
-- date and an amount than by a reference nobody can read out.

create or replace function public.my_payments()
returns table (
  id uuid,
  plan_name text,
  period_months integer,
  amount_paise integer,
  currency text,
  status public.payment_status,
  intro_offer_applied boolean,
  created_at timestamptz,
  paid_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, m.name, m.period_months, p.amount_paise, p.currency,
    p.status, p.intro_offer_applied, p.created_at, p.paid_at
  from public.payments p
  join public.membership_plans m on m.id = p.plan_id
  where p.profile_id = (select auth.uid())
  order by p.created_at desc
  limit 50;
$$;

revoke execute on function public.my_payments() from public, anon, authenticated;
grant execute on function public.my_payments() to authenticated;
