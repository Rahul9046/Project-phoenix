# Payments

Eraya sells prepaid Premium. There is no mandate, nothing renews, and there is
nothing to cancel — a term ends when it ends and the person decides whether to
buy another. Nothing in the product should say "subscription", "renews" or
"cancel anytime", because none of it is true.

That one sentence decides the shape of everything below, including the Google
Play work: because a term does not renew, Play sells Eraya Premium as **one-time
consumable products** and not as Play subscriptions. A Play subscription would
auto-renew, and an auto-renewal is the thing this product has decided not to do.

**Two providers, one membership.** Razorpay takes the money on the web and on
iOS. Google Play takes it on Android, because an app distributed through the Play
Store has to sell digital goods through Play Billing. Both arrive at the same
`settle_payment`, so a Play term and a Razorpay term are the same row under the
same stacking, expiry and revocation rules — not two systems that resemble each
other. This document is the model. The Play Console surface, its configuration
and its testing path are [14-google-play.md](14-google-play.md).

**State, stated precisely because it is easy to overstate.** Razorpay is in
**test mode**: no live key is configured and no real money can be taken. Google
Play cannot take money at all yet — the products do not exist, the two mapping
columns are NULL, the two Play edge functions are undeployed, and no Play
purchase has ever been executed, on a device or anywhere else. See
[14-google-play.md](14-google-play.md) for what is blocked and why.

## What it costs

| Plan | Code | Price | Play product column |
| --- | --- | --- | --- |
| Monthly, first ever purchase | `premium_monthly` | ₹199 | `play_intro_product_id` |
| Monthly, after that | `premium_monthly` | ₹299 | `play_product_id` |
| Quarterly | `premium_quarterly` | ₹699 | `play_product_id` |
| Half-yearly | `premium_half_yearly` | ₹1,299 | `play_product_id` |
| Annual | `premium_annual` | ₹2,399 | `play_product_id` |

Prices live in `membership_plans`, in integer paise. Nothing computes a
discount at runtime: ₹2,399 is a price, not a saving, and presenting it as one
would invent a claim the product does not make.

**Four plans, five Play products.** A Play one-time product carries exactly one
price, and the monthly plan has two, so ₹199 and ₹299 are two separate products
rather than one with a discount. Which of a plan's two columns applies to a given
purchase is decided by the server from the payment row's `intro_offer_applied`,
exactly as the amount already is — never by the phone.

**Both columns are NULL today, on every plan.** No product id has been invented
or written. The ids are created in Play Console first and only then recorded
here; `payments-play-begin` refuses to start a purchase whose required column is
null, which is the feature being off in the safe direction. See
[14-google-play.md](14-google-play.md).

### The ₹199 rule

The introductory price applies to somebody's **first ever** one-month purchase
and never again. Eligibility is a fact about payments rather than a flag
anywhere: *no paid payment of this member carries `intro_offer_applied`*.

That means reinstalling the app, clearing storage, signing in on another device
or on the website cannot restore it — and a cancelled or failed attempt never
consumes it, because only a `paid` row counts.

## How a purchase works

Two routes, one ending. Which one a client takes is decided by the platform and
nothing else.

**Razorpay — the web and iOS**

```
client sends a plan code
    ↓
payments-create-order      server picks the price and the intro eligibility,
                           writes a `payments` row, then creates the order
    ↓
Razorpay checkout          the browser's own window
    ↓
payments-verify            checks the signature against the key secret
    ↓
settle_payment             marks paid, extends the term — once, ever
```

`payments-webhook` runs the same settlement independently, and is the path that
does not depend on anybody still holding a phone.

**Google Play — Android**

```
client sends a plan code
    ↓
payments-play-begin        server picks the price and the intro eligibility,
                           writes a `payments` row, then returns the product id
                           to buy — there is no order to create
    ↓
Play billing sheet         native, carrying the payment row's own uuid as
                           `obfuscatedProfileId`
    ↓
payments-play-verify       asks the Android Publisher API what the token really
                           is, then grants — and only then acknowledges
    ↓
settle_payment             the same function, the same row, the same term
```

