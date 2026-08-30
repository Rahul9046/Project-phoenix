# Mobile backend handoff

Everything a React Native / Expo client needs in order to talk to the same
Supabase project the web app uses, and the product rules it must not contradict.

**No credentials are in this document.** Keys live in `.env.local` on the web
side and must live in the mobile app's own environment configuration. Ask the
project owner for them; do not copy them into any file that is committed.

---

## 1. The backend is already client-independent

Nothing about the schema, the policies or the functions assumes a browser. Every
rule the product depends on is enforced in Postgres, not in the web app:

- Row Level Security decides what any signed-in caller can read and write.
- The privacy boundary between members is a `security definer` function that
  returns a fixed set of columns. There is no "select from profiles" path that a
  client could widen.
- Premium gating is evaluated in SQL, inside `interests_received()`.
- Age validation, the `member_a < member_b` ordering of connections, and the
  one-interest-per-direction rule are constraints, not client checks.

A mobile client that authenticates and calls the same RPCs gets the same
behaviour. **The correct default is to build no new backend for mobile.** If a
mobile feature seems to need a new table or policy, that is a product decision,
not a porting detail.

## 2. Connecting

Use `@supabase/supabase-js` with `@react-native-async-storage/async-storage` as
the auth storage adapter, and set `detectSessionInUrl: false` — that option is
for browsers and will misbehave under a native URL scheme.

Two values are needed, both of which are safe to ship in the app binary:

| Variable | What it is |
| --- | --- |
| Supabase project URL | The `https://<ref>.supabase.co` endpoint |
| Publishable (anon) key | The public key; RLS is what protects the data |

The **service role / secret key must never be in the mobile app**. It bypasses
every policy. The web app reads it in exactly one place (deleting an account,
which has to reach `auth.users`) and throws if it is ever read in a browser. See
`apps/web/src/lib/supabase/env.ts`.

## 3. Authentication

| Method | State |
| --- | --- |
| Email magic link / OTP | Live, with custom SMTP so templates are branded |
| Google | Live |
| Facebook | Live |
| Apple | **Not configured.** Required before iOS submission if any other social sign-in ships |
| Phone (SMS) | **Mocked.** See §7 |

Redirect handling is the one genuinely different thing on mobile. The web app
uses PKCE and accepts both link shapes Supabase can send — a `code` parameter and
a `token_hash` + `type` pair — because the default templates return the first and
the custom ones can return the second. Mobile needs the same tolerance, against a
deep link scheme rather than an http URL.

Add the mobile redirect URL to `supabase/config.toml` under
`auth.additional_redirect_urls` and run `supabase config push`. Adding it does
not affect web.

Apple sign-in is currently `enabled = false` in config. It is not fabricated as
present anywhere in the product, and it must not be: **do not add provider
credentials that have not actually been issued.**

## 4. Data model

Enums (`public`): `relationship_status` (divorced, separated, widowed — there is
no "single"), `gender` (woman, man, non_binary, prefer_not_to_say),
`onboarding_stage`, `interest_kind`, `membership_tier`, `entitlement_kind`,
`subscription_status`, `payment_provider`.

| Table | Notes |
| --- | --- |
| `profiles` | One row per `auth.users` row, same id. `date_of_birth` never leaves the server; only a computed age does |
| `profile_languages` | Join table. `profiles.languages_undisclosed` covers "prefer not to say" |
| `cities` | 493 rows, 36 states and union territories. Public reference data |
| `languages` | Public reference data |
| `member_interests` | One row per direction, `interested` or `passed` |
| `connections` | Created only when interest is mutual. `member_a < member_b` enforced by a check constraint plus a unique index, so a pair can exist once |
| `messages` | No `read_at` column, deliberately — see §6 |
| `member_blocks` | Enforced inside `discover_members` |
| `member_reports` | Insert-only for the reporter |
| `membership_plans`, `entitlements`, `subscriptions` | See §5 |
| `waitlist` | Retired. No policy grants any client access. Do not build against it |

## 5. RPCs — the whole member-facing surface

All are `security definer` and revoked from `anon`. `search_cities` and
`city_coverage` are public because onboarding needs them before sign-in.

