-- Eraya reference types.
--
-- These are enums rather than lookup tables because the sets are defined by the
-- product, not by data entry. Relationship status in particular is the reason
-- Eraya exists: the database should reject "single" outright rather than rely
-- on the UI to withhold it.

-- The life chapters Eraya is built around. Deliberately no "single".
create type public.relationship_status as enum (
  'divorced',
  'separated',
  'widowed'
);

-- Matches the options offered at onboarding.
create type public.gender as enum (
  'woman',
  'man',
  'non_binary',
  'prefer_not_to_say'
);

-- Mirrors the AuthStage union in lib/auth/types.ts. Ordered: a later value
-- implies every earlier one has been reached.
create type public.onboarding_stage as enum (
  'authenticated',
  'phone_verified',
  'onboarding_started',
  'onboarding_completed'
);
