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

**Never show a badge for something Eraya has not checked.** Phone verification
is mocked -- any six digits pass, no SMS is sent -- so no member is shown a
"phone verified" mark on another member's card, on either client. A trust mark
that runs ahead of the system is worse than none, because the person relying on
it is a stranger deciding whether to meet someone.

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

**Never decide how a build takes money from `Platform.OS`.** Android ships as
two artifacts: the APK downloaded from eraya.app, which is sideloaded and keeps
the Razorpay browser checkout, and the Google Play build, which must never open
a web checkout and today sells nothing at all. Both report `android`. The one
authority is `paymentProvider` in
`apps/mobile/src/features/membership/purchasing.ts`, built from
`distributionChannel` in `distribution.ts`, which reads
`EXPO_PUBLIC_DISTRIBUTION` — inlined at build time, absent meaning `direct` so
that forgetting it cannot change the artifact the public is running, and any
unrecognised value meaning `unknown`, which sells nothing. `purchase()` switches
on it exhaustively; add a provider and the switch stops compiling. Google Play
Billing itself is **not merged** (PR #152) and no purchase has been observed
through it. See `docs/10-payments.md`.
