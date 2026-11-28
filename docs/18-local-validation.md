# Local validation

How to bring up a local Supabase stack that tells the truth, and why the
obvious way does not.

Until 2026-11-26 this document could not exist: the machine had no Docker, so
there was no local Postgres, no way to execute a migration before production,
and nine runtime access-control assertions that had never been run anywhere.
They have now all been run, and everything below is what it took.

---

## What the local stack is for

Three things, none of which any other check can do.

| Command | What it proves |
| --- | --- |
| `npm run security:local` | Fixtures, then both writing probes, against a disposable database |
| `npm run security:local:mutations` | That each of the nine assertions **fails when its rule is removed** |
| `npm run moderation:local` | The photograph queue and text screening, as a real member |
| `npm run demonstration:local` | That a demonstration account and a real member cannot reach each other — including through a history that existed before the conversion |
| `npm run demonstration:local:mutations` | That each of those controls **fails when its rule is removed** |
| `npm run security:invariants` | Structure only — reads the migrations, executes nothing |

The last one needs nothing at all and is the weakest. A policy that reads
correctly can still be wrong against real rows; this repository has shipped a
client-side auth guard and a dead drag handler that passed every static check
while broken.

---

## Bringing it up

**Two things make `npx supabase start` fail or lie, and neither is guessable.**

### 1. Storage is declared off, and a migration needs it

`supabase/config.toml` carries `[storage] enabled = false`. With storage off the
storage service never boots, so the `storage` schema is never created, and
`20260905100100_brand_bucket.sql` fails on `relation "storage.buckets" does not
exist`. `supabase start` then rolls the whole stack back.

Set `[storage] enabled = true` for a local run and revert it afterwards. It is
a local-only nuisance, not a production risk — the section at the end explains
why, and corrects a Stage 4C finding that said otherwise.

### 1b. Windows may reserve the default ports after a reboot

`supabase start` can fail with `ports are not available: exposing port TCP
0.0.0.0:54322`, with nothing listening on it. The cause is a Hyper-V dynamic
port reservation, which Windows re-rolls on boot and which swallowed
**54263–54362** on 2026-11-27 — every default Supabase port at once.

```sh
netsh int ipv4 show excludedportrange protocol=tcp
```

If the range covers 54321–54324, move the local ports out of it: `[api]`,
`[db] port`/`shadow_port`, `[studio]`, `[local_smtp]`, **and** `[analytics]`
(Logflare defaults to 54327 and is not declared in this file, so it has to be
added or disabled). Revert afterwards. Nothing in the suite depends on the port
numbers — every runner resolves them from `supabase status`.

### 2. Migrations applied by `migration up` get the wrong privileges

This is the one that matters, because it does not fail. It passes.

`supabase migration up` connects as `postgres`, and in this image the default
ACL for objects `postgres` creates in schema `public` is much narrower than the
one `supabase_admin` carries:

| Default ACL set by | tables | sequences | functions |
| --- | --- | --- | --- |
| `supabase_admin` | `arwdDxtm` | `rwU` | `X` |
| `postgres` | `Dxtm` | `w` | *(none)* |

…each to `anon`, `authenticated` and `service_role`. So a database built by
`migration up` gives `authenticated` **no SELECT on any table** and
`service_role` **no EXECUTE on any function**.

None of the 69 migrations compensates, and none should: on a hosted project the
grants already exist before the first migration runs, which is why every
migration here only ever *revokes* from `public` and `anon` and grants to
`authenticated` on top of a default it assumes.

**The consequence is a false pass, which is worse than a failure.** Every member
request answers `42501 permission denied`, so every "a member cannot do X"
assertion passes — refused by a missing `GRANT` rather than by the rule under
test. Measured, not supposed: on such a stack the suite answered **67 of 75**,
and all eight failures were card reads. Not one of them was the absent access
control.

The payment probe fails the other way and is at least honest about it:
`service_role` cannot call `settle_payment` or `revoke_payment`, so it reported
**34 of 70** with thirty-six `42501`s that do not exist in production.

### The order that works

The default ACL applies to objects created *after* it is set, so it has to be in
place before the migrations. A blanket `GRANT` afterwards is **not** equivalent —
it would hand `anon` the EXECUTE that twenty migrations deliberately revoke, and
quietly undo the controls under test.

