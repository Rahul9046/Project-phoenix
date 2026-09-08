# Technical

## Stack

Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript strict,
Tailwind CSS v4. No dependencies beyond what the project already had.

> Next.js 16 differs from earlier versions in ways that matter here. Read the
> bundled docs in `node_modules/next/dist/docs/` before changing routing,
> metadata, images or configuration — see `AGENTS.md`.

Version-specific things this codebase relies on:

- `LayoutProps<"/">` — a global type in Next 16; no import needed.
- `data-scroll-behavior="smooth"` on `<html>`. Next 16 no longer neutralises
  smooth scrolling during navigation unless this attribute is present.
- Tailwind v4 configures itself in CSS via `@theme`. There is no
  `tailwind.config.js` and one should not be added.

## Structure

A workspace monorepo. One app today, room for more.

```
apps/web/                 the Next.js app
  src/
    app/                  routing only — a folder here defines a URL
      layout.tsx          fonts, metadata, skip link
      globals.css         design tokens
      icon.svg            favicon
      opengraph-image.tsx generated OG image
      (marketing)/        page, privacy, terms, contact
      (auth)/             login, signup, logout, auth/*, onboarding/*
    features/
      auth/               screens, components, copy, flow, actions
      marketing/          sections, layout, components, copy
      waitlist/           the signup server action
    shared/               ui/, brand/, data/ — only what two features use
    lib/supabase/         client construction, generated types
  proxy.ts is at src/proxy.ts, beside app/, as Next.js requires
supabase/                 migrations — the contract between apps
assets/brand/             logo source artwork, not served
docs/                     this specification
```

Run commands from the root (`npm run dev`) or from `apps/web`. Adding a second
app means a sibling under `apps/`; nothing in `apps/web/` moves.

## Rendering

Every route is statically prerendered. The only client components are
`SiteHeader` (mobile menu) and `BeginForm` (conditional city field); everything
else is a Server Component, so almost no JavaScript is required to read the
page.

## Fonts

`next/font/google` self-hosts Manrope at four weights (400, 500, 600, 700) — no
runtime request reaches Google. The fallback carries generated metric overrides,
so the swap when Manrope arrives does not shift the layout.

`display: "swap"` shows the fallback immediately rather than hiding text while
the font loads -- on a slow Indian mobile connection the alternative is a blank
page. Only the four weights the type scale asks for are loaded; the variable
font's 200 and 800 would be two more files for weights nothing uses.

## Images

There are no raster images. The hero artwork, the logo and the favicon are SVG;
the Open Graph image is generated at build time by `next/og` from the same mark
geometry. Nothing to compress, nothing to lazy-load, and the mark can never
drift between the page, the tab icon and link previews.

If photography is added later, use `next/image`, and note the Next 16 defaults:
`images.qualities` now allows only `[75]`, and local sources with query strings
require an `images.localPatterns` entry.

## The signup form

`apps/web/src/features/waitlist/actions.ts` is a Server Action. It validates on the server —
client validation is a convenience, never the boundary — and appends to
`data/waitlist.jsonl`.

Validation: name 2–80 characters; a plausible email under 160 characters; city
either one of `launchCities` or `Another city` with a free-text city supplied.
A hidden honeypot field absorbs naive bots.

Members of a launch city are recorded as `early-access`; everyone else as
`waitlist`.

> **This store is not production-ready.** A file on disk does not survive
> serverless or multi-instance hosting. It must be replaced with a real
> datastore before launch. There is also no rate limiting and no double
> opt-in — see [07-open-questions.md](07-open-questions.md). `data/` is
> gitignored so no personal data is ever committed.

## Accessibility

Targeting WCAG 2.1 AA. Implemented: semantic landmarks, a skip link, one `<h1>`
per page, labelled form controls, `aria-invalid` and `role="alert"` on errors,
visible focus rings on everything focusable, `Escape` to close the mobile menu,
44px+ targets, and 4.5:1 contrast for body text.

Not yet done: a screen-reader pass, and testing at 200% browser zoom.

## Performance

No raster images, no icon library, no animation library, no analytics, no
third-party scripts. Fonts are self-hosted and preloaded. Motion is one CSS
keyframe. `overflow-x-hidden` on `<body>` plus a single `Container` measure
means horizontal overflow cannot occur.

## Two public addresses, and only one of them is this app

`eraya.app` and the product are not the same thing, and confusing them is the
easy mistake here.

The decided structure:

| Address | What answers it | Where it lives |
| --- | --- | --- |
| `eraya.app` | The public holding page. Canonical | `Rahul9046/eraya-site`, GitHub Pages |
| `www.eraya.app` | A 301 to `eraya.app` | GitHub Pages, automatically |
| `app.eraya.app` | This app | a host serving `apps/web` |

