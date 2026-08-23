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
| `shared/{ui,brand,data}/` | Only what more than one feature genuinely uses |
| `lib/supabase/` | Client construction and generated database types |

Put new code in the feature that uses it. Promote to `shared/` when a second
feature actually needs it, not in anticipation of one.
