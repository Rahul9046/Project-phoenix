-- The plans Eraya sells, and what each tier may do.
--
-- Idempotent: re-running updates prices in place rather than duplicating rows,
-- so this file stays the single description of the current catalogue.
--
-- Prices are exact and independent. The 12-month plan is 2399 because that is
-- the price, not because a percentage was applied to anything.

insert into public.membership_plans
  (code, name, tier, period_months, price_paise, intro_price_paise, intro_period_months, is_recurring, sort_order)
values
  -- 199 for the first month, 299 every month after. The only recurring plan,
  -- and the only one with introductory pricing.
  ('premium_monthly',     'Monthly',     'premium',  1,  29900, 19900, 1, true,  10),
  ('premium_quarterly',   'Quarterly',   'premium',  3,  69900, null,  null, false, 20),
  ('premium_half_yearly', 'Half-yearly', 'premium',  6, 129900, null,  null, false, 30),
  ('premium_annual',      'Annual',      'premium', 12, 239900, null,  null, false, 40)
on conflict (code) do update
  set name                = excluded.name,
      tier                = excluded.tier,
      period_months       = excluded.period_months,
      price_paise         = excluded.price_paise,
      intro_price_paise   = excluded.intro_price_paise,
      intro_period_months = excluded.intro_period_months,
      is_recurring        = excluded.is_recurring,
      sort_order          = excluded.sort_order,
      is_active           = true;

-- ---------------------------------------------------------------------------
-- Entitlements.
--
-- Every capability appears for BOTH tiers, including the ones free members do
-- not get. A missing row and a deliberate `false` are indistinguishable to
-- calling code otherwise, and "the key was absent" is not a decision anyone
-- made. Free is the honest baseline, not an empty set.
--
-- Adding a future capability -- boosts, read receipts, travel mode -- is two
-- rows here. It is not a change to the membership system.
-- ---------------------------------------------------------------------------

insert into public.entitlements (tier, key, kind, value, description)
values
  -- Premium, as decided: see who expressed interest, more reverts, incognito,
  -- priority visibility.
  ('free',    'canSeeInteresters',      'boolean', 'false', 'See who expressed interest in you'),
  ('premium', 'canSeeInteresters',      'boolean', 'true',  'See who expressed interest in you'),

  ('free',    'canUseIncognito',        'boolean', 'false', 'Browse without appearing in viewers'),
  ('premium', 'canUseIncognito',        'boolean', 'true',  'Browse without appearing in viewers'),

  ('free',    'canUsePriorityVisibility','boolean','false', 'Profile shown earlier in discovery'),
  ('premium', 'canUsePriorityVisibility','boolean','true',  'Profile shown earlier in discovery'),

  -- A number, not a boolean, and deliberately finite on both tiers. Premium is
  -- "more reverts", never "unlimited" -- that promise has not been made and
  -- hardcoding -1 here would be the first step towards making it by accident.
  ('free',    'revertLimit',            'number',  '3',     'Profile reverts per session'),
  ('premium', 'revertLimit',            'number',  '15',    'Profile reverts per session'),

  -- Free explicitly keeps everything the product promises will stay free, so
  -- no future edit can quietly move one behind the paywall without deleting a
  -- row that says otherwise.
  ('free',    'canBrowseProfiles',      'boolean', 'true',  'Browse and discover profiles'),
  ('premium', 'canBrowseProfiles',      'boolean', 'true',  'Browse and discover profiles'),

  ('free',    'canUseDiscoveryFilters', 'boolean', 'true',  'Age, city, language, relationship filters'),
  ('premium', 'canUseDiscoveryFilters', 'boolean', 'true',  'Age, city, language, relationship filters'),

  ('free',    'canExpressInterest',     'boolean', 'true',  'Express interest in a profile'),
  ('premium', 'canExpressInterest',     'boolean', 'true',  'Express interest in a profile'),

  ('free',    'canMessageConnections',  'boolean', 'true',  'Message someone after connecting'),
  ('premium', 'canMessageConnections',  'boolean', 'true',  'Message someone after connecting')
on conflict (tier, key) do update
  set kind        = excluded.kind,
      value       = excluded.value,
      description = excluded.description;