**Today it is the other way round.** `www` serves the page and the apex forwards
to it, because the apex is not yet ours to point — see below. Reversing it is a
DNS and `CNAME`-file change, not a code change, and the two must happen
together or the site breaks in the gap.

The `www` redirect needs no application and no third party. GitHub Pages issues
it: when the custom domain is the apex and a `www` CNAME points at
`rahul9046.github.io`, GitHub answers `www` with a 301 to the apex and covers
both with the same certificate. The GoDaddy forwarding rule that currently sends
the apex to `www` must be deleted at the same time, or the two redirects point
at each other.

**The holding page is not in this repository.** It is three static files —
markup, the approved mark, and a `CNAME` — in a separate repo, deliberately: it
must survive a broken deploy, a migration or a rotated key in the product it is
holding the door for, and the cheapest way to guarantee that is to give it
nothing to depend on. The cost is that its palette is transcribed from
[02-brand.md](02-brand.md) rather than imported, so a rebrand will not reach it.

**What blocks the apex.** A GoDaddy Airo "Coming Soon" site was auto-generated on
`eraya.app` at registration and holds the apex. While it does, GoDaddy's DNS
editor refuses any manual `@` A record — it fails with "Invalid data provided for
record data", which reads like a typo and is not one. Records for any other name
save normally, which is how it was isolated: a throwaway `test` A record saved
without complaint while `@` would not.

Disconnecting the Airo site (Domain → Products) frees the apex. Until somebody
does, `eraya.app` cannot serve anything and the structure above cannot be built.
`app.eraya.app` is unaffected — it is not the apex, so its record saves
normally.

`.app` is on the HSTS preload list, so there is no plain-HTTP fallback for any
of these. A certificate that has not been issued yet is a hard block in the
browser, not a warning somebody can click past.

## Deploying this app

Not yet done. It matters beyond the website: the mobile app opens `/checkout` in
a browser, so until `apps/web` is reachable publicly, payments in any
distributed build fail silently — see [10-payments.md](10-payments.md).

Four variables, one of them secret:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL            https://app.eraya.app
SUPABASE_SECRET_KEY             server only, never NEXT_PUBLIC_
```

Razorpay, MSG91 and SMTP values do **not** belong here; they are Supabase edge
function secrets. Nothing secret is ever prefixed `NEXT_PUBLIC_`: that prefix is
what puts a value into the browser bundle.

`NEXT_PUBLIC_ALLOW_INDEXING` is deliberately **not** set, so the deployment is
`noindex`. See below.

### Not Vercel, on the free tier

Vercel's Hobby plan forbids commercial use, and its own fair-use guidance names
processing payments as an example. Eraya charges for Premium, so a Hobby
deployment would be a terms violation from the first day regardless of how few
people are using it. Commercial use starts at Pro, $20/month.

**Netlify's free plan permits commercial use explicitly**, including a paying
product, within its quota — currently 100 GB bandwidth, 300 build minutes and
125,000 function invocations a month. It runs Next.js natively with no adapter,
which matters here: the production build is dynamic on nearly every route and
carries middleware, so this cannot be hosted as static files.

Cloudflare Workers is the other free option that allows commercial use, and the
`@opennextjs/cloudflare` adapter supports Next.js 16 — but it is an adapter and a
build change, which is more to go wrong for the same result. Worth revisiting if
Netlify's quota becomes the constraint.

`netlify.toml` at the repository root carries the monorepo build settings.

### Order of operations

Deploy, point the subdomain at it, confirm it loads over HTTPS, and only then run
`npm run config:push` — `supabase/config.toml` names `app.eraya.app` as the auth
`site_url`, and pushing that before the domain resolves means sign-in emails link
to nothing.

### Indexing is opt-in

`NEXT_PUBLIC_ALLOW_INDEXING` gates `robots` in the root layout, and only the
literal string `true` enables it. Everything else — local, previews, branch
builds, forks — is `noindex`.

The product is deployed before it opens, so for a while there is a site inviting
people to create an account while `eraya.app` says the product is coming soon.
Of those two, the one a search engine keeps is not the one we would choose.

It is an environment variable rather than a hardcoded `noindex` on purpose: a
hardcoded one is a code change somebody must remember to revert on launch day,
and forgetting it means launching invisible to search — a silent failure worse
than the problem it solves. Auth and onboarding pages carry their own `noindex`
and do not depend on this.

## Commands

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
npm start       # serve the build
npm run lint    # eslint
```

## Conventions

- No colour literals outside `globals.css` — the two exceptions are documented
  in [03-design-system.md](03-design-system.md).
- No user-facing copy inside components; it belongs in `apps/web/src/features/marketing/content.ts`.
- Sections compose `Section` + `Container`; they never set page margins.
- Prefer a Server Component. Reach for `"use client"` only when there is state
  or an event handler, and push it to the smallest component that needs it.
