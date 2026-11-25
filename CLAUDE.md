@apps/web/AGENTS.md

# Repository layout

This is a workspace monorepo. One app today, room for more.

| Path | What it is |
| --- | --- |
| `apps/web/` | The Next.js app. Run every `next`/`npm` command from here or via the root scripts |
| `apps/mobile/` | The Expo app, Android and iOS from one codebase. See `docs/09-mobile.md` |
| `supabase/` | Migrations and config. The contract between every app, owned by none of them |
| `assets/brand/` | Logo source artwork. Not served — `public/` is what ships |
| `docs/` | Product, brand, backend, mobile and open questions |
| `scripts/` | Local tools: the city dataset, demo members, the security probe |

Inside `apps/web/src/`, `app/` is routing only: a folder there exists to define a
URL. Everything else lives beside the feature it belongs to.

| Path | Holds |
| --- | --- |
| `features/{auth,marketing,waitlist}/` | Screens, components, copy and actions for one feature |
| `features/app-shell/` | The signed-in shell: header, navigation, account menu, page primitives |
| `features/account/` | Copy for the account area |
| `features/membership/` | Tiers, plans and the one entitlement authority |
| `shared/{ui,brand,data}/` | Only what more than one feature genuinely uses |
| `lib/supabase/` | Client construction and generated database types |

Put new code in the feature that uses it. Promote to `shared/` when a second
feature actually needs it, not in anticipation of one.

## Two rules that are easy to break

**Never compare a membership tier in a component.** Read a named capability from
`features/membership/entitlements.ts` instead — `canSeeInteresters`,
`revertLimit`, and so on. The values live in the `entitlements` table, so adding
a premium feature is an insert plus the feature, not a hunt through the UI for
`tier === 'premium'`.

**Never show a badge for something Eraya has not checked.** A "phone verified"
mark may rest on one predicate and no other: `phone_is_verified()`, which is
`phone_verified_at` together with `phone_verified_via = 'msg91'`. Reaching the
`phone_verified` onboarding stage means only that the step is behind somebody --
completed or declined -- and earns no mark, and neither does a number the retired
stand-in marked. A trust mark that runs ahead of the system is worse than none,
because the person relying on it is a stranger deciding whether to meet someone.

Verification itself is **real on the web**, through MSG91's OTP widget, and has
been exercised in production. **In the app it cannot currently be completed**:
that path uses MSG91's OTP API, which will not deliver in India without a
DLT-approved template, so the app asks for a real code and fails truthfully
rather than accepting one. It is optional on both clients and blocks nobody. No
deployed project accepts a fixed or arbitrary code. None of this concerns email
sign-in, which is a separate flow.

**Never run `supabase config push` directly. Use `npm run config:push`.** The
config refers to OAuth credentials as `env(NAME)`, and when a variable is missing
the CLI pushes the literal text `env(NAME)` as the value rather than failing --
silently breaking Google and Facebook sign-in with a completely successful-looking
push. The wrapper refuses when a required value is absent.

**Revoke from `public`, not from `anon`.** `create function` grants EXECUTE to
PUBLIC and `anon` inherits it, so `revoke ... from anon` does nothing. Every
member-facing function must `revoke execute ... from public, anon` and then
`grant ... to authenticated`. `scripts/security-probe.mjs` checks this.

**Never grant membership from the browser.** `subscriptions` has no insert,
update or delete policy for anyone, deliberately. Membership is written by
whatever takes the money, running with the service role. A client that can write
its own subscription row can award itself premium.

**Never treat a store's word as a grant.** A Google Play `purchaseToken` from a
device is a lookup key, not proof -- the same way a Razorpay callback is a claim.
Entitlement comes only from `payments-play-verify` asking the Android Publisher
API, and a purchase is consumed only *after* the server has granted the term,
because Play revokes an unacknowledged purchase after three days and the grant
must never depend on the acknowledgement succeeding.

**Never decide how a build takes money from `Platform.OS`.** Android ships as two
artifacts: the APK downloaded from eraya.app, which is sideloaded and keeps the
Razorpay browser checkout, and the Play build, which must sell through Play
Billing and must never fall back to Razorpay. Both report `android`. The one
authority is `paymentProvider` in
`apps/mobile/src/features/membership/purchasing.ts`, built from
`distributionChannel` in `distribution.ts`, which reads
`EXPO_PUBLIC_DISTRIBUTION` -- inlined at build time, absent meaning `direct` so
that forgetting it can never point a public install at a Billing client Play
will not serve. `purchase()` switches on it exhaustively; add a provider and the
switch stops compiling. See `docs/10-payments.md` and `docs/14-google-play.md`.
