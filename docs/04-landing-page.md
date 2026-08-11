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

Each is a component in `components/sections/`, composed in `app/page.tsx`.

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

Artwork: `DawnVisual` — an arch onto a sunrise with a single figure. No couple,
no rings, no hearts.

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
Explains why Eraya opens in a few cities: a community needs people in it to be
worth joining, so a handful of cities grown properly beats a national launch
into empty profiles.

Lists Bengaluru, Hyderabad, Delhi, Kolkata, Mumbai, Pune, Aizawl and Chennai,
and tells anyone elsewhere in India to join the waitlist. This is the section
that makes the waitlist mean something specific rather than a generic email
capture.

### 8. Begin — `Begin` / `BeginForm`
One form serving both audiences. Name, email, city.

- A launch city → early access list.
- "Another city" → reveals a free-text city field, and the person joins the
  **waitlist**.

The confirmation message differs accordingly, so nobody in a launch city is told
they are waiting, and nobody outside one is told they are about to be let in.

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
