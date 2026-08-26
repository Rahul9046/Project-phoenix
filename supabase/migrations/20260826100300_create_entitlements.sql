-- What each tier is allowed to do.
--
-- The point of this table is that premium checks are data, not code. Adding a
-- capability later -- read receipts, boosts, travel mode, any of the pool that
-- is deliberately unbuilt -- is an insert here plus the feature itself. No
-- migration of the membership system, and no `if (tier === 'premium')` spreading
-- through the UI.
--
-- Values are jsonb so a flag and a limit can live in one table. `kind` records
-- which was meant, so a boolean is never read as a number by accident.

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),

  tier public.membership_tier not null,

  -- Matches the key used in the application's entitlement module.
  key text not null,

  kind public.entitlement_kind not null,
  value jsonb not null,

  -- Free text, shown nowhere; this is for whoever reads the table in six months.
  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One value per capability per tier.
  constraint entitlements_tier_key_unique unique (tier, key),

  -- The value must actually match the declared kind.
  constraint entitlements_value_matches_kind
    check (
      (kind = 'boolean' and jsonb_typeof(value) = 'boolean')
      or (kind = 'number' and jsonb_typeof(value) = 'number')
    )
);

comment on table public.entitlements is
  'Per-tier capability values. Premium checks read this rather than hardcoding a tier comparison.';

create index entitlements_tier_idx on public.entitlements (tier);
