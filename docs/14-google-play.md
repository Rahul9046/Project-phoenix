# Google Play Billing

How Eraya sells Premium in the build distributed through Google Play, what
Google requires, and what has not happened yet.

**This is one of two Android artifacts, and the distinction matters throughout.**
The APK people download from eraya.app is sideloaded, is not distributed by Play,
and keeps the Razorpay browser checkout. Nothing in this document applies to it.
See [10-payments.md](10-payments.md#android-is-two-artifacts-not-one).

[10-payments.md](10-payments.md) is the canonical document for the payment and
entitlement model -- pricing, stacking, expiry, refunds, the invariants. This one
covers the Play-specific surface: the products, the credential, the Console work,
the testing path, and the state of each. Where the two meet, this file links
rather than restates.

## State, before anything else

Nothing here is live, and the list is deliberately blunt because every item is
easy to overstate.

| | State |
| --- | --- |
| Migration `20261004100100_google_play_billing` | **Applied to production** 2026-10-04 |
| `payments-play-begin`, `payments-play-verify` | Written, reviewed, statically checked. **Not deployed** |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | **Not set** |
| The five Play products | **Do not exist** |
| `play_product_id`, `play_intro_product_id` | **NULL on every plan** |
| Android client (`expo-iap`, `play-billing.ts`) | Written, bundles cleanly. **No purchase ever executed** |
| `EXPO_PUBLIC_DISTRIBUTION=play` | Declared in the `play` EAS profile. **No build made from it** |
| Real-time Developer Notifications (Phase 2c) | **Not built** |
| Play Console configuration | **Blocked**, see below |

**No Play purchase has been made, by anybody, anywhere.** Not in production, not
on a device, not by a licence tester. Nothing in this document or any other may
be edited to imply otherwise until a purchase has actually happened and been
observed.

## The decision this implements

Settled 2026-10-04.

- **Google Play Billing in the Play build**, because an app distributed through
  the Play Store must sell digital goods through Play. That policy binds apps
  distributed *on Play*; it does not reach the sideloaded APK, which keeps
  Razorpay. The web stays on Razorpay.
- **One-time consumable products, not Play subscriptions.** Premium is prepaid and
  nothing renews; a Play subscription would auto-renew, which is the thing the
  product has decided not to do. Consumable rather than non-consumable because a
  member buys a term again and again.
- **Prices unchanged.** ₹199 introductory and ₹299 standard monthly, ₹699
  quarterly, ₹1,299 half-yearly, ₹2,399 annual.
- **The Play build only.** The Android download is unaffected, and iOS sells
  nothing at all -- Premium is not for sale there and StoreKit is deliberately
  not started. See [16-ios.md](16-ios.md).
- **One entitlement.** A Play purchase grants exactly the Premium a Razorpay
  purchase grants, because it grants it through the same `settle_payment`.

## Which build this is, and how it knows

`usesPlayBilling()` in `apps/mobile/src/features/membership/play-billing.ts`
guards every entry point in that file, so a build that is not the Play build
never opens a Billing connection, never registers the purchase listeners and
never queries a product. It reads `paymentProvider`, which reads
`distributionChannel`, which reads `EXPO_PUBLIC_DISTRIBUTION` -- inlined into the
bundle at build time, so there is nothing left to switch once a build exists.

**Absent means `direct`.** A Play build that forgot the variable would sell
through Razorpay, which is wrong and is caught statically: the `play` profile in
`apps/mobile/eas.json` declares it, and `npm run payments:probe` asserts that the
profile still does. The opposite default could not be caught, because it would
ship to the public download link.

| Build | Command | Provider |
| --- | --- | --- |
| Android download | `eas build -p android --profile preview`, or the local Gradle build in [09-mobile.md](09-mobile.md) | Razorpay |
| Play | `eas build -p android --profile play` | Play Billing |
| iOS | `eas build -p ios --profile production` | none |

To check what a bundle actually resolved to, without a store:

```
npm run play:channel          # what the current environment would build
npm run play:channel -- play  # and what the play profile would build
```

## The five products

Four plans, five products, because a Play one-time product carries exactly one
price and the monthly plan has two.

| Plan code | Price | Column the id belongs in |
| --- | --- | --- |
| `premium_monthly` | ₹199, first ever purchase | `play_intro_product_id` |
| `premium_monthly` | ₹299, every later purchase | `play_product_id` |
| `premium_quarterly` | ₹699 | `play_product_id` |
| `premium_half_yearly` | ₹1,299 | `play_product_id` |
| `premium_annual` | ₹2,399 | `play_product_id` |

**Product ids are created in Play Console first and only then written into
`membership_plans`. Nothing invents one.** Not the client, not a migration, not a
seed. An id in the database that does not exist in Play Console fails in front of
a member with no way to tell whether the id or the Console was wrong, which is
why `20261004100100_google_play_billing.sql` added both columns NULL and left
them NULL.

Two partial unique indexes keep a product id on one plan only, so the annual
product cannot quietly deliver one month. The cross-column case -- the same id
ordinary on one plan and introductory on another -- cannot be expressed as a
plain unique index and is asserted by `scripts/payments-probe.mjs` instead.

**Which column applies is the server's answer, not the client's.** The payment
row's `intro_offer_applied` decides it, and `payments-play-verify` re-checks the
introductory eligibility at verification time rather than trusting what was true
when the sheet opened. The client reads the ids from `membership_plans` only to
ask Play for a localised price, through the existing active-plans select policy
from `20260826100500_membership_rls.sql` -- no new grant was needed and
`membership_catalogue()` was deliberately left alone.

## Verification is the server's, and it is six checks deep

`payments-play-verify` asks the Android Publisher API what a token is. The token
itself proves nothing -- it is a lookup key, and what it looks up has to survive
all six of these before a term is granted:

| Check | What it closes |
| --- | --- |
| Google says `PURCHASED` | the client claiming a purchase, and a `PENDING` one being treated as paid |
| the purchase names our payment row, via `obfuscatedProfileId` | a token being attached to a payment it has nothing to do with |
| the row belongs to the authenticated caller | somebody else's purchase applied to your account |
| the product matches the row -- intro product if and only if the row charged intro | paying ₹199 and receiving twelve months |
| the introductory offer is still unused | an eligibility that changed since the sheet opened |
| quantity is exactly one | Eraya sells terms, not units |

Settlement is `settle_payment` with provider `google_play` -- the same function
the Razorpay webhook calls. It is idempotent, it refuses a revoked payment, and
it stacks onto time already paid for.

### `obfuscatedProfileId` is the whole correlation mechanism

Razorpay mints an order id before the member sees a payment screen. Play has no
such step and hands over a purchase token only after money has moved. So
`payments-play-begin` writes the payment row and sets `provider_order_id` to the
row's **own uuid**, then passes that uuid to Play as `obfuscatedProfileId`. The
Publisher API returns it verbatim, which is how the server ties a token nobody
has seen before back to the payment this member intended.

Only `obfuscatedProfileId` is sent. `obfuscatedAccountId` would hand Google a
stable per-member key, and a per-purchase id is enough.

### Acknowledge after the grant, never before

Google revokes and refunds a purchase that is not acknowledged within three days.
So the order is: verify, grant, then tell the store. If the telling fails,
`payments.acknowledged_at` stays null and the next call retries it; if it never
succeeds, Play voids the purchase and the void is the correct end state rather
than a silent inconsistency.

Consuming is what acknowledges -- there is no separate acknowledgement step for a
consumable. The client's own `finishTransaction` runs only after the server
answers `paid`, and its failure is swallowed: it clears the local Billing queue
and is a backstop, not the acknowledgement.

## Verified Google API facts

Checked against the live API on 2026-10-04, and recorded because each one costs
time to rediscover:

- Reading a purchase is **Publisher API v2** (`purchases.products.get` v2), and
  it takes **no** `productId` -- package name and token only.
- Consuming is **v1** (`purchases.products.consume`). There is no v2 equivalent.
- **Consuming acknowledges.** A separate acknowledge call is not needed for a
  consumable.
- The acknowledgement deadline is **three days**, after which Google refunds and
  revokes.

## The service account

`payments-play-verify` authenticates to the Publisher API with a Google service
account, supplied as `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.

It is **not set**, and until it is, `payments-play-begin` refuses before writing
a row: a purchase this server cannot verify must never be started, or the member
pays Google and holds nothing that can grant a term. The refusal is logged as
`play_not_configured` and the client is told `unavailable`.

Treat the credential as service-role-grade -- it can read and consume purchases
for the whole application. It belongs in Supabase edge-function secrets only,
never in `.env.local`, never prefixed `NEXT_PUBLIC_` or `EXPO_PUBLIC_`, and never
in a client bundle.

## Play Console: what is blocked, and by what

**Google is verifying the developer identity, and that verification gates the
rest.** While it is pending:

- **Contact-phone verification is unavailable.**
- **Android developer verification and package verification are unavailable**,
  because they require the prerequisite verification to complete first.
- The five in-app products therefore cannot be created, which means the two
  mapping columns cannot be filled.
- Nothing can be uploaded to a testing track, so **no Play Billing test of any
  kind is possible** -- not with a licence tester, not internally.

This is a wait, not a task. Nothing in the repository can move it along, and
nothing should be configured around it: `payments-play-begin` already returns
`product_not_configured` and the Android UI already presents that honestly as
`unconfigured` -- the button disables and says purchases are temporarily
unavailable and that nothing has been charged. See
[10-payments.md](10-payments.md#unconfigured-is-neither).

## When the block lifts, in order

Written down now so the order is not re-derived under time pressure. None of it
has been done.

1. Complete Google's developer identity verification, then contact-phone and
   Android developer/package verification.
2. Create the five one-time **consumable** products in Play Console, at the
   prices above.
3. Write their ids into `membership_plans.play_product_id` and
   `play_intro_product_id` -- a migration or a service-role update, never by hand
   in the dashboard, and never invented ahead of step 2.
4. Create the Google service account, grant it the Play Developer API access it
   needs, and set `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` as a Supabase secret.
5. `supabase functions deploy payments-play-begin payments-play-verify`.
6. `npm run config:push` -- never raw `supabase config push`.
7. Configure Play App Signing and the upload key, and upload a build to an
   internal testing track. See
   [15-android-signing-and-distribution.md](15-android-signing-and-distribution.md),
   where the relationship between that identity and the existing sideload beta is
   an open question rather than a settled plan.
8. Add licence testers, then exercise a real purchase of each of the five
   products end to end -- including a deliberate kill between the sheet closing
   and verification, to prove the recovery path.
9. Only then may any document say Play Billing works.

The two `verify_jwt = true` stanzas for the Play functions are already in
`supabase/config.toml`, and `npm run payments:probe` asserts both -- along with
the absence of any Play webhook stanza, since none should exist before Phase 2c.

## What has actually been checked

Honest accounting, because the probes are the only execution this project has.

**Server, Phase 2a.** The migration was pushed to production and
`npm run payments:probe` passed 96 of 96, including all 25 Google Play checks:
Razorpay unchanged when the provider is omitted, provider-scoped event claims,
the shared entitlement, idempotent Play settlement, both product columns present
and NULL. `npm run security` was 63 of 72, whose 9 failures are the pre-existing
`@demo.eraya.invalid` fixture baseline and not this work.

**Client, Phase 2b.** `npm run typecheck`, `npx eslint`, `npm run i18n:check`,
the web unit tests, `npx expo config --type introspect` and **both**
`npx expo export` bundles (android and web) pass. `expo-iap` 5.8.2 was confirmed
against this project's exact `expo` and `react-native` versions, and a static
import was proven safe on web and iOS by exporting those bundles.

**What none of that does is execute a purchase.** There is no Play token in any
check that has been run.

### Two things that are inferences, not artefacts

- **The `com.android.vending.BILLING` permission.** It lives in `expo-iap`'s own
  library manifest and is merged by Gradle at build time. `expo config --type
  introspect` shows nothing that would strip it, and `android.permissions: []`
  produces no blanket removal. But **`prebuild` has not been run and no build has
  been produced**, so the merged manifest has not been observed. Treat the
  permission as expected, not verified.
- **Local validation limits.** This machine has no Docker and no Deno, so a
  migration cannot be executed locally and the edge functions have no type-check
  path at all -- `npm run typecheck` covers `apps/` only and passes with a broken
  edge function. The honest claim after a change to either Play function is
  "reviewed and statically checked", never "tested".

## Open decisions

Recorded here and in [07-open-questions.md](07-open-questions.md). None of them
is to be answered by guessing.

- **Licence-tester purchases grant real Premium.** `payments-play-verify` logs
  `test_purchase: true` and otherwise treats such a purchase as genuine, because
  refusing one would make device testing impossible. Whether to gate that in
  production is a one-line change nobody has decided; the only control over who
  can make such a purchase is the Play Console tester list.
- **The scope and timing of the recovery sweep.** It runs when the membership
  screen mounts. Whether it should also run at launch or after sign-in is
  undecided, and it interacts with Google's three-day window.
- **iOS.** Not answered. See [07-open-questions.md](07-open-questions.md).
- **Phase 2c.** Real-time Developer Notifications, Pub/Sub, and `VOIDED_PURCHASE`
  are not built, so a refunded Play purchase does not currently take Premium back
  by itself.
- **Translations for the `unconfigured` copy.** English only today, pending
  approved copy in all six languages.
