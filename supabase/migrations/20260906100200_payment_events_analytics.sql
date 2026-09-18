-- What people did on the way to paying.
--
-- Separate from `auth_events`, which records whether somebody could get in.
-- These record whether somebody chose to buy, and the questions they answer are
-- different: how many people open the membership screen, which plan they pick,
-- how many abandon the payment sheet, and what a purchase actually costs to
-- win. None of that is answerable from the payments table alone, because the
-- payments table only knows about the people who got as far as an order.
--
-- Deliberately not a payment record. A client writes these and a client can
-- lie, so nothing here is money: the authoritative account of what was charged
-- is `payments`, written by the server after a signature check. If the two ever
-- disagree, `payments` is right.
--
-- What is never written here: card details, UPI ids, signatures, provider
-- secrets, contact details. The properties are a plan code, an amount the
-- server already knows, a flag and a platform.

create table public.product_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),

  event text not null,
  actor uuid references auth.users (id) on delete set null,

  -- Which plan, what it cost, whether the introductory price applied, and
  -- whether this was the app or the website. Constrained by the function below
  -- rather than by shape, so a client cannot use this as free storage.
  plan_code text,
  amount_paise integer,
  intro_offer_applied boolean,
  platform text,

  constraint product_events_known_event check (
    event in (
      'membership_screen_viewed',
      'payment_plan_selected',
      'payment_order_created',
      'payment_checkout_opened',
      'payment_cancelled',
      'payment_failed',
      'payment_verified',
      'premium_activated'
    )
  ),
  constraint product_events_known_platform check (
    platform is null or platform in ('android', 'ios', 'web')
  ),
  constraint product_events_amount_sane check (
    amount_paise is null or (amount_paise >= 0 and amount_paise < 100000000)
  )
);

comment on table public.product_events is
  'Client-reported funnel events. Never money: `payments` is the authoritative record.';

create index product_events_occurred_at_idx
  on public.product_events (occurred_at desc);
create index product_events_event_idx
  on public.product_events (event, occurred_at desc);

-- Operations data, like the rest. RLS on with no policies: no client reads it,
-- signed in or not, and the service role is the only reader.
alter table public.product_events enable row level security;

/*
 * The one way in.
 *
 * Written on the assumption that the caller may be hostile. The event name must
 * be one of the eight; the platform must be one of three; the amount is bounded;
 * the actor is taken from the token rather than from an argument. The worst a
 * determined client achieves is inflating counts of its own funnel, which is
 * worth accepting to get real numbers from real purchases.
 *
 * It never raises. A membership screen that failed because its analytics failed
 * would be a worse product than one with no analytics at all.
 */
create or replace function public.record_product_event(
  event_name text,
  plan_code text default null,
  amount_paise integer default null,
  intro_offer_applied boolean default null,
  platform text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.product_events
    (event, actor, plan_code, amount_paise, intro_offer_applied, platform)
  values (
    event_name,
    (select auth.uid()),
    left(plan_code, 60),
    amount_paise,
    intro_offer_applied,
    platform
  );
exception
  when others then
    -- A rejected event name, a silly amount, anything at all. Swallowed on
    -- purpose: this is a measurement, not a step in a purchase.
    return;
end;
$$;

comment on function public.record_product_event(text, text, integer, boolean, text) is
  'Client-reported funnel event. Constrained, unprivileged, and never fatal.';

revoke execute on function public.record_product_event(text, text, integer, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_product_event(text, text, integer, boolean, text)
  to authenticated;
