# SEO

Two pieces of work, in order. The technical foundation is done and verified; the
content infrastructure is built and carrying five published guides.

## The foundation

Production has served `index, follow`, `Allow: /` and a sitemap since the launch
build — `NEXT_PUBLIC_ALLOW_INDEXING: "true"` in `.github/workflows/deploy-web.yml`.
Search Console ownership is verified and `https://eraya.app/sitemap.xml` is
submitted. That URL does not change: pages are added to that document, never
moved to another one.

The one thing worth repeating from that pass is why it needed a probe at all.
`tsc` and `next build` both pass on a site that is entirely `noindex`, because a
wrong directive is still a valid string — and the switch is inlined at build time
from the *workflow's* environment, so the repository cannot know its own
production value. For a while a hand-written row in `scripts/review-package.mjs`
said this deployment was `noindex`, a few sections below a generated table that
said `ENABLED`, and nothing failed.

```bash
npm run seo:probe     # asks eraya.app and asserts on parsed values
```

It reads robots.txt into rules and resolves them longest-match against the paths
they cover, fetches every `<loc>` in the sitemap and checks each for a `noindex`
it should not carry, compares every canonical as a URL against the canonical
origin, requires each private route to answer with a redirect or a refusal,
checks the www redirect, and hands the JSON-LD to `JSON.parse`. Nothing in it
passes because a string was missing from a response body.

## Guides

`/guides`, and `/guides/<slug>` for each article. Part of the `(marketing)`
group, so the section arrives with the site header, footer, language switch and
site-level structured data already around it, and inherits that group's
indexable default rather than declaring anything about robots itself.

**Five guides are published** — three on 2026-09-27
(`/guides/dating-after-divorce-india`,
`/guides/how-to-start-dating-after-divorce`,
`/guides/when-to-date-after-divorce`) and two on 2026-09-28
(`/guides/dating-after-divorce-with-kids`,
`/guides/dating-after-separation-india`). All five are approved copy,
transcribed rather than generated, and they are the only articles. They read as
a cluster rather than five separate pages: the third links to two of the others,
the fourth to all three, and the fifth to all four. The rule that kept the
registry empty still governs everything after them -- a set of thin AI-written
guides would be worse for this site than no guides at all, it is what
Google's helpful-content work exists to demote, and unlike a missing page it is
hard to take back once indexed.

Checked on eraya.app on 2026-09-28, the day the fourth and then the fifth went
up: all five answer HTTP 200 with a single `index, follow`, a canonical equal to
their own URL, the approved SEO title and meta description byte-identical, both
`Article` and `BreadcrumbList` JSON-LD parsing with `author` and `publisher`
resolving by `@id` to the on-page `Organization` named Eraya, a visible
breadcrumb, a link from `/guides`, an entry in `sitemap.xml`, and no robots.txt
rule covering them. The `<title>` element adds the site-wide `— Eraya` suffix
every page here has, so the approved SEO title is byte-identical in `og:title`
and `twitter:title` rather than in the title tag alone — and where a guide sets
`seoTitle`, the approved `h1` is the separate string the heading, the breadcrumb
and the JSON-LD `headline` all carry. Article #4 carries its links to the three
before it; Article #5 carries all five of its approved links — the four other
guides and `/safety`.

The two slugs still unwritten answer 404, appear nowhere in the sitemap, and
serve a page byte-identical to the one `/guides/this-guide-does-not-exist`
serves, which is the property that matters: a reader guessing at a slug cannot
tell a planned article from one nobody has ever thought of. That was checked by
comparing the responses rather than by looking for a string, because a missing
placeholder and a typo in the search term produce the same silence.

`npm run seo:probe` returned **451/451** the day the fourth went up and
**500/500** after the fifth, both against production.

### Content is data, not markup

A guide is a `Guide` object with a body of typed blocks — the same shape
`@eraya/legal` already uses for the privacy policy and the guidelines, rather
than a second content model for one repository.

MDX was the obvious alternative and is the wrong one here. It means `@next/mdx`
and the `@mdx-js/*` chain — four dependencies to gain a syntax — and it hands an
article the ability to import and render arbitrary components. An article that
can do anything is an article nobody can check, and the property worth protecting
in this content is that it cannot quietly grow a claim Eraya has not earned. It
also keeps the module loadable by `node --test` with no build step, which is what
makes the test below possible without a test framework.

A paragraph is a list of spans rather than a string, so an inline link is a typed
object with an `href` the compiler can see. A `[label](/safety)` mini-syntax
would need a parser, and a parser turns a typo into visible literal brackets on a
live page.

### Adding one

Write `apps/web/src/features/guides/content/<slug>.ts` exporting a `Guide`,
import it in `registry.ts`, add it to the array. Nothing else — the sitemap picks
it up, the metadata and structured data are generated from the object, and the
index page lists it.

`status: "draft"` while it is being written, `"published"` when approved.

### Draft safety

One gate, in `features/guides/select.ts`, and nothing else in the feature may
filter on `status`. A gate repeated in the index page, the article page, the
sitemap and the related list is four gates, and the one that gets it wrong is the
one nobody looks at.

