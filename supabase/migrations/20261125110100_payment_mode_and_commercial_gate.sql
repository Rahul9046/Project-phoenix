-- Two things that have to exist before a live Razorpay key does.
--
-- Neither changes a price, grants anybody anything, or alters one existing row.
-- Both are additive and both fail in the direction of not charging.
--
-- ---------------------------------------------------------------------------
-- 1. A payment remembers which Razorpay it was made against
-- ---------------------------------------------------------------------------
--
-- `payments` records the amount, the plan, the provider and the order id, and
-- nothing at all about *which Razorpay account* produced that order. Today
-- every row in the table is a test-mode row, and nothing says so. The day a
-- live key is configured, test and live transactions become indistinguishable
-- in the database -- which is a reporting problem, and a worse one than that:
--
--   A row created in test mode sits at `created` for ever if its checkout was
--   abandoned. There are such rows now. With a live key configured, a client
--   replaying that order id reaches the reconciliation path, and the only thing
--   standing between it and a settlement is that Razorpay's live API does not
--   know a test order. That is true, and it is somebody else's invariant to
--   keep. Ours should not depend on it.
--
-- So the mode is written down when the payment is created and checked when it
-- is settled. A test row can never be settled by a live key, and a live row
-- can never be settled by a test key, regardless of what either API says.
--
-- Nullable on purpose. Every existing row predates the column, and `null`
-- means "created before this was recorded". Those rows are all test-mode rows,
-- so `settle_payment` below treats `null` as "test": settling them in test mode
-- goes on working exactly as it does today, and settling them with a live key
-- is refused. That is the safe direction and it disrupts nothing.
--
-- ---------------------------------------------------------------------------
-- 2. Configuring a live key is not the same as opening the till
-- ---------------------------------------------------------------------------
--
-- Right now the only thing between Eraya and real charges is which key is in
-- the edge function's environment. The signed-in membership screen has no gate
-- of any kind: it loads Razorpay's checkout and opens it. So the moment a live
-- key is set -- to test it, to check the webhook, because two settings were
-- changed at once -- the product is selling, in whatever state the pricing page
-- happens to be in, to whoever is signed in at the time.
--
-- `payments_live_enabled` separates the two. It lives in `ops_config` beside
-- the OTP caps and the moderation allowlist, so this introduces no table, no
-- service and no scheduled job. It is enforced in `begin_payment`, which is the
-- only function that creates a payment row: a client cannot route around it, and
-- neither can a mis-deployed edge function, because no order can be created at
-- Razorpay without a row to hang it on.
--
-- It gates **live mode only**. Test-mode development is untouched.
--
-- Seeded `false`. Flipping it is a deliberate, auditable one-line update that
-- the product owner makes when the pricing page, the webhook and the account
-- are all actually ready:
--
--   update public.ops_config set value = 'true'::jsonb, updated_at = now()
--    where key = 'payments_live_enabled';
--
-- And to shut the till again, which is the half that matters at 2am:
--
--   update public.ops_config set value = 'false'::jsonb, updated_at = now()
--    where key = 'payments_live_enabled';
--
-- That takes effect on the next order. It does not revoke anything already
-- sold -- `revoke_payment` is the tool for that -- and it cannot strand a
-- payment mid-flight, because a row that already exists settles normally.
--
-- ---------------------------------------------------------------------------
-- Recovery
-- ---------------------------------------------------------------------------
--
-- Both changes are reversible without data loss:
--
--   alter table public.payments drop column live_mode;
--   delete from public.ops_config where key = 'payments_live_enabled';
--
-- and re-running 20261004100100 and 20261003100100 restores the previous
-- `begin_payment` and `settle_payment`. Nothing below writes to an existing
-- row, so there is nothing to restore from a backup.

-- ---------------------------------------------------------------------------

alter table public.payments
  add column if not exists live_mode boolean;

comment on column public.payments.live_mode is
  'Which Razorpay environment created this payment: true = live, false = test, null = created before the column existed (and therefore test).';

-- Partial, because the only question ever asked of this column is "show me the
-- live ones", and in a table that is overwhelmingly test rows a partial index
-- is a fraction of the size.
create index if not exists payments_live_mode_idx
  on public.payments (created_at desc)
  where live_mode;

-- ---------------------------------------------------------------------------
-- The gate
-- ---------------------------------------------------------------------------

insert into public.ops_config (key, value)
values ('payments_live_enabled', 'false'::jsonb)
on conflict (key) do nothing;

/**
 * Whether live charging is open.
 *
 * Defaults to **false** when the row is missing or holds anything that is not
 * the JSON boolean `true`. A gate that opens because somebody deleted a
 * configuration row is not a gate.
 */
create or replace function public.payments_live_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value = 'true'::jsonb from public.ops_config where key = 'payments_live_enabled'),
    false
  );
