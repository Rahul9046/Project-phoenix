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
| [BUILD_REVIEW_WORKFLOW.md](BUILD_REVIEW_WORKFLOW.md) | Generating the review package for an outside reviewer |

## Status

The product is built and deployed at `eraya.app`, on both the web and an Expo
app: sign-in by emailed code, onboarding, discovery, interest, connections,
messaging, blocking, reporting with a moderation queue, account deletion, and
Premium bought through Razorpay.

Three things are deliberately not finished, and the documents say so where they
come up rather than implying otherwise:

- **Phone verification is mocked.** Any six digits pass and no SMS is sent, so
  nothing in the product may show a "verified number" mark. Real SMS needs DLT
  registration.
- **Razorpay is in test mode.** No live key is configured; no real money moves.
- **Privacy policy and terms are placeholders.** India's DPDP Act applies and
  both app stores require them. This is a launch blocker.

Where a document still describes intent rather than shipped behaviour, it says
so in place.
