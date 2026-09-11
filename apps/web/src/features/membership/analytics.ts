/**
 * The names a client may record.
 *
 * `product_events` constrains `event` to a known list and the recording
 * function swallows every exception, so that a measurement can never break a
 * purchase. The consequence is that a misspelt event name is discarded in
 * silence -- no error, no log, no row -- and the funnel reads as though nobody
 * reached that step rather than as though the pipeline is broken.
 *
 * A union type is the cheapest place to catch that: a typo stops being a
 * measurement that quietly disappears and becomes a build failure. Mobile
 * declares the same union in `apps/mobile/src/features/membership/analytics.ts`;
 * both are checked against the database's own allowlist by
 * `npm run analytics:probe`, which is what keeps the three in step.
 *
 * Only the payment funnel is listed. Everything before the paywall is recorded
 * by the database on the write itself, so there is no client name to get wrong.
 *
 * Type only, deliberately -- no imports. The web app records from a client
 * component and from server components, which need different Supabase clients,
 * and a module importing either could not be shared by both.
 */
export type ProductEvent =
  | "membership_screen_viewed"
  | "payment_plan_selected"
  | "payment_order_created"
  | "payment_checkout_opened"
  | "payment_cancelled"
  | "payment_failed"
  | "payment_verified"
  | "premium_activated";