$$;

comment on function public.payments_live_enabled() is
  'Whether live-mode payments may be created. Read by begin_payment; false unless ops_config says otherwise.';

-- Operational configuration, not a member-facing fact. `create function` grants
-- EXECUTE to PUBLIC and anon inherits it, so the revoke has to name `public`.
revoke execute on function public.payments_live_enabled() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- begin_payment: records the mode, and refuses live charges before the gate
-- ---------------------------------------------------------------------------
--
-- Recreated from 20261004100100 with one parameter and one check added.
-- Everything else -- the plan lookup on `is_active`, the `none` provider
-- refusal, the introductory-price decision, the server-chosen amount -- is
-- unchanged, deliberately and line for line.

drop function if exists public.begin_payment(uuid, text, public.payment_provider);

create or replace function public.begin_payment(
  p_profile uuid,
  p_plan_code text,
  p_provider public.payment_provider default 'razorpay',
  -- Null means "the caller did not say", which is how every call that predates
  -- this migration behaves. Treated as test, because that is what it was.
  p_live_mode boolean default null
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
  /*
   * The gate, before anything else is read or written.
   *
   * Only live mode is gated. A test-mode caller reaches none of this, so
   * development and the payments probe are unaffected.
   */
  if coalesce(p_live_mode, false) and not public.payments_live_enabled() then
    raise exception 'live payments are not enabled' using errcode = '22023';
  end if;

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
    (profile_id, plan_id, provider, amount_paise, currency, intro_offer_applied, live_mode)
  values
    (p_profile, v_plan.id, p_provider, v_amount, v_plan.currency, v_intro,
     coalesce(p_live_mode, false))
  returning id into v_id;

  return query
    select v_id, v_amount, v_plan.currency, v_intro, v_plan.name, v_plan.period_months;
end;
$$;

comment on function public.begin_payment(uuid, text, public.payment_provider, boolean) is
  'Writes the intended payment for one member and plan, against a named provider, recording whether it is a live-mode charge. The server picks the amount; the caller never does. Live charges are refused unless payments_live_enabled().';

-- Dropped above, so these are fresh grants rather than inherited ones.
revoke execute on function public.begin_payment(uuid, text, public.payment_provider, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- settle_payment: a row may only be settled in the mode that created it
-- ---------------------------------------------------------------------------
--
-- Recreated from 20261003100100 with one parameter and one check added. The
-- locking, the revocation check, the `already_paid` short-circuit and the
-- `greatest(now(), …)` term arithmetic are unchanged, line for line -- they are
-- what make concurrent settlement safe and they are not being touched.

drop function if exists public.settle_payment(public.payment_provider, text, text, public.payment_status);

create or replace function public.settle_payment(
  p_provider public.payment_provider,
  p_order_id text,
  p_provider_payment_id text,
  p_status public.payment_status,
  -- Null means "the caller did not say", which is how the currently deployed
  -- edge functions call this. Enforcement is skipped in that case, so a deploy
  -- of this migration ahead of the functions changes no behaviour.
  p_live_mode boolean default null
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
   * The environment that created this row is the only one that may settle it.
   *
   * Checked before everything, including the revocation and `already_paid`
   * branches, because a cross-mode settlement is not a thing to report the
   * outcome of -- it is a thing that must not proceed at all. `null` on the
   * row means it predates the column and is therefore a test row.
   */
  if p_live_mode is not null
     and coalesce(v_payment.live_mode, false) <> p_live_mode then
    return jsonb_build_object(
      'outcome', 'mode_mismatch',
      'payment_id', v_payment.id
    );
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

comment on function public.settle_payment(public.payment_provider, text, text, public.payment_status, boolean) is
  'Idempotently settles one order and extends the member term. Refuses a payment created in a different Razorpay environment, a revoked payment, and a second grant for an order already paid.';

revoke execute on function public.settle_payment(public.payment_provider, text, text, public.payment_status, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Validation after applying
-- ---------------------------------------------------------------------------
--
-- Read-only, and each one answers a question this migration makes a claim about.
--
--   -- the gate exists and is shut
--   select public.payments_live_enabled();                      -- expect: false
--
--   -- the column exists and every historical row reads as test
--   select live_mode, count(*) from public.payments group by 1;  -- expect: null only
--
--   -- both functions carry the new parameter, with a default so the currently
--   -- deployed edge functions keep resolving
--   select proname, pg_get_function_arguments(oid)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname in ('begin_payment', 'settle_payment');
--
--   -- nothing member-facing may call any of the three
--   select proname, proacl
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and proname in ('begin_payment', 'settle_payment', 'payments_live_enabled');
--
-- `npm run payments:probe` exercises the whole flow, but it **writes to
-- production** -- a throwaway auth user, payment rows and payment_events --
-- so it is a deliberate act and not part of applying this.
