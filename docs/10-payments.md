# Payments

Eraya sells prepaid Premium. There is no mandate, nothing renews, and there is
nothing to cancel — a term ends when it ends and the person decides whether to
buy another. Nothing in the product should say "subscription", "renews" or
"cancel anytime", because none of it is true.

Everything below is **test mode**. No live key is configured and no real money
can be taken.

## What it costs

| Plan | Code | Price |
| --- | --- | --- |
| Monthly, first ever purchase | `premium_monthly` | ₹199 |
| Monthly, after that | `premium_monthly` | ₹299 |
| Quarterly | `premium_quarterly` | ₹699 |
| Half-yearly | `premium_half_yearly` | ₹1,299 |
| Annual | `premium_annual` | ₹2,399 |

Prices live in `membership_plans`, in integer paise. Nothing computes a
discount at runtime: ₹2,399 is a price, not a saving, and presenting it as one
would invent a claim the product does not make.

### The ₹199 rule

The introductory price applies to somebody's **first ever** one-month purchase
and never again. Eligibility is a fact about payments rather than a flag
anywhere: *no paid payment of this member carries `intro_offer_applied`*.

That means reinstalling the app, clearing storage, signing in on another device
or on the website cannot restore it — and a cancelled or failed attempt never
consumes it, because only a `paid` row counts.

## How a purchase works

```
client sends a plan code
    ↓
payments-create-order      server picks the price and the intro eligibility,
                           writes a `payments` row, then creates the order
    ↓
Razorpay checkout          the browser's own window, on both clients
    ↓
payments-verify            checks the signature against the key secret
    ↓
settle_payment             marks paid, extends the term — once, ever
```

`payments-webhook` runs the same settlement independently, and is the path that
does not depend on anybody still holding a phone.

### Where the checkout page lives

The website runs Razorpay inside its membership screen: it already has the
session and never needs to leave the page. The app has no native Razorpay module
on purpose, so it opens a browser instead -- at
`apps/web/src/app/checkout/page.tsx`, which opens the sheet and hands the result
back to `eraya://payment`.

That page was an edge function once. It cannot be: HTML returned from a function
on the shared `*.supabase.co` domain is served as `text/plain` under a
`default-src 'none'; sandbox` CSP, injected by the platform after the function
returns, so the page arrives as source text and no script on it runs. The
`Content-Type` set in the handler is discarded while its other headers survive,
which is how to recognise this from the outside. Only a domain that may serve
HTML can host it, so a custom domain on the functions would work too -- hosting
it on the site the product already has costs nothing extra.

It holds no secret, decides no price and proves nothing, and needs no session:
the order id it carries was created and priced by the server for a member who
was authenticated at the time, and buys nothing on its own.

### What the client is never trusted with

- **The amount.** A client sends a plan code. An order asking to pay ₹1 for
  twelve months carries no amount to honour.
- **Whether it paid.** A verified signature, or Razorpay's own record of the
  order, is the only thing that grants Premium.
- **Its own entitlement.** `payments` has no client write policy at all, and
  `subscriptions` has had none since it was written.

### Idempotency

`settle_payment` locks the payment row and returns early if it is already paid.
Whichever arrives first — the checkout callback, the webhook, or a
reconciliation — buys the term, and the rest return what it did. Webhook
deliveries are additionally claimed by Razorpay's own event id in a single
statement, so a retry changes nothing.

### Stacking

Time already paid for is never discarded. A new term starts from
`max(now, current expiry)`, decided inside one locked statement so two
settlements arriving together cannot each add a month to the same starting
point.

Premium expiring on 15 October, plus three months bought on 1 October, ends on
15 January.

Durations are calendar months (`+ 1 month`), not 30-day blocks. Postgres handles
the awkward end of the month: 31 January plus one month is 28 February.

### Expiry

Premium is a date, not a boolean. `current_period_end > now()` is the rule, and
nothing depends on a nightly job having run -- a job that has not run yet is a
member with access they have not paid for.

**Nothing writes `expired`.** No trigger, no job, no `pg_cron`. The enum value
exists and is produced by exactly one thing, `revoke_payment`, when a revocation
leaves no time behind. So a lapsed term sits at `active` indefinitely, and that
is the normal state of every expired membership rather than a fault.

Which means every reader must compare the date, and until 2026-10-03 three of
them did not: `loadMembership()` on the web, `readTier()` on mobile, and
`revert_last_pass()` / `reverts_remaining()` in SQL all decided premium from
`status` alone and went on granting it for ever. The rule now has one home:

- `has_active_premium(profile)` is the authority in SQL, and the two revert
  functions go through it rather than restating the test.
- `my_membership()` applies the same rule and is what both clients ask. Neither
  compares a date itself: on the web that would be a second clock, and on a
  phone it would be a clock the member can set.

`npm run payments:probe` asserts each reader separately against a term that has
lapsed while still saying `active`. Asserting only `my_membership` is how the
other three stayed broken for a month -- it was the one that was already right.

## Reconciliation

