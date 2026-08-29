-- What Eraya sells.
--
-- Prices are fixed values, stored exactly as they are charged. They are never
-- derived from one another and no discount is computed at runtime: the twelve
-- month plan is a price, not a saving, and presenting it as "x% off" would be
-- inventing a claim the product does not make.
--
-- Money is stored in paise as an integer. Rupees as a float would round wrong
-- eventually, and every payment provider settles in the minor unit anyway.

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),

  -- Stable identifier used by code and by the payment provider's own catalogue.
  -- Names and prices may be edited; this may not.
  code text not null unique,

  name text not null,
  tier public.membership_tier not null default 'premium',

  -- How long one billing period lasts. 1, 3, 6 or 12 today.
  period_months integer not null,

  -- The ordinary price of one period, in paise.
  price_paise integer not null,

  -- Introductory pricing, applied to the first `intro_period_months` periods.
  -- Only the monthly plan uses it: 19900 for the first month, 29900 after.
  -- Null on every other plan, which is why these are two nullable columns
  -- rather than a flag — there is nothing to interpret when they are absent.
  intro_price_paise integer,
  intro_period_months integer,

  -- Whether the plan renews on its own. The multi-month plans are one-off
  -- terms; the monthly plan recurs. This drives whether a renewal price must
  -- be disclosed before purchase.
  is_recurring boolean not null default false,

  currency text not null default 'INR',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint membership_plans_period_positive
    check (period_months > 0),
  constraint membership_plans_price_non_negative
    check (price_paise >= 0),
  -- Introductory pricing is all-or-nothing: a price without a duration, or a
  -- duration without a price, is a half-configured plan that would bill wrongly.
  constraint membership_plans_intro_complete
    check (
      (intro_price_paise is null and intro_period_months is null)
      or (intro_price_paise is not null and intro_period_months is not null
          and intro_price_paise >= 0 and intro_period_months > 0)
    )
);

comment on table public.membership_plans is
  'Sellable plans. Prices are fixed and stored in paise; no discount is computed at runtime.';

comment on column public.membership_plans.intro_price_paise is
  'First-period price. The monthly plan is 19900 for one month, then price_paise (29900).';

create index membership_plans_active_order_idx
  on public.membership_plans (is_active, sort_order);
