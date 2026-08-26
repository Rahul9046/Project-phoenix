-- A member's relationship with a plan, over time.
--
-- Rows are never deleted and never rewritten in place when a term ends: a
-- lapsed subscription becomes 'expired' and a new row starts. Billing history
-- that edits itself cannot answer "what were they paying in March", which is
-- exactly the question a refund or a dispute asks.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.membership_plans (id),

  status public.subscription_status not null default 'pending',

  -- Who is billing this. 'none' while no provider is configured -- a row in
  -- that state records intent and must never be read as money received.
  provider public.payment_provider not null default 'none',
  -- The provider's own id, so a webhook can find this row. Unique per provider
  -- where present.
  provider_subscription_id text,

  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,

  -- Set when someone cancels but the paid term has not finished. Entitlements
  -- continue until current_period_end; revoking at cancellation would take away
  -- access already paid for.
  cancel_at timestamptz,
  cancelled_at timestamptz,
  ended_at timestamptz,

  -- True while the introductory price still applies, so the renewal price can
  -- be disclosed honestly before it changes.
  is_introductory boolean not null default false,
  -- How many periods have been billed. Drives the exit from introductory
  -- pricing without needing to diff dates.
  periods_billed integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscriptions_periods_billed_non_negative
    check (periods_billed >= 0),
  constraint subscriptions_period_order
    check (
      current_period_start is null
      or current_period_end is null
      or current_period_end > current_period_start
    )
);

comment on table public.subscriptions is
  'One row per subscription term. Never edited into a new term; a lapsed row expires and a new one starts.';

comment on column public.subscriptions.provider is
  'none = recorded intent, no payment taken. Never treat as paid.';

create index subscriptions_profile_idx on public.subscriptions (profile_id);
create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_period_end_idx on public.subscriptions (current_period_end);

-- A provider's id identifies exactly one subscription. Partial, because 'none'
-- has no ids and several rows will legitimately have null here.
create unique index subscriptions_provider_ref_unique
  on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

-- At most one live subscription per member. Without this, a retry or a
-- duplicated webhook silently grants two overlapping terms.
create unique index subscriptions_one_live_per_profile
  on public.subscriptions (profile_id)
  where status in ('pending', 'trialing', 'active', 'past_due');

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.touch_updated_at();

create trigger entitlements_set_updated_at
  before update on public.entitlements
  for each row
  execute function public.touch_updated_at();