Published means the literal string `"published"` — an equality, not
`!== "draft"`. The two behave identically today and diverge the moment somebody
adds a third status: `!== "draft"` would publish a `"review"` guide site-wide the
day it was introduced.

A draft is absent from `/guides`, absent from the sitemap, and its URL answers
**404** — the same answer as a slug nobody has ever written, so the two are
indistinguishable. A 404 rather than a `noindex` page on purpose: a rendered
"coming soon" confirms to anybody guessing that the slug is real, gives a crawler
a URL to remember and retry, and puts unapproved prose on the public internet
with only a meta tag between it and a search result.

```bash
npm test     # node --test, no framework, no dependency
```

Eleven assertions over that one file, including the third-status guard and that
a draft's date cannot leak into the index's `lastModified`.

### Authorship

`{ kind: "organization" }` — Eraya — is what every guide uses. The `person`
variant exists so a guide genuinely written by a named human can say so, and it
carries a name and nothing else. There is deliberately no field for a
qualification: Eraya employs no counsellors, psychologists or doctors, and a
field for a credential is an invitation to fill one in. A guide about a hard
subject carrying an implied clinical authority is the most harmful thing this
section could publish. The probe fails on `hasCredential`, `jobTitle`,
`reviewedBy`, `aggregateRating` and `review` appearing anywhere in a guide's
structured data.

### One CTA, from a fixed set

`join`, `safety` or `none`, with the copy in the dictionary rather than in the
article. An article cannot invent its own pitch, so a sentence like "India's
safest community" cannot appear in one guide because somebody typed it there.
`none` is a real option: a guide about leaving an unsafe situation should be able
to end without an invitation to join anything.

### Open Graph is replaced, not merged

Worth knowing before editing any page's metadata. Declaring `openGraph` on a page
replaces the root layout's wholesale — the file-convention `opengraph-image.png`
included. The first build of the guide route served four Open Graph tags and no
more: no `og:image`, no `og:site_name`, no `og:locale`, and `twitter:card`
silently downgraded from `summary_large_image` to `summary` with no image behind
it, which would have made every guide shared into WhatsApp a bare line of text.

Any page declaring its own `openGraph` restates the card from `SITE_OG_IMAGE` in
`features/marketing/schema.ts`. Nothing generates a per-article image: that would
be new brand artwork, and the brand's artwork is not SEO's to redraw.

### Structured data

`Article` rather than `BlogPosting`. `BlogPosting` says one extra thing — that
this is a post on a blog — and Eraya has no blog: no chronological feed, no
monthly archive, no running authorial voice, and these are meant to stay accurate
rather than be superseded by next week's post. Google treats the two identically
for the rich result.

Plus a `BreadcrumbList` generated from the same guide the visible trail is drawn
from, so the two cannot disagree. Three levels, because the site has three.
Categories are labels on a card, not pages — putting one in the trail would
promise a `/guides/safety` that does not exist.

Both reference the `Organization` and `WebSite` the `(marketing)` layout already
emits on the same page, by `@id`, rather than describing a second Eraya.

## Planned, not written

Two slugs remain, as writing targets. They are not entries waiting to be switched
on, and `/guides/this-guide-does-not-exist` holds their place in the probe's
**private** list — the next slug somebody starts writing should join it there, so
that the day it is published is a day the probe fails and somebody has to move it
deliberately. Silence until then is how a placeholder ships.

| Slug | Working title |
| --- | --- |
| ~~`dating-after-divorce-india`~~ | **Published 2026-09-27.** Category `relationships`, which the guide system gained for it |
| ~~`how-to-start-dating-after-divorce`~~ | **Published 2026-09-27.** First use of `seoTitle`, and the first guide to link to another |
| ~~`when-to-date-after-divorce`~~ | **Published 2026-09-27.** First guide to link to two others |
| ~~`dating-after-divorce-with-kids`~~ | **Published 2026-09-28.** First guide to link to all three of the others |
| ~~`dating-after-separation-india`~~ | **Published 2026-09-28.** First guide to link to all four of the others |
| `online-dating-safety-after-divorce` | Staying Safe When Meeting Someone Online After Divorce |
| `finding-companionship-after-losing-spouse` | Finding Companionship After Losing a Spouse |

Landing pages such as `/divorced-dating-india` are a separate thing and not
guides. Nothing in this architecture prevents them: they would be ordinary pages
in the `(marketing)` group, added to `publicPaths` in `app/sitemap.ts` the way
`/pricing` is.

## Two things for the owner to decide

**Five guides are live, so `/guides` is no longer thin.** Every one of those
URLs can now be submitted for indexing in Search Console, alongside
`https://eraya.app/guides` itself. The sitemap carries all six and did not move.

**The homepage hero says "Verified members."** (`marketing.hero.note`). It
predates this work and was left alone: rewriting approved marketing copy was out
of scope for both SEO passes. It sits awkwardly beside the rule this project
otherwise holds to — no trust mark for anything Eraya has not checked — since
what is actually verified is a mailbox, and sometimes a handset. Worth a decision
rather than a silent edit.
