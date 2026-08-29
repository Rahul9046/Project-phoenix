# Backend

Supabase provides the database, authentication and row-level authorisation.
There is no separate API server: the Next.js app talks to Supabase directly, as
the signed-in member, and Row Level Security decides what that member can see.

## Environment

Copy `.env.example` to `.env.local` and fill it in. `.env.local` is git-ignored
and must stay that way — it holds a key that bypasses every security policy.

```
cd apps/web && cp .env.example .env.local
```

The env files live beside the app that reads them, not at the repo root — Next.js
loads them from its own project directory.

| Variable | Where it comes from | Exposed to the browser |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → publishable (`sb_publishable_…`) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy alternative, if the project has no publishable key | Yes |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys → secret (`sb_secret_…`) | **No** |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy alternative | **No** |
| `NEXT_PUBLIC_SITE_URL` | Your origin. `http://localhost:3000` locally | Yes |

The publishable/anon key is safe in the browser — it identifies the project and
nothing more. Everything it can reach is governed by the RLS policies. The
secret key is a different thing entirely: it ignores those policies. It must
never be prefixed `NEXT_PUBLIC_`, never appear in client code, and never be
committed.

`apps/web/src/lib/supabase/env.ts` accepts either key generation, so a rotation from anon to
publishable needs no code change.

## Migrations

Everything about the schema lives in `supabase/migrations/`, in order:

| Migration | What it does |
| --- | --- |
| `…090100_create_enums` | `relationship_status`, `gender`, `onboarding_stage` |
| `…090200_create_cities` | Cities table |
| `…090300_create_languages` | Languages table |
| `…090400_create_profiles` | Profiles, keyed to `auth.users` |
| `…090500_create_profile_languages` | Join table |
| `…090600_create_waitlist` | Landing-page signups |
| `…090700_create_triggers` | Profile on signup, phone mirror, `updated_at` |
| `…090800_enable_rls` | RLS on every table, with policies |
| `…090900_seed_reference_data` | The seven launch cities and the languages |
| `…101500_restrict_function_execute` | Revokes EXECUTE on the trigger functions |
| `…100100_create_membership_enums` | `membership_tier`, `subscription_status`, `payment_provider` |
| `…100200_create_membership_plans` | The catalogue and its prices |
| `…100300_create_entitlements` | Per-tier capabilities |
| `…100400_create_subscriptions` | One row per term |
| `…100500_membership_rls` | RLS for the three membership tables |
| `…100600_seed_membership` | The four plans and every entitlement |

Apply them with the Supabase CLI:

```
npm i -g supabase          # if not installed
supabase link --project-ref <your-project-ref>
supabase db push
```

Never create a table by hand in the dashboard. A schema that only exists in one
project cannot be reproduced, reviewed, or rolled back.

## Types

`apps/web/src/lib/supabase/database.types.ts` is hand-written to match the migrations and is
shaped exactly like the generated file, so it can be replaced once linked:

```
supabase gen types typescript --linked > apps/web/src/lib/supabase/database.types.ts
```

Do that after any schema change, in the same commit.

## Clients

| Module | Runs in | Notes |
| --- | --- | --- |
| `apps/web/src/lib/supabase/client.ts` | Browser | Singleton |
| `apps/web/src/lib/supabase/server.ts` → `createClient` | Server Components, actions, route handlers | Per request, never shared |
| `apps/web/src/lib/supabase/server.ts` → `createAdminClient` | Server only | Bypasses RLS. Administrative use only |
| `apps/web/src/lib/supabase/proxy.ts` | `apps/web/src/proxy.ts` | Refreshes the session on every request |

`proxy.ts` is the Next.js 16 name for what used to be `middleware.ts`. It must
sit beside `app/`, which in this layout means `apps/web/src/proxy.ts`.

## Authentication

| Method | Status |
| --- | --- |
| Google | Real — Supabase OAuth |
| Apple | Real — Supabase OAuth |
| Facebook | Real — Supabase OAuth |
| Email | Real — magic link (`signInWithOtp`) |
| Phone OTP | **Mocked** — no SMS provider chosen |

OAuth returns to `/auth/callback`, which exchanges the code for a session.
Email links land on `/auth/confirm`. Both are route handlers, because only those
can set cookies. Each redirects to `nextRoute(session)` rather than a fixed
screen, so someone returning mid-onboarding resumes where they stopped.

### The two shapes an email link can arrive in

`/auth/confirm` accepts both, and which one turns up depends on the email
template rather than on anything in this codebase:

| Query | Comes from | Completed with | Works across devices |
| --- | --- | --- | --- |
| `token_hash` + `type` | A template linking straight to `/auth/confirm` | `verifyOtp` | Yes |
| `code` | The **default** template, via Supabase's own `/auth/v1/verify` | `exchangeCodeForSession` | No — needs the PKCE verifier cookie |

