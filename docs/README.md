# Eraya — specification

Eraya is a trusted relationship platform for divorced, separated and widowed
people in India, built by Phoenix Origins.

These documents are the reference for what Eraya is, how it should look and
sound, and what has actually been built so far. They describe decisions, not
aspirations — where something is undecided it is listed in
[07-open-questions.md](07-open-questions.md) rather than guessed at.

| Document | What it covers |
| --- | --- |
| [01-product.md](01-product.md) | What Eraya is, who it is for, MVP scope |
| [02-brand.md](02-brand.md) | Name, logo, palette, typography, what to avoid |
| [03-design-system.md](03-design-system.md) | Tokens and the component inventory |
| [04-landing-page.md](04-landing-page.md) | Section-by-section intent of the landing page |
| [05-content.md](05-content.md) | Voice, wording rules, claims we may and may not make |
| [06-technical.md](06-technical.md) | Stack, structure, accessibility and performance rules |
| [07-open-questions.md](07-open-questions.md) | Decisions still to be made, and known gaps |
| [08-backend.md](08-backend.md) | Schema, Row Level Security, and the rules the database enforces |
| [09-mobile.md](09-mobile.md) | The Expo app: structure, navigation, and what differs from the web |
| [10-payments.md](10-payments.md) | Prepaid Premium, pricing, and why nothing renews |
| [11-moderation-and-analytics.md](11-moderation-and-analytics.md) | The reports queue, who may moderate, and the funnel |
| [12-email-delivery.md](12-email-delivery.md) | The sign-in email, its rate limit, and what raising it costs |
| [13-seo.md](13-seo.md) | Indexing, the SEO probe, and how a guide is written and published |
| [14-google-play.md](14-google-play.md) | Google Play Billing: the products, the credential, the Console blocker, and what is not yet proven |
| [15-android-signing-and-distribution.md](15-android-signing-and-distribution.md) | How the beta is built and signed, and the open question about Play distribution |
| [16-ios.md](16-ios.md) | The iOS build: identity, permissions, why Premium is unbuyable there, and what TestFlight still needs |
| [BUILD_REVIEW_WORKFLOW.md](BUILD_REVIEW_WORKFLOW.md) | Generating the review package for an outside reviewer |

## Status

The product is built and deployed at `eraya.app`, on both the web and an Expo
app: sign-in by emailed code, onboarding, discovery, interest, connections,
messaging, blocking, reporting with a moderation queue, account deletion, and
Premium — bought through Razorpay on the web and on iOS, and through Google Play
Billing on Android.

Four things are deliberately not finished, and the documents say so where they
come up rather than implying otherwise:

- **Phone verification is real on the web and unavailable in the app.** A real
  Indian number has been verified on `eraya.app` through MSG91. The app uses
  MSG91's OTP API instead of the browser widget, and that path needs a
  DLT-approved template before anything can be delivered, so in the app the step
  cannot currently be completed. It is optional on both clients and blocks
  nobody. Only a member MSG91 actually verified is ever shown a "verified number"
  mark.
- **Razorpay is in test mode.** No live key is configured; no real money moves.
  On iOS, Premium is not for sale at all and the app says so --
  [16-ios.md](16-ios.md). No iOS build has been signed or installed.
- **Google Play cannot take money yet.** The client and the server side are
  built, but the Play products do not exist, the Play edge functions are
  undeployed, and the Console work is blocked while Google verifies the developer
  identity. **No Play purchase has been made and no device test has happened** —
  see [14-google-play.md](14-google-play.md). The Android build people download
  from eraya.app is unaffected: it is sideloaded, not a Play build, and keeps the
  Razorpay checkout it has always used.
- **Privacy policy and terms are placeholders.** India's DPDP Act applies and
  both app stores require them. This is a launch blocker.

Where a document still describes intent rather than shipped behaviour, it says
so in place.
