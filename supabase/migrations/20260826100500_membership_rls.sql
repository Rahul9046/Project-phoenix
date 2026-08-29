-- Row Level Security for the membership tables.
--
-- The load-bearing decision here is that `subscriptions` has no insert, update
-- or delete policy for anyone. Membership is granted by whatever takes the
-- money -- a payment webhook running with the service role -- and never by the
-- browser. A client that can write its own subscription row can award itself
-- premium, which makes every entitlement check downstream decorative.

alter table public.membership_plans enable row level security;
alter table public.entitlements     enable row level security;
alter table public.subscriptions    enable row level security;

-- ---------------------------------------------------------------------------
-- Plans and entitlements: reference data, readable by anyone.
--
-- `anon` is included deliberately. Pricing has to be readable before signing
-- up, and hiding what a product costs behind authentication is hostile.
-- ---------------------------------------------------------------------------

create policy "Active plans are readable by everyone"
  on public.membership_plans
  for select
  to anon, authenticated
  using (is_active);

create policy "Entitlements are readable by everyone"
  on public.entitlements
  for select
  to anon, authenticated
  using (true);

-- No write policies. Changing what a plan costs, or what a tier may do, is a
-- migration or an admin action -- never a request from a browser.

-- ---------------------------------------------------------------------------
-- Subscriptions: your own, read-only.
-- ---------------------------------------------------------------------------

create policy "Members can read their own subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

-- Intentionally no insert/update/delete policy, for anyone, including the
-- owner. See the note at the top of this file.