Handling only one of them fails in a way that wastes an afternoon: Supabase
verifies the token itself and marks the address confirmed, so the account is
genuinely created and `email_confirmed_at` is set — while the route reports an
invalid link and no session cookie is ever written. The account exists; the
person is not signed in.

Prefer the `token_hash` template, because magic links are commonly opened on a
different device from the one that requested them, and the PKCE verifier does not
travel:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Eraya has no passwords. Email sign-in sends a link; there is no password field
anywhere in the product, and adding one would be a product decision, not a
technical one.

### Phone verification

Still mocked, in `apps/web/src/features/auth/phone-verification.ts`. Any plausible number and any
six-digit code are accepted, and `apps/web/src/features/auth/actions.ts` writes
`phone_verified_at` directly.

That file documents exactly what to change once an SMS provider is chosen. The
schema is already ready for it: `on_auth_user_phone_confirmed` mirrors
`auth.users.phone_confirmed_at` onto the profile, so the application simply
stops writing the column.

The number being verified is deliberately **not** stored. It lives in
`sessionStorage` between the two screens (`apps/web/src/features/auth/pending-phone.ts`) because
an unverified number means nothing, and once Supabase phone auth is live the
number belongs to `auth.users.phone`.

## Authentication state

The stages the UI has always used map onto the database:

| UI stage | Source |
| --- | --- |
| `unauthenticated` | No Supabase session |
| `authenticated` | Session exists, `profiles.onboarding_stage = 'authenticated'` |
| `phoneVerified` | `'phone_verified'` |
| `onboardingStarted` | `'onboarding_started'` |
| `onboardingCompleted` | `'onboarding_completed'` |

`apps/web/src/features/auth/load-session.ts` reads this on the server and the `(auth)` layout
passes it down. The browser no longer decides who it is, so a tampered client
store cannot manufacture a stage. The stage only ever moves forward — revisiting
an earlier screen to change an answer does not demote anyone.

## Row Level Security

On for every table. Anything not granted is denied.

| Table | anon | authenticated |
| --- | --- | --- |
| `cities` | select (active only) | select (active only) |
| `languages` | select (active only) | select (active only) |
| `profiles` | — | select/insert/update **own row** |
| `profile_languages` | — | select/insert/delete **own rows** |
| `waitlist` | insert | insert |
| `membership_plans` | select (active only) | select (active only) |
| `entitlements` | select | select |
| `subscriptions` | — | select **own rows** |

`subscriptions` has no write policy for anybody — see the membership section.
Pricing is readable by `anon` on purpose: hiding what a product costs behind a
login is hostile.

Nobody can read the waitlist without the secret key — it is personal data
belonging to people who are not members. Nobody can read another member's
profile at all: cross-member discovery needs rules that do not exist yet, and
the safe default until they do is that nobody sees anybody.

## Cities

Registration is open across **all of India**. No city restricts it, and no screen
turns anyone away for where they live.

493 cities across all 28 states and 8 union territories, seeded from
`scripts/cities-india.mjs`. Edit the dataset there and regenerate rather than
hand-editing SQL:

```
node scripts/cities-india.mjs > supabase/migrations/<timestamp>_seed_cities_india.sql
supabase db push
```

### `is_launch_city` no longer gates anything

It survives as **marketing and community-density metadata** — where Eraya is
concentrating first — and the landing page lists those seven. It affects the
*order* of search results and nothing else. It must never be used to decide who
may register; that was the old model and it is gone.

The distinction worth keeping is **registration availability** (everywhere)
against **community density** (seven cities, for now). Discovery can later
prioritise people who are geographically close without either concept moving.

### Search

`search_cities(query, max_results)` is a SECURITY INVOKER function, readable by
`anon` because the landing page offers city selection before anyone signs in.

Ranking happens in the database: exact name, then name-prefix, then a word inside
the name, then anything in `search_terms`. Sorting in the browser would mean
fetching a large set to sort, which is the thing worth avoiding.

`search_terms` holds the lowercased name, its state, and the spellings people
actually type. Someone who has said "Bangalore" for forty years will not type
"Bengaluru", so both find it — as do bombay, calcutta, madras, gurgaon, vizag,
trivandrum and poona.

Names repeat across states — Udaipur in Rajasthan and Tripura, Bilaspur in
Chhattisgarh and Himachal Pradesh — so slugs carry the state code and every
result displays its state. There is no population data here, so same-name ties
break alphabetically by state rather than by an invented prominence.

### Coordinates

`latitude`/`longitude` are populated only where verified, and null everywhere
else. A guessed coordinate is worse than an absent one: a wrong distance is
indistinguishable from a right one, and discovery would quietly mis-rank people.

### `profiles.other_city`