Play has no webhook equivalent in place: Real-time Developer Notifications are
not built. Recovery therefore rests on the client asking again — see
[Reconciliation](#reconciliation).

### The invariants, and where each one is enforced

These are the rules that must survive a future change. Each names the code that
holds it up, so a reader can check rather than trust.

- **Android never falls back to Razorpay for Premium.** `purchase()` in
  `apps/mobile/src/features/membership/payments.ts` dispatches on
  `usesPlayBilling()`, which is `Platform.OS === "android"`. It is deliberately
  not a feature flag: shipping an Android build that opened a web checkout for
  Premium would breach Play's payments policy, so it must not be switchable.
- **The web's Razorpay path is unchanged by any of the Play work.** Phase 2a
  (`f9f78bc`) touched no file under `apps/`; Phase 2b (`9c91857`) touched
  `apps/web` only to regenerate `database.types.ts`.
- **A store's word is not a grant.** A `purchaseToken` from a client is a lookup
  key, exactly as a Razorpay callback is a claim. Entitlement comes from
  `payments-play-verify` asking Google, never from the device.
- **An unverified purchase never grants Premium.** Six checks stand between a
  token and a term, listed in [14-google-play.md](14-google-play.md).
- **Acknowledgement happens after the grant, never before.** Play revokes an
  unacknowledged purchase after three days, so the order is: grant, then tell the
  store. A failed acknowledgement leaves `payments.acknowledged_at` null, which
  is what makes the retry findable.
- **The amount and the eligibility are the server's.** `begin_payment` decides
  both for both providers. A client sends a plan code and nothing else.
- **Play product ids come from `membership_plans`.** Nothing invents, chooses or
  edits one, on either side of the wire.

### Where the checkout page lives

Razorpay only. The website runs Razorpay inside its membership screen: it already
has the session and never needs to leave the page. On iOS the app has no native
Razorpay module on purpose, so it opens a browser instead -- at
`apps/web/src/app/checkout/page.tsx`, which opens the sheet and hands the result
back to `eraya://payment`.

Android does not open this page at all, and `EXPO_PUBLIC_SITE_URL` is therefore
not on the Android purchase path.

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
- **Whether it paid.** A verified signature, Razorpay's own record of the order,
  or the Android Publisher API's answer about a token — one of those three is the
  only thing that grants Premium.
- **Which payment a Play token belongs to.** The client never says. The payment
  row's uuid travels to Google as `obfuscatedProfileId` and comes back verbatim,
  so the server does the matching. Letting a client name the payment is how
  somebody would have an expensive term settled against a cheap purchase, or
  somebody else's purchase applied to their own account.
- **Which Play product to charge for.** Read from `membership_plans` by the
  server; the client is told the id, it does not choose it.
- **Its own entitlement.** `payments` has no client write policy at all, and
  `subscriptions` has had none since it was written.

### Idempotency

`settle_payment` locks the payment row and returns early if it is already paid.
Whichever arrives first — the checkout callback, the webhook, a reconciliation,
or a Play recovery sweep — buys the term, and the rest return what it did.
Webhook deliveries are additionally claimed by the provider's own event id in a
single statement, so a retry changes nothing.

That claim is **scoped to the provider**, since Phase 2a. `payment_events` has
always been keyed `(provider, provider_event_id)`, but the function writing it
was not, so a Google notification id would have been deduplicated inside
Razorpay's namespace. Two providers issue opaque ids that share no namespace, and
the cost of that collision is a dropped `VOIDED_PURCHASE` — a refunded member
keeping Premium.

Play adds one more idempotent fact: `payments.acknowledged_at`. Null means Google
has not confirmed the acknowledgement, which is deliberately retryable; a verify
call that finds Google already considers the purchase acknowledged reconciles the
column rather than consuming a second time.

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

### Recovering a Play purchase

The same problem with a harder deadline. Play keeps handing an unconsumed
purchase back to the app until it is consumed, and Google refunds one that is
never acknowledged after three days — so a purchase the app failed to verify is
money that goes back by itself unless something finds it.

Three things look for one, and all three end at `payments-play-verify`:

- a `purchaseUpdatedListener` registered for the life of the process, not the
  life of a screen, so a purchase that settles late — a deferred payment, a sheet
  somebody left open — is still handed to the server;
- `recoverPlayPurchases()`, a sweep over `getAvailablePurchases()`;
- the ordinary purchase call, if the member simply tries again.

The sweep currently runs when the membership screen mounts, and **whether that is
the right scope and timing is an open decision** — see
[07-open-questions.md](07-open-questions.md). Only `paid` and `processing` are
surfaced from a sweep; a leftover the screen cannot explain is left to the
purchase flow rather than raised unprompted at somebody who opened the screen for
an unrelated reason.

The client calls `finishTransaction` only once the server has answered `paid`,
and a failure to do so is swallowed: `payments-play-verify` has already consumed
the purchase through the Publisher API, which is the authoritative
acknowledgement. The client call clears the local Billing queue and is a
backstop, not the acknowledgement itself.

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

The mobile client has six outcomes plus `unconfirmed`, which exists because
`unknown_order` and `invalid_signature` come back as HTTP 200 and used to fall
through to `failed`. That told somebody their bank had declined a payment their
bank may well have taken, and told them nothing was charged when we had not
established it. Both halves were unverifiable.

`unconfirmed` means the fault is ours. It is kept apart from `failed` because
calling it a decline invents a reason, and apart from `unavailable` because the
network was fine and money may have moved. It is also excluded from the
`payment_failed` analytics event: counting our own bugs as declined payments
corrupts the number used to judge whether the provider is performing.

### `unconfigured` is neither

The seventh outcome, reachable on Google Play only. It means a plan has no Play
product to sell — the column is NULL, or it names a product that does not exist
in Play Console — and therefore that **nobody has been charged**.

Kept apart from `unavailable`, which means try again, and from `unconfirmed`,
which means we do not know what happened to your money. This one means your money
was never asked for, and the reason is Eraya's configuration being incomplete.
The button disables rather than inviting a second attempt that cannot work, and
like the two above it is excluded from `payment_failed`: our own unfinished setup
must not appear in the number that judges a provider.

This is the state the Android client is in today, for every plan.

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
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON     # not set yet
```

`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is the credential `payments-play-verify` uses
to ask the Android Publisher API what a token is. It is **unset**, which is why
`payments-play-begin` refuses before writing a row: a purchase this server cannot
verify must never be started, or the member pays Google and holds nothing that
can grant them a term. Treat it as service-role-grade — it can read and consume
purchases for the whole app. What it needs and how it is created is in
[14-google-play.md](14-google-play.md).

The **key id** is public by design; Razorpay's checkout identifies the merchant
with it. It is served to clients by the order endpoint rather than configured in
two apps, so test and live cannot drift apart between them.

Test and live are told apart by the key itself (`rzp_test_` / `rzp_live_`)
rather than by a separate flag, because a flag can disagree with the key
actually in use — and the failure mode of that disagreement is taking real money
while believing otherwise.

### `EXPO_PUBLIC_SITE_URL` — the one that fails silently

The mobile app builds its Razorpay checkout address from this, which since Phase
2b means **iOS**: the Android purchase path never opens the web checkout and does
not read it. Unset, `siteUrl()` returns an empty string, the URL becomes a
schemeless `/checkout?…`, no payment sheet ever opens, and the order is left at
`created`. There is no error and nothing in the log: it looks exactly like
somebody deciding not to pay.

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

## Razorpay dashboard setup

Google Play's equivalent — the products, the service account, the testing track —
is [14-google-play.md](14-google-play.md), and none of it is done.

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

The two Play functions are **not** in that line, because they are not deployed:

```
# not run — see 14-google-play.md for what must exist first
supabase functions deploy payments-play-begin payments-play-verify
```

**The JWT exemption is in `supabase/config.toml`, not in a flag you have to
remember.** `[functions.payments-webhook] verify_jwt = false` is read by
`supabase functions deploy`, so the webhook keeps its exemption and the other
four keep their requirement without anybody passing anything.

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

Why the webhook and not the others: Razorpay has no Supabase session and never
will, so there is no JWT to verify -- its signature is the authentication,
recomputed over the raw request bytes before anything is parsed. The other four
are called by a signed-in client through `functions.invoke`, which sends the
member's token, and they need it: an order must belong to somebody, and a Play
purchase must be verified against the member who is actually signed in.
`npm run payments:probe` asserts all five stanzas, so a sweep that turned
verification off everywhere would fail. It also asserts that **no** stanza exists
for a Play webhook, since Real-time Developer Notifications are not built and a
`verify_jwt = false` function appearing before its endpoint would mean something
was deployed unreviewed.

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

**Nothing delivers a Play void yet.** The primitive accepts one; the Real-time
Developer Notification consumer that would call it is not built, so a refunded or
charged-back Play purchase does not currently take Premium back by itself. The
guard below — `settle_payment` refusing a revoked payment — still holds, so a
void applied by hand cannot be undone by a client pressing "check again". Recorded
as a known gap in [07-open-questions.md](07-open-questions.md), not as a design.

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

## App store billing

This was an open question until **2026-10-04** for Google and **2026-10-08** for
Apple. What follows is both answers and the reasoning, kept because the
reasoning is what a future reader needs.

The question was that Apple and Google generally require their own in-app
purchase billing for digital goods consumed inside an app, and Razorpay is not
that. Eraya Premium is a digital good.

The seam that made both answers cheap was deliberate and it held: mobile
purchasing goes through one module,
`apps/mobile/src/features/membership/payments.ts`. Neither answer touched a
Razorpay edge function, a settlement path, a stacking rule, the prices, or
anything in `apps/web` beyond regenerated database types. The schema change was
additive.

**The two stores are answered differently, and separately.**

**Google: Play Billing**, through `expo-iap`, selling **one-time consumable
products** -- not Play subscriptions, because Premium is prepaid and nothing
renews. Prices are unchanged. See [14-google-play.md](14-google-play.md).

**Apple: nothing is for sale.** Premium cannot be bought on iOS at all, as of the
first TestFlight preparation. StoreKit is deliberately not started. Entitlements
already paid for are unaffected, because they are read from `my_membership()`
and no platform or provider appears in that path. See [16-ios.md](16-ios.md).

### Android is two artifacts, not one

This is the part most easily got wrong, and getting it wrong breaks a shipped
app. The same `app.eraya.mobile`, built from the same source, is handed out two
ways, and they are allowed to take money differently:

| Artifact | Distributed by | Premium bought through |
| --- | --- | --- |
| APK from eraya.app | the website, sideloaded | Razorpay browser checkout |
| Play build | Google Play | Google Play Billing |
| iOS | TestFlight, later | nothing -- not for sale |

Play's Payments policy binds apps **distributed on Google Play**. It does not
reach a sideloaded APK, so the public download keeps the Razorpay checkout every
existing install already uses -- and must keep it, because a Billing client in a
build Play never distributed cannot connect: no Play account is entitled to the
app, `initConnection` fails, and the only symptom is a member who cannot pay.

So the dispatch is **not** on `Platform.OS`. Both Android artifacts report
`android`. It is on one value settled before the app runs:

```
distribution.ts   EXPO_PUBLIC_DISTRIBUTION === "play" ? "play" : "direct"
purchasing.ts     paymentProvider: "none" | "razorpay" | "play"
payments.ts       purchase() switches on paymentProvider, exhaustively
```

`EXPO_PUBLIC_DISTRIBUTION` is inlined into the bundle at build time by the same
mechanism as `EXPO_PUBLIC_SITE_URL`, so after a build there is no variable left
to read and nothing to switch. **Absent means `direct`**, deliberately: a Play
build that forgot the variable sells through Razorpay, which is wrong but is
caught statically -- the `play` EAS profile declares it in `eas.json` in version
control and `scripts/payments-probe.mjs` asserts that it does. The opposite
default could not be caught, because it would ship to the public download link
and break purchasing for everybody who installed from the website.

An earlier version of this page, and of `CLAUDE.md`, said the dispatch was on
`Platform.OS` and that Android must never fall back to Razorpay. The second half
is still true of the **Play build** and is enforced there -- `purchase()` returns
`unavailable` or `unconfigured` rather than opening a web checkout. The first
half was correct only while the Play build was going to be the only Android
build; it stopped being correct on 2026-10-06, when the APK became a public
download.

**Neither answer changed anything else on this page.** The web checkout, the
Razorpay edge functions, the schema, the prices, the stacking rules and the
Android Razorpay path are all exactly as described above.

## Going live

Not part of this work, and not to be done casually.

**Razorpay, before a live key is set:**

- Razorpay KYC and account activation completed
- a live webhook configured against the production URL, with its own secret --
  test-mode and live-mode webhooks are separate in Razorpay, and a test secret
  will not verify a live delivery
- `refund.processed` subscribed on the live webhook, or a full refund silently
  leaves the membership standing
- **partial** refund policy decided and written down; full refunds are handled
- `payments` reviewed once against real settlement data

**Google Play, before Android can sell anything.** The full list, its current
blocker and its testing path are in [14-google-play.md](14-google-play.md). In
short: the Play Console work cannot proceed while Google's developer identity
verification is pending, the five products do not exist, the two mapping columns
are NULL, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is unset, and the two edge functions
are undeployed. No Play purchase has been made and no device test has happened.

**Done as of 2026-10-03, and worth not undoing:**

- every entitlement reader compares the date (see Expiry)
- Premium advertises only `revertLimit`, the one capability it enforces
- revocation exists, is idempotent, and is safe against stacked purchases
- order lookups are scoped by `(provider, provider_order_id)`
- the webhook's JWT exemption is in `config.toml`

**Added 2026-10-04, server side, and proven the same way:**

- a payment can name its provider, and a Play row cannot inherit Razorpay
- `payment_events` claims are scoped per provider
- `payments.acknowledged_at` records that the store was told, separately from the
  grant
- a product id identifies exactly one plan
- Razorpay behaviour is unchanged when no provider is passed

All of it is asserted by `npm run payments:probe` -- 96 of 96 on 2026-10-04,
including 25 Google Play checks -- which is the evidence, because there are no
tests and no staging environment. **What the probe cannot do is execute a Play
purchase**: it asserts the schema, the guards and the idempotence, against
production, with no Play token involved anywhere.