| Function | Purpose |
| --- | --- |
| `discover_members(max_results)` | The introductions. Excludes self, blocks in either direction, and anyone already decided on. Ordered by `md5(profile ‖ viewer ‖ current_date)` so the same few people appear all day |
| `member_profile(id)` | One member, as the same fixed column set |
| `express_interest(target_id, decision)` | Atomic. Records the decision and creates the connection if it is now mutual. Returns the connection id or null |
| `interests_received()` | Who expressed interest in you. **Returns nothing without a premium subscription — checked in SQL.** A mobile client cannot bypass this |
| `search_cities(query, max_results)` | Ranked substring match, with a trigram fallback for misspellings |
| `city_coverage()` | Counts of cities and states, for marketing copy |

The shape all four member functions return is the composite type `member_card`:
id, first_name, age, city, state, relationship_status, gender, languages,
phone_verified, email_verified. **That is the entire privacy boundary.** Adding a
column to it exposes it to every member.

Membership is read through the `entitlements` table keyed by tier — never
hardcode what free or premium can do. Current keys: `canSeeInteresters`,
`canUseIncognito`, `canUsePriorityVisibility`, `revertLimit` (3 free / 15
premium), `canBrowseProfiles`, `canUseDiscoveryFilters`. Note that `subscriptions`
has **no insert, update or delete policy for anyone** — subscriptions can only be
written with the service role, which is correct until a payment provider exists.

## 6. Product rules the mobile client must not break

These are decisions, not implementation details. Each one has a reason.

1. **Divorced, separated, widowed. Never "single".** Eraya is for one chapter of
   life; adding "single" makes it a general dating app.
2. **No directory and no search for people.** You are introduced to a few at a
   time. There is no endpoint that lists members, and there should not be.
3. **A pass is never disclosed.** `member_interests` has no read policy for the
   receiving side; only premium's `interests_received()` sees interest, and it
   filters passes out.
4. **Nobody can message without mutual interest.** Enforced by the insert policy
   on `messages`, not by hiding a button.
5. **No read receipts, no typing indicators, no unread counts, no streaks, no
   reply nudges.** The `messages` table has no `read_at` column so that this
   cannot be added carelessly. Every one of those features exists to make one
   person feel owed and the other feel watched.
6. **No photos.** The web app renders a monogram. This is a product position,
   not a missing feature.
7. **Age is shown, date of birth never is.** Members must be 18+; a check
   constraint enforces it.
8. **Discovery is not filtered by city.** Where someone lives affects nothing
   about who they can meet or whether they can join.
9. **Anyone in India can register.** There is no launch-city gate. `is_launch_city`
   still exists as a column and affects search result *ordering* only.
10. **Deleting an account deletes everything**, immediately and with no grace
    period, through `ON DELETE CASCADE`. Do not build a soft delete.

## 7. What is genuinely incomplete

Do not present any of these as working, in the app or in copy.

- **Phone verification is mocked.** Any six digits are accepted and no SMS is
  ever sent. `profiles.phone_verified_at` is written by the application itself.
  Because of this, "Phone verified" is deliberately **not** shown as a trust mark
  on another member's card — a safety claim must never run ahead of the system.
  `apps/web/src/features/auth/phone-verification.ts` documents the switch-over.
- **No payments.** No provider is integrated, so no subscription can be created
  and premium is unreachable in practice. Never simulate a successful payment.
- **No moderation.** Reports are recorded and nothing reads them. The web app
  therefore blocks the person as well as filing the report, and its wording never
  promises a review. Keep that pairing.
- **No profile review, no identity or relationship-status verification.** Nothing
  in the product should claim otherwise.
- **Apple sign-in is not configured.**
- **No push notifications, and no backend for them.**
- **No privacy policy or terms as legal documents.** The pages describe what is
  actually collected and say plainly that the formal documents are still being
  written. India's DPDP Act applies.

## 8. Working on the schema

Migrations live in `supabase/migrations`, are timestamp-ordered, and are all
applied to the linked project. To change the schema:

```
supabase db push                              # apply new migrations
supabase gen types typescript --linked > apps/web/src/lib/supabase/database.types.ts
```

Regenerate types for the mobile app the same way, into its own file. Do not edit
generated types by hand.

`supabase config push` applies `supabase/config.toml` — auth providers, redirect
URLs, email templates. It reads secrets from the environment; the file itself
contains no key material and must stay that way.

Never edit a migration that has already been applied. Write a new one.