```sh
# 1. Hold the migrations aside so `start` has nothing to apply.
mv supabase/migrations supabase/.hold && mkdir supabase/migrations

# 2. Bring up an empty stack. The storage service creates its schema here.
npx supabase stop --no-backup && npx supabase start

# 3. Grant what a hosted project grants, BEFORE anything exists.
docker exec -i supabase_db_eraya psql -U postgres \
  < scripts/sql/local-default-privileges.sql

# 4. Put the migrations back and apply all of them.
rmdir supabase/migrations && mv supabase/.hold supabase/migrations
npx supabase migration up --local
```

Verify before trusting anything:

```sh
docker exec supabase_db_eraya psql -U postgres -c \
  "select has_table_privilege('authenticated','public.profiles','SELECT');"
```

`npm run security:local` now refuses to run at all unless that holds and
`service_role` can execute `settle_payment`. It would rather stop than hand back
a confident, meaningless pass.

---

## What it cannot reach

`supabase/.temp/project-ref` contains `mwixuwmxvppeagyruueu`. **This checkout is
linked to production**, which puts `supabase db reset --linked` one flag away
from erasing it.

- `scripts/local-security.mjs` **strips `ERAYA_PROBE_ALLOW_REMOTE`** from every
  child's environment, resolves the stack from `supabase status` rather than
  trusting `SUPABASE_URL`, refuses any non-localhost target with no override,
  and never constructs `--linked` — it is not a variable, so it cannot be set by
  accident.
- `scripts/local-fixtures.mjs` and `scripts/local-mutation-check.mjs` refuse
  anything that is not localhost, with no flag to override. The mutation check
  runs its SQL inside the stack's own container, which cannot be a hosted
  project whatever any environment variable says.

---

## The mutation check, and why a green suite is not enough

`npm run security:local:mutations` breaks one rule at a time — a permissive
policy beside the real one, or a function redefined to drop its condition — and
checks that the assertion depending on it **fails**. Then it restores the rule
and confirms the suite goes green again.

It exists because three assertions in this repository have passed while
measuring nothing: a `member_profile` call that 404'd on a renamed argument and
asserted a phone number was absent from an *error body*; a photo-theft check
that attacked an empty folder; and nine assertions standing on fixtures that
were never onboarded.

It immediately found two more, and both are worth knowing:

- **The photo-theft attack could not delete anything.** It passed
  `prefixes: ["<id>/"]`, a directory, and Storage's bulk delete matches each
  entry against an object's *exact* name rather than walking directories. With
  `select` and `delete` on `storage.objects` opened to every authenticated
  caller the file still survived — so the assertion was true with the policies
  perfect and equally true with them gone.
- **The entitlement write could not insert.** It sent the JSON *string*
  `"true"` for a `jsonb` column under a check constraint requiring
  `jsonb_typeof(value) = 'boolean'`, so the row was refused by the constraint
  before any policy was consulted.

It also found two places where breaking a single rule changes nothing because
**two** rules are holding: a profile cannot be rewritten by another member even
with the UPDATE policy wide open, because PostgREST resolves the row through the
SELECT policy first; and photo files survive a wide-open DELETE policy for the
same reason. Defence in depth, and only visible by breaking one layer at a time.

---

## `[storage] enabled = false` — a local nuisance, not a production risk

**Stage 4C flagged this as a live risk of disabling production Storage on the
next `config:push`. That was wrong, and the evidence is three months old.**

The flag does two things, neither of which touches production Storage:

- **Locally** it decides whether `supabase start` runs the storage container.
  False means it does not, which is the whole reason for the bootstrap above.
- **On push** it tells the CLI not to manage that section. That is why the line
  exists: `b784553` added it to "make config push exit clean", because with
  storage enabled the CLI tried to configure vector buckets and the free tier
  answered `402`, failing every push for an unrelated reason.

The line has been in `config.toml` since **2026-08-29**. At least four config
pushes have gone out since — Google sign-in, Facebook on, the email rate limit,
Facebook off — and production Storage has been enabled and serving photographs
throughout. Verified read-only on 2026-11-27: two buckets (`profile-photos`
private, `brand` public) and **46 objects** in `profile-photos`.

So **leave it false.** Setting it true would restore the `402` and break
`npm run config:push` while changing nothing about production.

What *was* genuinely wrong is the comment, which claimed storage was off
"matching the project". It has been corrected in place, because a stale comment
that reads as a production risk costs a reviewer real time — it cost this
project a finding in a launch report.
