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

That had drifted. The lede read *"Meet people who understand what starting
again means"* — true, and equally true of a friendship app, a support group or
a general dating app, so nothing above the fold said what Eraya is. It now
reads:

> Eraya is a community for divorced, separated and widowed people in India —
> meet, connect and begin your next chapter at your own pace.

Four things must survive translation into all six languages: the three statuses,
India, the meeting, and the next chapter. "People starting again" is supporting
copy and never the substitute — that is the euphemism
[05-content.md](05-content.md) rules out. The emotion stays in the headline and
the eyebrow; the lede is the one place on the page that is plain.

Primary CTA "Create your account", secondary "How Eraya works", and below a
hairline the Android download as a second, quieter offer. A line beneath notes
that Eraya is open across India and that every member confirms a working email
address — the bounded form of that claim, after the hero spent some months
saying "Verified members" about a product that verifies a mailbox.

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
Titled *Built for life after a relationship ends.* — which is the section's
actual subject, where the previous *"a different moment in life"* never said
which moment. The lede answers the two comparisons a visitor is already making:

> Whether you are divorced, separated or widowed, Eraya is a space to meet
> people with shared life experience — without the pressure of traditional
> matrimony or swipe-first dating.

This is where the audience is named a second time, and deliberately the only
other place: the hero states it, this section explains what follows from it, and
nothing in between repeats it. A visitor who skipped the hero still meets it
here.

Then four points: no paywall before a first conversation, no engineered
curiosity, no endless collecting, designed around trust.

Every criticism describes a **practice**, never a competitor. "Swipe-first
dating" names a category the way [01-product.md](01-product.md) does — a
description of what Eraya is not, never Eraya's own vocabulary. The tone is a
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

### 8. Android app — `AndroidApp`
*Eraya on your phone.* A sand card on a canvas band, offering the Android
download. An aside rather than a band of its own: the page alternates canvas and
sand, and a ninth full band would put two of the same colour side by side
wherever it landed.

It reads as a product section, not a developer download. There is no "beta"
anywhere in the copy, and no device detection — one unconditional line says
Android only, and that Eraya works in the browser on an iPhone or a computer, so
nobody is offered an APK that cannot install. The install itself is explained on
`/download` rather than here, because three steps on a homepage card would read
as a warning to everyone who is not installing anything.

The hero also carries a real download button under a hairline — `secondary`, not
`primary`, so the filled "Create your account" stays the one dominant control —
and the footer links `/download` from every page. The card alone was not enough:
at a 320 px viewport it sits 7,800 px down, which is not somewhere anybody finds
a download.

Where the button points is one object in `features/marketing/android-app.ts`,
which is also how it becomes a Google Play link later. See
[09-mobile.md](09-mobile.md#distribution).

### 9. Begin — `Begin`
The closing invitation: create an account, or sign in if you already have one.

This was a waitlist form — name, email, city — and every call to action on the
page pointed at it. That was coherent when Eraya opened in seven cities and
everyone else was genuinely waiting. Once registration opened across India the
page contradicted itself: it said anyone could join while the button collected an
address and promised to be in touch "as soon as we open".

The `waitlist` table is kept and its rows with it; it is simply no longer
reachable from any client. Every CTA on the page now leads to `/signup`.

### 10. Final CTA — `FinalCta`
*Your next chapter doesn't have to begin alone.* The mark, the line, one button,
on the only dark ground on the page. Calm rather than loud — the volume comes
from contrast and space, not from urgency.

### 11. Footer — `SiteFooter`
Logo, a sentence of positioning, Eraya links (including the Android download),
legal links, social accounts, Phoenix Origins attribution, contact address.

The social column lists only accounts Eraya actually owns, each one linked. It
used to name Instagram, LinkedIn and YouTube with "coming soon" beside each,
because none existed. Instagram now does, so it is a link; the other two were
removed rather than left promising something with no date behind it. They come
back when there is something to link to.

Those same URLs are the site's `sameAs` in `schema.ts`, emitted from this one
list — so the test for adding an entry is "is this account real enough to link
to", and a structured-data claim cannot drift from what the footer shows.

## Supporting pages

`/login`, `/privacy`, `/terms`, `/contact` — short, honest pages so no
navigation link is broken and no legal text is invented. `/login` says plainly
that accounts are not open yet instead of showing a form that cannot work.

`/download` — the Android download, standing alone outside the `(marketing)`
group so it gets no header, footer or navigation. Somebody arriving from a link
in a bio has been asked to do one thing. It carries the download, the
Android-only line, and three sentences about what the install looks like.
`/beta` is the address it used to have and 308s here.

## Deliberate omissions

- No country selector — India only.
- No testimonials, member counts or success stories. There are no members.
- No pricing. Nothing has been decided.
- No relationship-verification detail. It happens later in the product flow and
  explaining it here would raise more doubt than it settles.