Apps close mid-payment, callbacks are lost, and networks disappear between the
bank and the phone. When a client returns with only an order id,
`payments-verify` asks Razorpay for the order's payments and believes that
instead. Somebody whose money left their account must never need a support
conversation to get what they paid for.

Where the answer is not yet knowable, both clients say the payment is being
confirmed. They never say "you have not been charged" unless the person
cancelled the sheet themselves.

### A decline is recorded, not only reported

When Razorpay reports a declined payment and no captured one, `payments-verify`
settles the row as `failed` before answering. It used to answer and stop, which
left the row at `created` for ever: the member's payment history showed an
attempt that never resolved, `failed_at` was never set, and our record could not
be reconciled against Razorpay's — theirs held a decline, ours held an open
attempt.

The provider's payment id is stored, and the provider's stated reason is written
to the function log as `payment_declined` with `error_code`, `error_step`,
`error_reason` and `error_description`. Those describe the transaction, not the
person: no name, no card, no contact details.

The reason is logged and never shown. What somebody reads is decided by the
product — a bank's wording is not ours to put in their mouth — but a decline
nobody can explain afterwards is a support conversation with no evidence in it.

### `unconfirmed` is not `failed`

The mobile client has five outcomes plus `unconfirmed`, which exists because
`unknown_order` and `invalid_signature` come back as HTTP 200 and used to fall
through to `failed`. That told somebody their bank had declined a payment their
bank may well have taken, and told them nothing was charged when we had not
established it. Both halves were unverifiable.

`unconfirmed` means the fault is ours. It is kept apart from `failed` because
calling it a decline invents a reason, and apart from `unavailable` because the
network was fine and money may have moved. It is also excluded from the
`payment_failed` analytics event: counting our own bugs as declined payments
corrupts the number used to judge whether the provider is performing.

### International cards are refused

Razorpay rejects them with `international_transaction_not_allowed` and
`error_source: business` — the account's own configuration, not a bank. This is
the default for Indian merchant accounts and applies in live mode as much as in
test.

It is a real constraint, not a test artefact: anyone paying with a non-Indian
card cannot pay at all, and "try a different method" does not help somebody
whose only card is foreign. Indians living abroad are a plausible part of this
audience. Enabling international payments is an application to Razorpay with its
own fees and compliance, so it is a commercial decision — see
[07-open-questions.md](07-open-questions.md).

Note for testing: `4111 1111 1111 1111` is classified international and always
fails here. Use a domestic test card — `5267 3181 8797 5449` (Mastercard) or
`4718 6091 0820 4366` (Visa) — or UPI `success@razorpay`.

## Environment

Set as Supabase edge function secrets — never in `.env.local`, never prefixed
`NEXT_PUBLIC_` or `EXPO_PUBLIC_`:

```
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

The **key id** is public by design; Razorpay's checkout identifies the merchant
with it. It is served to clients by the order endpoint rather than configured in
two apps, so test and live cannot drift apart between them.

Test and live are told apart by the key itself (`rzp_test_` / `rzp_live_`)
rather than by a separate flag, because a flag can disagree with the key
actually in use — and the failure mode of that disagreement is taking real money
while believing otherwise.

### `EXPO_PUBLIC_SITE_URL` — the one that fails silently

The mobile app builds its checkout address from this. Unset, `siteUrl()` returns
an empty string, the URL becomes a schemeless `/checkout?…`, no payment sheet
ever opens, and the order is left at `created`. There is no error and nothing in
the log: it looks exactly like somebody deciding not to pay.

Development never sees it. A dev client reads `.env.local` through Metro, so a
value there works. **EAS builds do not read `.env.local`** — `preview` and
`production` take environment variables from EAS, and until it is set there,
every distributed build has payments quietly broken:

```
npx eas-cli env:list preview
npx eas-cli env:create --scope project --name EXPO_PUBLIC_SITE_URL \
  --value https://eraya.app --environment preview
