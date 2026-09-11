-- The allowlist the funnel events have to be on.
--
-- `product_events` constrains `event` to a known list, and
-- `record_product_event` catches every exception and returns, because a
-- measurement must never break a purchase. Together those two sensible
-- decisions have an unpleasant consequence: an event name not on the list is
-- dropped in silence, and nothing anywhere says so. Every event added in
-- `20260911100200_funnel_events.sql` was discarded on the way in -- the triggers
-- fired, the function ran, the insert failed the check, the handler swallowed
-- it, and the table stayed exactly as it was.
--
-- So: adding an event is two changes, not one. The instrumentation, and this
-- list. The funnel failing is invisible by design, which makes the constraint
-- the only thing that will tell you, and only if you go and look.

alter table public.product_events
  drop constraint if exists product_events_known_event;

alter table public.product_events
  add constraint product_events_known_event check (
    event in (
      -- Payments, unchanged.
      'membership_screen_viewed',
      'payment_plan_selected',
      'payment_order_created',
      'payment_checkout_opened',
      'payment_cancelled',
      'payment_failed',
      'payment_verified',
      'premium_activated',

      -- Everything before the paywall.
      'registration_started',
      'onboarding_completed',
      'discovery_viewed',
      'profile_viewed',
      'interest_expressed',
      'connection_created',
      'conversation_started'
    )
  );
