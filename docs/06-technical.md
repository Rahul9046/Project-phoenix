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

## One domain, one application

`eraya.app` is the product. Not a marketing site in front of it and not a
subdomain beside it: the same Next.js application serves the landing page at
`/`, the legal pages, and every signed-in route.

| Address | What answers it |
| --- | --- |
| `eraya.app` | This application. Canonical |
| `www.eraya.app` | A 301 to `eraya.app` |

There is no `app.` subdomain. One was planned and prepared, and the decision was
reversed before anything was deployed — the history is in the repository if the
question is reopened.

`www` is a redirect issued by the host, not a second deployment. Netlify does it
by making `eraya.app` the primary domain and adding `www.eraya.app` as an alias;
both are covered by one certificate. Nothing needs to be built for it.

### What is at `eraya.app` today, and what replaces it

Today it is a static holding page saying the product is coming soon. It lives in
`Rahul9046/eraya-site` — three files, served by GitHub Pages, sharing no code
with this repository so that a broken deploy here cannot take the public face of
the company down. Its palette is transcribed from [02-brand.md](02-brand.md)
rather than imported, so a rebrand will not reach it.

It is temporary. When this application deploys to `eraya.app`, the holding page
is retired rather than moved — see the switchover below.

**Until then it must not break.** Today `www` serves the page and the apex
forwards to it, so `eraya.app` reaches the holding page by redirect. That is
adequate and should be left alone until the product is genuinely ready to take
the domain.

### The apex is not yet ours to point

A GoDaddy Airo "Coming Soon" site was auto-generated on `eraya.app` at
registration and holds the apex. While it does, GoDaddy's DNS editor refuses any
manual `@` A record — it fails with "Invalid data provided for record data",
which reads like a typo and is not one. Records for any other name save
normally, which is how it was isolated: a throwaway `test` record saved without
complaint while `@` would not.

**This now blocks the whole deployment.** While the product was planned for a
subdomain, Airo was an inconvenience affecting only the holding page. With
`eraya.app` as the canonical product address, nothing can go live until the Airo
site is disconnected from the domain (Domain → Products). It is the first step
of the switchover, not a detail of it.

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
NEXT_PUBLIC_SITE_URL            https://eraya.app
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

### The switchover

Taking the apex means replacing the holding page rather than deploying beside it,
so the steps are ordered to keep something answering `eraya.app` throughout.

1. **Deploy to the host's own address first** (`<site>.netlify.app`). Nothing
   about DNS changes yet, and the holding page keeps serving. Confirm the app
   builds, loads, and that sign-in and checkout work there.
2. **Disconnect the Airo site** at GoDaddy (Domain → Products). Until this is
   done the apex cannot be pointed anywhere, and no amount of DNS editing will
   change that.
3. **Delete the GoDaddy forwarding rule** sending the apex to `www`. Leaving it
   in place means the apex forwards to `www` while `www` redirects to the apex.
4. **Point the apex at the host** with the records it gives you, and add
   `www` as an alias so the host issues the `www` → apex 301 itself.
5. **Retire the holding page.** Remove the `CNAME` file from `eraya-site` and
   disable its GitHub Pages site. If that file still claims `eraya.app` or
   `www.eraya.app`, GitHub keeps asserting the domain and the two hosts fight
   over it. Archive the repository rather than deleting it.
6. **Only now run `npm run config:push`.** `supabase/config.toml` names
   `eraya.app` as the auth `site_url`; pushing it before the domain resolves
   means sign-in emails point at nothing.
7. **Set `EXPO_PUBLIC_SITE_URL`** in EAS to `https://eraya.app`, which closes the
   silent payment failure described in [10-payments.md](10-payments.md).

Steps 2 to 5 are the only window where `eraya.app` is unreliable. Do them in one
sitting rather than across days.

### Indexing is opt-in

`NEXT_PUBLIC_ALLOW_INDEXING` gates `robots` in the root layout, and only the
literal string `true` enables it. Everything else — local, previews, branch
builds, forks — is `noindex`.

The product is deployed before it opens, and it now serves the public landing
page as well as the signed-in routes. A pre-launch deployment on the canonical
domain is exactly what a crawler would otherwise keep and show.

It is an environment variable rather than a hardcoded `noindex` on purpose: a
hardcoded one is a code change somebody must remember to revert on launch day,
and forgetting it means launching invisible to search — a silent failure worse
than the problem it solves.

**Two locks, and launch day opens both.** `NEXT_PUBLIC_ALLOW_INDEXING` gates the
`robots` meta tag; `netlify.toml` sends `X-Robots-Tag: noindex` as a header,
which covers responses a crawler sees without parsing HTML. Setting the variable
while leaving the header in place changes nothing, and is the likely way this
gets half-done.

What does **not** change on launch day: auth, onboarding and every signed-in
route declare their own `robots: { index: false }` per page. Those are meant to
stay out of search permanently, and they do not depend on either lock. Opening
the two above makes the marketing and legal pages indexable and nothing else.

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
