# Open questions and known gaps

Nothing here has been decided. These are recorded rather than guessed at, so
that no invented answer leaks into the product.

## Must be resolved before launch

**Signup storage.** Submissions currently append to `data/waitlist.jsonl`. That
works in development and on a single long-lived server, and nowhere else. It
needs a real datastore (or an email provider's list API) before the page takes
live traffic. `app/actions/waitlist.ts` is the only file that has to change.

**Email confirmation.** Nobody receives anything after signing up. At minimum
this needs a confirmation email; double opt-in would be better, and makes the
list defensible under consent rules.

**Abuse protection.** The form has a honeypot and nothing else. It needs rate
limiting per IP, and probably a challenge, before it is publicly linked.

**Privacy policy and terms.** Both pages currently state honestly that the
documents are being prepared. Real ones are required before collecting
significant personal data, and India's DPDP Act applies.

**Contact address.** `hello@eraya.app` is used throughout, from `content/site.ts`.
It must exist and be monitored, or be changed in that one place.

## Brand — defects in the supplied logo pack

Two problems in `app/assets/` that need a corrected export. The mark geometry
itself is fine and is used as supplied; these concern the framing.

**`eraya-approved-horizontal.svg` is unusable as delivered.** Three faults:

1. The mark is drawn at `scale(4.2)`, which puts its bottom edge at y≈803 in a
   viewBox only 700 tall — the mark is clipped.
2. The wordmark `<text>` starts at x=360, while the mark spans x≈138–723, so
   the two overlap.
3. The wordmark is `<text>` in `font-family="Georgia, Times New Roman, serif"`
   — a system fallback, not a brand typeface. It would render differently on
   every machine and cannot be relied on.

The site therefore typesets "Eraya" in Fraunces beside the mark instead. A
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
- Fraunces and Inter are a reasoned choice, not an approved one. If a type
  system is commissioned, `--font-serif` and `--font-sans` in `globals.css` are
  the only places to change.
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
- The Open Graph image renders in Satori's default font rather than Fraunces.
  Fixing it means fetching the font at build time, which makes the build depend
  on the network. Deferred on purpose.
- No screen-reader pass, and no testing at 200% zoom.
- No CI, and no deployment target chosen.
