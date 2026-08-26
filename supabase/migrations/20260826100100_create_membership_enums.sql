-- Membership reference types.
--
-- Enums rather than lookup tables for the same reason as the onboarding types:
-- these sets are defined by the product, not by data entry. A subscription with
-- a status nobody has implemented should fail to insert, not sit in a table
-- being quietly misread as active.

-- What a member is entitled to. Deliberately only two values today: the pricing
-- has one paid tier. Adding 'plus' later is an enum addition, not a redesign,
-- because nothing keys off the *name* of the tier except the entitlements table.
create type public.membership_tier as enum (
  'free',
  'premium'
);

-- The lifecycle of a paid subscription.
--
-- 'pending' exists because Eraya has no payment provider yet: a subscription
-- can be recorded as intended without ever claiming money changed hands.
-- 'past_due' and 'cancelled' are distinct from 'expired' on purpose — a
-- cancelled subscription usually keeps its entitlements until the period ends,
-- and conflating the two would revoke access people have paid for.
create type public.subscription_status as enum (
  'pending',
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'expired'
);

-- Who took the money. 'none' is the honest value while payments are not wired
-- up, and it keeps the column non-null so a real provider can never be assumed.
create type public.payment_provider as enum (
  'none',
  'razorpay',
  'stripe',
  'apple_app_store',
  'google_play'
);

-- How an entitlement's value should be read. Entitlements are stored as jsonb
-- so a limit and a flag can share one table; this records which is meant.
create type public.entitlement_kind as enum (
  'boolean',
  'number'
);
