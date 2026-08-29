-- Give the plans names, and a line explaining who each suits.
--
-- They were labelled by duration alone -- "3 months", "12 months" -- which
-- describes the term without naming the thing being bought. Monthly, quarterly,
-- half-yearly and annual are the words Indian banking and insurance already use,
-- so they read as familiar rather than invented, which matters for an audience
-- that is not uniformly comfortable with app conventions.
--
-- Deliberately NOT tier names. Bronze/silver/gold would imply the plans differ
-- in what they include; they do not. Every term buys the same Premium
-- membership, and only the length changes.

alter table public.membership_plans
  add column if not exists description text;

comment on column public.membership_plans.description is
  'One line on who the term suits. Shown on the pricing page beneath the name.';

update public.membership_plans set
  name = 'Monthly',
  description = 'Month by month, for as long as you want it.'
  where code = 'premium_monthly';

update public.membership_plans set
  name = 'Quarterly',
  description = 'Three months, paid once.'
  where code = 'premium_quarterly';

update public.membership_plans set
  name = 'Half-yearly',
  description = 'Six months, paid once.'
  where code = 'premium_half_yearly';

update public.membership_plans set
  name = 'Annual',
  description = 'Twelve months, paid once.'
  where code = 'premium_annual';
