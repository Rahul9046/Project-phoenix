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

Premium is a date, not a boolean. `my_membership()` reports active only while
`current_period_end > now()`, so nothing depends on a nightly job having run.

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
   - Events: `payment.captured`, `payment.failed`, `order.paid`
3. Deploy with JWT verification **off** for the webhook — Razorpay has no
   Supabase session and never will. The signature is the authentication:

```
supabase functions deploy payments-webhook   --no-verify-jwt
supabase functions deploy payments-create-order payments-verify
```

**One of the three takes no JWT, and it must be deployed with the flag.**
`config.toml` carries no per-function settings, so a plain deploy applies the
default and turns verification back on -- a successful-looking deploy that
breaks payments, the same trap `npm run config:push` exists to prevent.

`payments-webhook` because Razorpay has no Supabase session and never will --
its signature is the authentication.

The other two are called by a signed-in client through `functions.invoke`, which
sends the member's token, and they need it -- an order must belong to somebody.

## Refunds

Razorpay will send refund events. They are recorded as seen and change no
entitlement, deliberately: what a refund should do to a membership is a product
decision nobody has made, and silently removing access is the wrong half to
guess at. `payments.status` has `refunded` and `partially_refunded` ready for
when that decision exists.

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
- a live webhook configured against the production URL, with its own secret
- the app store billing question above answered
- refund policy decided and written down
- `payments` reviewed once against real settlement data
