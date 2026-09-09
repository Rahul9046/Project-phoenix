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

`www` is a redirect issued by the host, not a second deployment. On Cloudflare
it is a route and a redirect rule on the same Worker, and both names sit under
one certificate. Nothing needs to be built for it.

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

### Cloudflare Workers, built by GitHub Actions

The app is a Worker, compiled from the Next build by `@opennextjs/cloudflare`.
It cannot be static files: the production build marks nearly every route dynamic
and ships middleware.

Two hosts were tried before this one, and the reasons both failed are worth
keeping.

**Vercel Hobby forbids commercial use**, and its own fair-use guidance names
processing payments as an example. Eraya sells Premium, so a free Vercel
deployment would breach the terms on day one regardless of how few people use
it. Commercial use starts at Pro, $20/month.

**Netlify's free plan permits commercial use but meters builds**, not traffic —
about 4.5 credits per build against 300 a month. Ten days of ordinary
development exhausted them: roughly sixty builds, 35 build minutes, against 1.8
MB of bandwidth and 391 requests. Traffic was never remotely the constraint, and
the published "100 GB bandwidth" figure that made the plan look generous
described a different plan structure than the one accounts are issued.

The failure was silent, which is the part that matters. Production deploys were
skipped with a note in the deploy list; merges still reported success; the site
served a build three merges old. Nothing raised an error, and nobody would have
noticed without checking a response header by hand.

**Cloudflare meters requests** — 100,000 a day against the 391 a *month* this
serves — and the build happens in GitHub Actions, which is free and unmetered
for a public repository. There is no deploy budget to exhaust, so that failure
mode is structurally absent rather than merely further away.

Configuration lives in `apps/web/wrangler.jsonc` and `apps/web/open-next.config.ts`;
the pipeline is `.github/workflows/deploy-web.yml`, which runs on pushes to
`develop` that touch `apps/web`.

**One caveat, verified rather than assumed.** The adapter warns that Node.js
middleware support on Cloudflare is experimental and not officially maintained,
and `src/proxy.ts` refreshes the Supabase session on every rendered request —
so this is load-bearing. Tested against a local Worker build: routes serve, the
signed-out redirect from `/home` to `/login` fires, all four security headers
are present, and Supabase-backed pages render live data. Worth re-testing after
an adapter upgrade rather than trusting it indefinitely.

### The switchover

Taking the apex means replacing the holding page rather than deploying beside it,
so the steps are ordered to keep something answering `eraya.app` throughout.

1. **Deploy to the Worker's own address first** (`eraya-web.<subdomain>.workers.dev`).
   Nothing about DNS changes yet and the holding page keeps serving. Confirm the
   app builds, loads, and that sign-in and checkout work there.
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

**One switch, two outputs.** `NEXT_PUBLIC_ALLOW_INDEXING` gates both the `robots`
meta tag in the root layout and the `X-Robots-Tag` header set in
`apps/web/next.config.ts`. Setting it to `true` releases both; unset, both hold.
There is nothing to open twice and nothing to forget.

It was briefly two independent locks — the meta tag here, the header in the
host's own config — which sounded safer written down and was not. The host half
turned out to be sending nothing at all on the deployed site, so the arrangement
documented as belt-and-braces was one lock with a decorative second, and the
remaining failure mode was opening one and believing the job done.

The security headers moved into `next.config.ts` for the same reason: Next emits
them itself, so they hold on any host and can be checked with `next start`
before a deploy rather than discovered missing after one.

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

# Cloudflare Workers, from apps/web
npm run cf:build    --workspace @eraya/web   # compile the Worker
npm run cf:preview  --workspace @eraya/web   # run it locally on workerd
npm run cf:deploy   --workspace @eraya/web   # build and deploy
```

`cf:preview` is the one worth knowing: it runs the real Worker bundle locally,
which is how the middleware caveat above was tested without deploying.

## Conventions

- No colour literals outside `globals.css` — the two exceptions are documented
  in [03-design-system.md](03-design-system.md).
- No user-facing copy inside components; it belongs in `apps/web/src/features/marketing/content.ts`.
- Sections compose `Section` + `Container`; they never set page margins.
- Prefer a Server Component. Reach for `"use client"` only when there is state
  or an event handler, and push it to the smallest component that needs it.
