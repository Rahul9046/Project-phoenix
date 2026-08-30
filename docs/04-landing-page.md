# Landing page

## What the page has to do

A visitor should leave knowing five things:

1. What Eraya is.
2. Who it is for.
3. Why it is different.
4. Why they should trust it.
5. How to begin.

The order of sections is the order of those questions. Trust comes second — not
near the bottom where "safety" usually sits — because for this audience it is
the objection that stops everything else from landing.

## Sections

Each is a component in `apps/web/src/features/marketing/sections/`, composed in `apps/web/src/app/(marketing)/page.tsx`.

### 1. Navigation — `SiteHeader`
Logo, three links (How it works, Safety & Trust, About Eraya), Log in, and one
primary CTA. Sticky, with a hairline and a slight blur so it separates from the
page without a shadow.

Below `lg` it collapses to a single menu button. The menu is full-width, links
are 44px+ tall, and it closes on `Escape` or on selecting a link.

### 2. Hero — `Hero`
Headline: *Every ending can be a new beginning.* The second line is set in
terracotta — the only place a headline is coloured, which is what makes it the
first thing read.

Supporting copy names the audience explicitly (divorced, separated, widowed)
rather than hinting at it. Someone in this situation should recognise themselves
in the first sentence; someone who is not should understand immediately that the
page is not for them.

Primary CTA "Begin your journey", secondary "How Eraya works". A line beneath
notes that Eraya opens in a few cities first, so the city constraint is known
before anyone invests attention.

Artwork: the approved mark itself, via `ErayaMark`. It is capped well below the
column width — the tile is a solid terracotta field, and at full width it stops
reading as a logo and becomes a coloured panel. Decorative, so it is hidden from
assistive technology: the headline beside it carries the meaning. No couple, no
rings, no hearts.

### 3. Trust — `Trust`
*Trust comes before connection.* Five items: phone and email verification,
profile review, member-controlled connections, privacy controls, reporting and
blocking.

Every claim is bounded. "Our team reviews profiles before they go live" — not
"100% verified", not "zero fake profiles". See
[05-content.md](05-content.md).

### 4. Why Eraya — `WhyEraya`
Contrasts Eraya with how conventional platforms behave, without naming or
attacking anyone. Four points: no paywall before a first conversation, no
engineered curiosity, no endless collecting, designed around trust.

Every criticism describes a **practice**, never a competitor. The tone is a
statement of what we will not do, not an accusation about who does it.

Carries `id="about"` — it is the honest destination for "About Eraya", since it
is where the page says what Eraya is and why it exists.

### 5. How it works — `HowItWorks`
`01 Create your profile` · `02 Discover people at your pace` ·
`03 Connect when you're comfortable`.

Written for someone who has never used an app like this. No product vocabulary —
no "match", "feed", "discovery queue", "profile card". Three steps, because
three is visibly finite.

### 6. Built differently — `BuiltDifferently`
The philosophy: a considered few rather than an endless feed, free revert to the
previous profile in a session, privacy-respecting communication, no pressure to
rush.

States the principle and stops. Mechanics belong in the product, not on a
landing page.

### 7. Cities — `Cities`
Says that Eraya is open everywhere in India, and shows how much of it is
selectable: a count of cities and states read from the `cities` table at request
time.

This section used to explain why Eraya was opening in a few cities first and
listed seven of them under "Where the community is densest". Both halves stopped
being true. Registration is open India-wide, and `discover_members` applies no
city filter at all, so there was no restriction for the copy to describe — and
the density claim came from a hardcoded `is_launch_city` seed flag rather than
from where members actually are. A count cannot drift the way that list could:
add a city to the table and the page says 494.

### 8. Begin — `Begin`
The closing invitation: create an account, or sign in if you already have one.

This was a waitlist form — name, email, city — and every call to action on the
page pointed at it. That was coherent when Eraya opened in seven cities and
everyone else was genuinely waiting. Once registration opened across India the
page contradicted itself: it said anyone could join while the button collected an
address and promised to be in touch "as soon as we open".

The `waitlist` table is kept and its rows with it; it is simply no longer
reachable from any client. Every CTA on the page now leads to `/signup`.

### 9. Final CTA — `FinalCta`
*Your next chapter doesn't have to begin alone.* The mark, the line, one button,
on the only dark ground on the page. Calm rather than loud — the volume comes
from contrast and space, not from urgency.

### 10. Footer — `SiteFooter`
Logo, a sentence of positioning, Eraya links, legal links, social placeholders,
Phoenix Origins attribution, contact address.

Social accounts do not exist yet, so they are rendered as labelled placeholders
rather than links to nowhere.

## Supporting pages

`/login`, `/privacy`, `/terms`, `/contact` — short, honest pages so no
navigation link is broken and no legal text is invented. `/login` says plainly
that accounts are not open yet instead of showing a form that cannot work.

## Deliberate omissions

- No country selector — India only.
- No testimonials, member counts or success stories. There are no members.
- No pricing. Nothing has been decided.
- No relationship-verification detail. It happens later in the product flow and
  explaining it here would raise more doubt than it settles.
