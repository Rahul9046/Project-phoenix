@apps/web/AGENTS.md

# Repository layout

This is a workspace monorepo. One app today, room for more.

| Path | What it is |
| --- | --- |
| `apps/web/` | The Next.js app. Run every `next`/`npm` command from here or via the root scripts |
| `supabase/` | Migrations and config. The contract between every app, owned by none of them |
| `assets/brand/` | Logo source artwork. Not served — `public/` is what ships |
| `docs/` | Product, brand, backend and open questions |

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

**Never grant membership from the browser.** `subscriptions` has no insert,
update or delete policy for anyone, deliberately. Membership is written by
whatever takes the money, running with the service role. A client that can write
its own subscription row can award itself premium.
