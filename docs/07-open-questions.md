# Open questions and known gaps

Nothing here has been decided. These are recorded rather than guessed at, so
that no invented answer leaks into the product.

## Must be resolved before launch

**Email delivery.** Supabase's built-in email service delivers only to addresses
belonging to members of the project, and caps sending at two messages an hour.
Magic-link sign-in therefore works for the team and silently fails for everyone
else — the "Check your email" screen has no way to tell the difference, so it
reports success either way. Custom SMTP is required before anyone outside the
project can sign in at all, which makes this the first blocker, not one of many.

**Email confirmation.** Nobody receives anything after joining the waitlist. At
minimum this needs a confirmation email; double opt-in would be better, and makes
the list defensible under consent rules. Blocked on the delivery question above.

**Abuse protection.** The form has a honeypot and nothing else. It needs rate
limiting per IP, and probably a challenge, before it is publicly linked.

**Privacy policy and terms.** Both pages currently state honestly that the
documents are being prepared. Real ones are required before collecting
significant personal data, and India's DPDP Act applies.

**Contact address — resolved.** `support@eraya.app` is live on Zoho Mail and is
now the only address the product gives anybody: the website, both clients, and
the auth email. It comes from `apps/web/src/features/marketing/content.ts` on the
web side, so changing it again is one edit there plus the mobile strings.

It replaced `hello@eraya.app`, which was written into six places and never
created. Mail to it bounced, and it was the only address the public holding page
offered — so the single action that page asked for failed silently for everyone
who took it. Worth remembering as a shape: an address in copy is a promise, and
nothing in a build or a test suite checks that the mailbox exists.

Still to confirm: **DKIM for Zoho**. `zoho._domainkey.eraya.app` returns nothing,
though Zoho may use another selector. Check Zoho Mail → Domains, because DMARC is
published at `p=quarantine` and mail that satisfies neither SPF nor DKIM is
quarantined rather than rejected — invisible to the sender.

**One SPF record, two senders.** `eraya.app` publishes
`v=spf1 include:zoho.in ~all`, which authorises Zoho and not Resend — and Resend
is what sends every sign-in code, as `no-reply@eraya.app`. Those emails currently
pass DMARC on Resend's DKIM alone (`resend._domainkey` is published), so delivery
works, but the margin is one broken key wide: if DKIM ever fails, SPF will not
catch it and sign-in codes go to spam with no error anywhere.

Resend's `include:` belongs in the **existing** record, never a second one — two
SPF records is a hard failure for both senders.

**Somewhere to deploy the web app.** Not only the website: the mobile app opens
`/checkout` on it, so until `apps/web` is publicly reachable, payments in any
build handed to anyone outside the team fail silently — no sheet, no error, an
order left at `created`. Development never sees it, because a dev client reads
`.env.local`. See [06-technical.md](06-technical.md) and
[10-payments.md](10-payments.md).

**International cards cannot pay.** Razorpay refuses them with
`international_transaction_not_allowed` and `error_source: business` — the
account's own configuration, the default for Indian merchants, and true in live
mode as much as in test. Anyone whose only card is foreign reaches the payment
screen and cannot get past it; "use a different method" is no help to them.

This is a commercial decision, not an engineering one. Eraya is India-only by
design, but Indians living abroad are a plausible part of an audience of
divorced, separated and widowed people, and they are exactly the segment most
likely to be paying with a foreign card. Enabling international payments is an
application to Razorpay carrying higher fees and additional compliance.
Answering it "no" is legitimate; answering it by accident is not.

## Brand — defects in the supplied logo pack

Two problems in `assets/brand/` that need a corrected export. The mark geometry
itself is fine and is used as supplied; these concern the framing.

**`eraya-approved-horizontal.svg` is unusable as delivered.** Three faults:

1. The mark is drawn at `scale(4.2)`, which puts its bottom edge at y≈803 in a
   viewBox only 700 tall — the mark is clipped.
2. The wordmark `<text>` starts at x=360, while the mark spans x≈138–723, so
   the two overlap.
3. The wordmark is `<text>` in `font-family="Georgia, Times New Roman, serif"`
   — a system fallback, not a brand typeface. It would render differently on
   every machine and cannot be relied on.

The site therefore typesets "Eraya" in Manrope beside the mark instead. A
corrected lockup with outlined text is needed before the logo is used anywhere
outside this codebase.

**The mark is off-centre in the square lockups.** In `primary`, `dark`, `light`,
`monochrome` and `reversed`, the tile runs x 24–1000, y 45–979 while the mark's
bounding box centres on (477, 538) against a tile centre of (512, 512) — about
35px left and 26px low, roughly 3.6% and 2.7% of the tile. `favicon` has the
same offset against its full-bleed tile.

It is reproduced faithfully rather than silently corrected. Whether that offset
is intentional optical balance or an export artifact is a question for whoever
drew it. Re-centring is a one-line change in `ErayaMark`.

## Brand — other

- The wordmark casing is unresolved: the supplied lockup sets it lowercase
  ("eraya") with the tagline "A NEW BEGINNING, TOGETHER."; the site uses "Eraya"
  with no tagline, matching the product name used throughout the copy.
- The mark has not been reviewed at small sizes — favicon, app icon, a 32px
  header tile on a low-resolution screen. The three paths are fine strokes and
  may not hold below 24px.
- Manrope is the settled choice and is now the only typeface, on both clients.
  If a secondary editorial face is ever commissioned for marketing, `--font-sans`
  and the `--text-*` scale in `globals.css`, plus `theme/typography.ts` on
  mobile, are the only places to change.
- No Devanagari, Telugu or Bengali type has been specified, which matters if the
  product is ever localised for the launch cities.

## Content

- Should the landing page say anything at all about relationship verification?
  It is deferred in the product, and describing it here may raise more doubt
  than it settles. Currently: not mentioned.
- Is "Begin your journey" the right primary CTA, or does it promise more than a
  waitlist delivers? Worth testing against something plainer.
- The page is English-only. That excludes part of the audience in every launch
  city.

## Product

- What happens when someone in a launch city clicks through after launch? There
  is no signup flow behind the CTA yet.
- Pricing is undecided, so the page says nothing about it. The claim "no paywall
  before a first conversation" does constrain what the model can be.
- "Free revert for the previous profile in a session" is stated as a principle;
  the actual mechanic (how many, how long a session lasts) is unspecified.
- Moderation capacity is assumed, not planned. "Every report is read by a
  person" is a promise that needs staffing behind it.

## Engineering

- No tests. A landing page can survive without them, but the waitlist validation
  logic is worth covering before it changes.
- No analytics. Deliberate for now — but there is currently no way to know
  whether the page works.
- No sitemap or `robots.txt`.
- The Open Graph image renders in Satori's default font rather than Manrope.
  Fixing it means fetching the font at build time, which makes the build depend
  on the network. Deferred on purpose.
- No screen-reader pass, and no testing at 200% zoom.
- No CI, and no deployment target chosen.