Retained but no longer written. Every member now resolves to a real `city_id`,
which is what lets discovery reason about distance. The column holds free text
for accounts created before registration opened nationwide.

## Membership and entitlements

Eraya is freemium. The paid tier exists in the database today; payments do not.

| Table | Holds | Who may write |
| --- | --- | --- |
| `membership_plans` | The catalogue and its prices, in paise | Migrations only |
| `entitlements` | What each tier may do, as `(tier, key) -> jsonb` | Migrations only |
| `subscriptions` | One row per term, per member | **Service role only** |

### Why `subscriptions` has no write policy

Not an oversight. A browser that can insert its own subscription row can award
itself premium, which makes every check downstream decorative. Membership is
granted by whatever takes the money — a payment webhook running with the service
role — and read back through RLS, which allows a member to see their own rows and
nobody else's.

### Entitlements are data, not code

Nothing outside `features/membership/entitlements.ts` should compare a tier.
Components ask for a named capability:

```ts
const { entitlements } = await loadMembership();
if (entitlements.canSeeInteresters) { ... }
```

Adding a capability from the future pool — boosts, read receipts, travel mode —
is two rows in `entitlements` and the feature itself. It is not a change to the
membership system. Every capability is seeded for **both** tiers, including the
ones free members do not get: a missing row and a deliberate `false` are
indistinguishable to calling code, and "the key was absent" is not a decision
anyone made.

If the table cannot be read, the module falls back to the free tier. The safe
failure is to withhold paid features, never to hand them out.

### Pricing

Prices are fixed and stored exactly as charged. Nothing is computed at runtime,
and the twelve-month plan is a price rather than a saving — describing it as a
discount would invent a claim the product does not make.

| Plan | Price | Note |
| --- | --- | --- |
| Monthly | ₹199 first month, then ₹299 | The only recurring plan |
| 3 months | ₹699 | One-off term |
| 6 months | ₹1,299 | One-off term |
| 12 months | ₹2,399 | One-off term |

The renewal price is shown beside the introductory one, never behind a click.

### What is not built

No payment provider is configured. `subscriptions.provider` defaults to `'none'`,
and a row in that state records intent and must never be read as money received —
which is why `'pending'` is excluded from `ENTITLING_STATUSES`. The membership
page says payments are not open rather than showing a button that would not
charge.

`'cancelled'` **is** entitling: cancelling stops the renewal, it does not refund
the current term.

## Email

### Custom SMTP is not optional

Supabase's built-in email service does three things that make it unusable beyond
development, and configuring SMTP lifts all three at once, on the free plan:

| Built-in | With custom SMTP |
| --- | --- |
| Delivers only to project members | Delivers to anyone |
| Two messages an hour | Provider's limit |
| **Templates cannot be edited at all** | Templates apply |

That third one is not documented anywhere obvious. Pushing a template without
SMTP fails with: *"Email template modification is not available for free tier
projects using the default email provider."* Configuring SMTP is therefore a
prerequisite for branding the email at all, not merely for delivering it.

SMTP is configured. `SUPABASE_SMTP_HOST`, `SUPABASE_SMTP_USER` and
`SUPABASE_SMTP_PASS` live in `.env.local`; apply any template change with:

```
supabase config push
```

The sending domain needs SPF and DKIM records. The sender mailbox does not need
to receive anything: mail goes out as `no-reply@eraya.app`, and the address that
is actually read, `hello@eraya.app`, is named in the body so a reply is never
silently lost.

### Templates live in the repository

`supabase/config.toml` points `[auth.email.template.*]` at
`supabase/templates/magic-link.html`. Same reasoning as the migrations: a
template that exists only in one project's dashboard cannot be reviewed,
reproduced or rolled back — and this is the first thing a new member sees of
Eraya.

The template links to `/auth/confirm?token_hash=…` rather than Supabase's verify
endpoint, which is what makes a link requested on one device work when opened on
another. See "The two shapes an email link can arrive in" above.

The logo is a PNG, generated from `mark.ts` by
`scripts/build-email-logo.mjs` — the same geometry as the favicon and the site
header, so it cannot drift. Regenerate it if the mark is ever revised:

```
node scripts/build-email-logo.mjs
```

It sits beside a text wordmark rather than replacing it, because most clients
block images by default and an image-only header arrives as a broken icon.

### A trap in `supabase config push`

It pushes the **whole** file, not just the section you changed. `config.toml`
previously declared all three OAuth providers `enabled = true` with empty
credentials, so a push would have switched Google on with no client id — and
`auth-settings.ts` renders a button for any provider the live project reports as
enabled. The result would have been a Google button that ejects people onto a raw
JSON error page.

They are now `enabled = false`, matching the live project. Register the OAuth
app, set the environment variables, then flip the flag.