```

It must point at the deployed web app, because that is where `/checkout` lives. See [06-technical.md](06-technical.md).

## Dashboard setup

1. **Settings → API Keys** → generate test keys → set `RAZORPAY_KEY_ID` and
   `RAZORPAY_KEY_SECRET` as Supabase secrets.
2. **Settings → Webhooks → Add New Webhook**
   - URL: `https://<project-ref>.supabase.co/functions/v1/payments-webhook`
   - Secret: choose one, then set it as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`
3. Deploy. A plain deploy is now correct:

```
supabase functions deploy payments-create-order payments-verify payments-webhook
```

**The JWT exemption is in `supabase/config.toml`, not in a flag you have to
remember.** `[functions.payments-webhook] verify_jwt = false` is read by
`supabase functions deploy`, so the webhook keeps its exemption and the other
two keep their requirement without anybody passing anything.

It used to live in a sentence in this file. A plain
`supabase functions deploy payments-webhook` applied the default, turned
verification back on, and every Razorpay delivery started coming back 401 --
with nothing failing anywhere visible, and the only thing still settling a
payment being a client happening to return and reconcile. A successful-looking
deploy that breaks payments, which is the same trap `npm run config:push` exists
to prevent for the auth config.

`--no-verify-jwt` still works and is now redundant. Note the section is read at
**deploy** time and not by `supabase config push`, so a change to it takes
effect on the next deploy of that function and not before.

Why the webhook and not the other two: Razorpay has no Supabase session and
never will, so there is no JWT to verify -- its signature is the authentication,
recomputed over the raw request bytes before anything is parsed. The other two
are called by a signed-in client through `functions.invoke`, which sends the
member's token, and they need it: an order must belong to somebody.
`npm run payments:probe` asserts all three stanzas, so a sweep that turned
verification off everywhere would fail.

## Refunds and revocation

A **full** refund now takes the membership back. Until 2026-10-03 it did not:
refund events were recorded as seen and changed no entitlement, so money could
go back while Premium stayed. The gap underneath that was larger than refunds --
nothing in the system could shorten or end a term, for any reason.

### The primitive

`revoke_payment(provider, order_id, kind, ...)` withdraws the months one settled
payment granted. It knows nothing about Razorpay: a refund, a chargeback, a
Google Play `VOIDED_PURCHASE` and a correction somebody is making by hand are
the same operation, and `kind` is the only difference between them.

**It subtracts rather than rebuilds, and that is the whole design.** A member's
term is the accumulation of every payment they have made -- one month bought on
the 1st and three months bought on the 5th are a single row ending four months
out, not two rows. So revoking the one-month payment cannot mean ending the
term, which would destroy three months somebody paid for and did not get back.
It means taking back the months *that* payment added:
`current_period_end - period_months`.

Calendar arithmetic is not perfectly associative -- 31 January plus a month
minus a month is 28 January -- so a term straddling a short month can land a day
or two from where a full replay would put it. Accepted, in exchange for never
destroying a purchase it was not asked to touch.

When the subtraction leaves nothing, the term is floored one microsecond past
its own start: the least `subscriptions_period_order` accepts, past rather than
future, and without rewriting when the membership began. The row is set to
`expired` -- the only thing in the project that writes that value.

**Idempotent**, on `payment_revocations.payment_id`, which is unique. A provider
that sends a refund twice, a webhook retried after a timeout, and a human
pressing the button again all find the payment already revoked and change
nothing. Serialised by `for update` on the payment row, so of two arriving
together one revokes and the other is told what the first did.

And **a revoked payment can never buy the time back.** `settle_payment` refuses
one outright. That guard is load-bearing: Razorpay goes on reporting a refunded
payment as `captured` -- the capture happened, the refund is a separate entity
against it -- so without it, a member refunded on Monday could press "check
again" on Tuesday and have the term handed back. The old early return on `paid`
would not have caught it, because the row says `refunded`.

Nobody but the service role can call it. `payment_revocations` has RLS on and
**no policies at all**, not even a select: the member-visible fact is
`payments.status`, which `my_payments()` already returns.

### Partial refunds are still undecided

`refund.processed` is compared against the amount in the `payments` row -- ours,
written before Razorpay was ever called, not the figure in the payload. Anything
short of the full amount is logged as `webhook_refund_partial` and changes no
entitlement.

That is deliberate and it is not a policy. What a partial refund should do to a
prepaid term is a product decision nobody has made, and guessing in the member's
disfavour is how somebody loses three months over a small goodwill adjustment.
`payments.status` has `partially_refunded` ready for when the decision exists.

`refund.created` is also ignored: a refund that has been initiated is not a
refund that has settled, and withdrawing a membership on the strength of an
intention that may still fail is the wrong way round.

## Open question: app store billing

**This needs a decision before either app is submitted.**

Apple and Google generally require their own in-app purchase billing for digital
goods consumed inside an app, and Razorpay is not that. Eraya Premium is a
digital good.

Nothing here is designed around that uncertainty, but the seam is deliberate:
mobile purchasing goes through one module,
`apps/mobile/src/features/membership/payments.ts`. Swapping it for store billing
does not touch the schema, the entitlement model, the stacking rules or the web
checkout.

Worth confirming with both stores before release, and worth knowing that the
answer differs for a "reader" app, for a service consumed outside the app, and
for one that is neither.

## Going live

Not part of this work, and not to be done casually. Before a live key is set:

- Razorpay KYC and account activation completed
- a live webhook configured against the production URL, with its own secret --
  test-mode and live-mode webhooks are separate in Razorpay, and a test secret
  will not verify a live delivery
- `refund.processed` subscribed on the live webhook, or a full refund silently
  leaves the membership standing
- the app store billing question above answered
- **partial** refund policy decided and written down; full refunds are handled
- `payments` reviewed once against real settlement data

Done as of 2026-10-03, and worth not undoing:

- every entitlement reader compares the date (see Expiry)
- Premium advertises only `revertLimit`, the one capability it enforces
- revocation exists, is idempotent, and is safe against stacked purchases
- order lookups are scoped by `(provider, provider_order_id)`
- the webhook's JWT exemption is in `config.toml`

All five are asserted by `npm run payments:probe`, which is the evidence --
there are no tests and no staging environment.
