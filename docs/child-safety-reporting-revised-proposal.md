# Child safety reporting — revised implementation proposal

**Status:** proposal only. Nothing implemented, no migration applied, no production
mutation performed, no branch merged or pushed.
**Date:** 2026-11-01
**Branch:** `feature/child-safety-standards`
**Supersedes:** `artifacts/safety-reporting-assessment-2026-11-01.md` (first assessment)

### How to read the labels

Every material statement in this document carries one of these:

| Label | Meaning |
| --- | --- |
| **[VERIFIED]** | Read directly from this repository, or from the Supabase CLI's cached link metadata, during this session. Reproducible. |
| **[DECISION]** | A proposed architectural choice. Alternatives and trade-offs are stated. Requires approval. |
| **[ASSUMPTION]** | Believed true, not verified. Each one names how it could be checked. |
| **[EXTERNAL]** | Depends on a third party (Supabase plan, Resend, Google Play) and cannot be settled from this repository. |
| **[LEGAL]** | Requires qualified legal advice. **No compliance claim in this document is made on the strength of code inspection.** |

---

## 1. Executive summary

The first assessment established that Eraya already has a working, well-bounded
reporting and moderation system, and that the work needed is gap-closing rather
than replacement. That conclusion stands. This revision changes **eight**
architectural decisions in response to review, and adds the deployment-safety
layer the first assessment lacked.

### What changed from the first assessment

| | First assessment | Revised | Why |
| --- | --- | --- | --- |
| **1** | Partial unique index on `(reporter, reported, content_id)` where status is open | **Transaction-scoped advisory lock + a short time window**, no unique index | A unique index cannot express a rolling window. The original would have blocked a legitimate new incident for as long as the first report sat unresolved — which, with one moderator, is days. |
| **2** | Refuse `delete_my_account()` while suspended | **Never refuse. Tombstone the subject and preserve the investigation record independently of the account**, with a bounded deferral only where law demands one | An indefinite deletion block is a deletion-rights problem and a Play problem. Preservation does not require refusal. |
| **3** | Evidence as a JSONB column on `member_reports` | **A separate `report_evidence` table** with no RLS policies, read only through an independently-audited call | A column on the report row is one `select *` away from the queue, cannot expire separately from the report, and cannot be access-logged distinctly. |
| **4** | Photo evidence = store the `storage_path` | **A three-layer legal hold**: reference, minimised descriptor, and the object held in place by a prefix move — never copied | Correct criticism: a path preserves nothing once the object is deleted. Four separate code paths can delete that object. |
| **5** | Extend `report_and_block_member` | **A new `report_content` RPC**, with validation extracted into one shared helper so the two cannot drift | Content reporting must not auto-block. Making the "always blocks" guarantee conditional on an argument is how the guarantee erodes. |
| **6** | Hourly Resend digest | **Immediate `pg_net` notification on insert for child-safety categories, plus a `pg_cron` fallback sweep for unresolved ones**, with a delivery-attempt ledger | An hour is the wrong latency for the one category the whole design prioritises. |
| **7** | "Probe after pushing to production" | **A second free Supabase project as a staging target, a pre-migration dump, and `db push --dry-run` as a mandatory pre-flight** | The first plan had no rollback story for an irreversible FK change on a production database with no staging. |
| **8** | Evidence call returns the connected conversation | **Two levels: the reported message alone by default; surrounding context behind a second, separately-audited call** | "Do not expose arbitrary private conversations" needs the default to be minimal, not merely scoped. |

### The three facts that most shape this revision

1. **Production Postgres is 17.6.1.155.** **[VERIFIED]** — `supabase/.temp/postgres-version`,
   the CLI's cached record of the linked project. `nulls not distinct` (PG15+) is
   therefore available. It is no longer needed, because decision 1 above removes
   the unique index, but the question is closed. Note that
   `supabase/config.toml` declares `[db] major_version = 15` for the local
   stack — **a two-major-version disagreement with production** that would make
   any local test weaker than it looks. See R-11.

2. **Supabase refuses a direct SQL delete on `storage.objects` for every role**
   **[VERIFIED]** — stated in `scripts/photo-sweep.mjs` and again in
   `apps/web/src/features/account/actions.ts`: *"Direct deletion from storage
   tables is not allowed. Use the Storage API instead."* So no trigger, cascade
   or constraint can protect a photo. Protection has to be built out of RLS
   policies plus explicit checks in the application paths that hold the service
   role. There are four such paths, enumerated in §6.

3. **No credential on this machine can reach the production database directly.**
   **[VERIFIED]** — `~/.supabase` contains only `telemetry.json`, so there is no
   access token for the Management API; `SUPABASE_ACCESS_TOKEN` is unset; no
   `psql`; and the database password is not in `apps/web/.env.local` (which
   holds only the Supabase URL, publishable key, service-role keys, MSG91 and
   OAuth values). Every migration, dump, backup listing and staging operation in
   §5 therefore needs **you** to supply a credential. This is a prerequisite, not
   a blocker, but it must be stated before a plan leans on it.

### The single most important item

Unchanged from the first assessment, and now promoted to the earliest stage that
can safely carry it:

> `member_reports.reported_id` is `on delete cascade` to `profiles`
> **[VERIFIED]**, and `delete_my_account()` takes its id from `auth.uid()` with
> no check of any kind **[VERIFIED]**. A reported member deletes their account
> and every report filed against them is destroyed, along with their photos and
> messages. There is no recovery: the free plan's backup position is unverified
> **[EXTERNAL]**, and nothing in the product notices.

---

## 2. Existing functionality to preserve

This section is the contract. Everything named here works today, is covered by
the existing probe, and **must behave identically after every stage**. Each row
names how its preservation is verified.

### 2.1 Database objects — preserve behaviour exactly

| Object | Current behaviour to preserve | Verified by |
| --- | --- | --- |
| `report_and_block_member(uuid, report_reason, text)` | Files a report **and** a block, atomically, always. Refuses: not signed in (42501), null/self target (22023), null reason (22023), `other` with blank details (22023), details > 2000 (22001). Normalises all-whitespace details to null via `regexp_replace(…, '^\s+\|\s+$', '', 'g')` — **not** `btrim`, which was the bug fixed in `20260920110300`. | 11 existing probe checks |
| `is_moderator()` | Lower-cased, trimmed comparison of the session `email` claim against `ops_config.moderation_admins`. The only place privilege is decided. | 3 existing probe checks |
| `admin_list_reports(text)` | Returns nothing at all to a non-moderator. `open`/`resolved`/`all`. Excludes phone numbers, payment history and message contents. | 2 existing probe checks |
| `admin_dismiss_report`, `admin_suspend_member`, `admin_restore_member` | Re-check `is_moderator()` in their own body and raise 42501; write `moderation_actions` attributed from the session; no admin identity is ever a parameter; suspension is idempotent. | 8 existing probe checks |
| `is_suspended(uuid)`, `discover_members(…)`, `express_interest(…)`, the `messages` insert policy | Suspension hides a member in both directions and raises the same `unavailable` a block raises, so moderation is never announced to anyone. | 6 existing probe checks |
| RLS on `member_reports` | Insert-own only. **No select policy for anybody** — not the reporter, not the reported member. | 3 existing probe checks |
| RLS on `moderation_actions`, `ops_config` | Enabled with **no policies at all**. Reachable only through definer functions / the service role. | 2 existing probe checks |
| `delete_my_account()` | Deletes the caller and everything cascading from them. The id comes from the session and is deliberately not a parameter. | Verified by hand previously |
| Grant discipline | Every member-facing function: `revoke execute … from public, anon` then `grant … to authenticated`. `create function` grants to PUBLIC and `anon` inherits, so revoking from `anon` alone does nothing. | `npm run security` |

### 2.2 Application behaviour — preserve

- **Web reporting is called from the browser, not a server action** **[VERIFIED]**
  (`apps/web/src/features/members/report.ts`). A server action re-renders the
  route; the profile stops existing the instant the block lands, so the
  confirmation became a 404. Any new reporting call on the web must follow this.
- **Both clients read `REPORT_REASONS` from `@eraya/i18n`** **[VERIFIED]** — the
  list and its order are defined once. A new category is added there, never in a
  client.
- **Confirmation persists** — a panel on web (`role="status"`), a `BottomSheet`
  on mobile, not a toast that slides away.
- **One reason per report**, details optional except `other`.
- **`/admin/reports` answers `notFound()`, never 403** **[VERIFIED]** — the admin
  area does not confirm its own existence. `robots: { index: false }`, not linked
  from anywhere.
- **`reasonLabels` keeps every value the enum has ever held** **[VERIFIED]**,
  including the retired `incorrect_relationship_status`, so old reports still
  read as a sentence.
- **`photos:sweep` refuses to run rather than guess** **[VERIFIED]** and only
  touches a top-level folder matching `/^[0-9a-f]{8}-…$/i` with no live account.

### 2.3 Documented principles — preserve

- *"Copy anywhere in the product must not imply review that is faster or more
  certain than"* a founder reading reports by hand with no SLA — `docs/11`.
- *"Never show a badge for something Eraya has not checked"* — `CLAUDE.md`.
- *"Privilege to moderate is not privilege to browse"* — `20260911100100`.
- *"Revoke from `public`, not from `anon`"* — `CLAUDE.md`.
- *"Never grant membership from the browser"* — unaffected, but the same reflex
  applies to evidence.
- Probes, not tests, are the evidence vehicle — `npm run moderation:probe` runs
  as a **real member session, never the service role**, borrows the admin
  allowlist and restores it in a `finally` **[VERIFIED]**.

---

## 3. Revised gap analysis

Severity is re-scored against the review's priorities. Fifteen gaps from the
first assessment, plus four found during this revision (G16–G19).

### Critical

| | Gap | Verified detail |
| --- | --- | --- |
| **G5** | **Report evidence destroyed by account self-deletion.** | `member_reports.reporter_id`/`reported_id` are `on delete cascade`; `delete_my_account()` has no guard. **[VERIFIED]** |
| **G16** | **Photo evidence cannot survive, even with a path recorded.** Four independent paths delete the object: the member's own photo delete (user session, RLS applies), mobile account deletion (user session, `supabase.storage…remove`), web account deletion (**service role — RLS bypassed**), and `photos:sweep --apply`. **[VERIFIED]** A recorded `storage_path` therefore preserves nothing. | New in this revision |

### High

| | Gap |
| --- | --- |
| **G1** | No content-level reporting (message, photo). No CSAE category. |
| **G4** | No rate limiting of any kind on `report_and_block_member`. `reports_against_reported` is rendered **in bold** in the admin UI as a trust signal **[VERIFIED]**, so mass-reporting is aimed at the moderator's judgement. |
| **G8** | No evidence inspection, while `/child-safety` already tells the public that review "may mean reading the profile and the messages connected to it". |
| **G11** | No permanent removal action. `moderation_actions_known` allows only `dismissed`/`suspended`/`restored` **[VERIFIED]**, yet the page promises removal. |
| **G12** | No prioritisation. `admin_list_reports` orders by open-ness then `created_at desc` **[VERIFIED]**; the page claims child safety is highest priority. |
| **G13** | No moderator notification of any kind, and **no transactional email path exists to build on** — `config.toml` configures Resend over SMTP for Supabase Auth only, and no edge function sends mail **[VERIFIED]**. |
| **G14** | No documented investigation or escalation procedure. |
| **G17** | **No migration safety net.** No Docker **[VERIFIED: `docker: command not found`]**, so no local Supabase stack; no `psql`; no staging project; no CI that touches the database (`.github/workflows/` holds only `deploy-web.yml` **[VERIFIED]**); and the production backup position is unverified. A mistake in the FK migration has no tested path back. |

### Medium

| | Gap |
| --- | --- |
| **G2** | No server-side duplicate prevention and **no concurrency safety** — two simultaneous calls both pass any count-based check and both insert. |
| **G6** | No evidence snapshot; content can be edited or deleted after being reported. |
| **G7** | No category filter in the queue. |
| **G9** | The UI collects no moderator note; `ReportActions.tsx` hardcodes `"Reviewed after a report"` **[VERIFIED]**. |
| **G15** | No content-level restriction — a prohibited photo cannot be removed without suspending the whole account. |
| **G18** | **No evidence-access audit.** `moderation_actions.action` has no value for "looked at a member's messages", so there is no way to record it even if the capability is built. New in this revision. |
| **G19** | **`config.toml` declares local Postgres 15 against production 17.6** **[VERIFIED]**. New in this revision. |

### Low

| | Gap |
| --- | --- |
| **G3** | Reporting is reachable only from a profile or conversation; a member who blocked someone first can no longer reach them to report them. |
| **G10** | The `reviewing` status is never set by anything **[VERIFIED]**. |

### Policy mismatches (unchanged, re-confirmed)

| | Mismatch |
| --- | --- |
| **M1** | **The app contradicts the published page.** `report.note` reads *"Eraya is small and has no moderation team yet, so we cannot promise anyone will write back"* **[VERIFIED: `packages/i18n/src/locales/en.ts:560`]**, and both client components carry comments asserting *"There is no moderation team and no queue."* The queue has existed since `20260911100100`. `/child-safety` tells the public reports "are reviewed by hand, by the operator". The app copy predates the queue. |
| **M2** | Page promises permanent removal; no removal action exists (G11). |
| **M3** | Page claims message review; no path reads messages (G8). |
| **M4** | Page claims child-safety priority; no prioritisation exists (G12). |

Verified as **accurate and needing no change** on `/child-safety`: zero
tolerance and the prohibition list; adults-only with the honest admission that
age is not document-verified; the in-app step labels (they match what both
clients render); report-also-blocks; the instruction **not** to attach suspected
CSAM; police first, 112 / 1098; `support@eraya.app` with a `Child safety`
subject; and the absence of a published response time.

---

## 4. Architectural decisions and alternatives

### AD-1 — Content reporting gets its own RPC

**[DECISION]** Add `public.report_content(...)`. Do **not** add an
"also block?" parameter to `report_and_block_member`.

`report_and_block_member`'s entire contract is that reporting blocks, atomically,
always — asserted in its own comment, in both client components, and in `docs/11`
**[VERIFIED]**. The review requires that content reporting **not** block unless
the member chooses it. Making the guarantee conditional on an argument is how a
guarantee stops being one; the next caller that omits the argument gets a
different product rule.

To stop the two drifting, validation moves into one shared internal helper
`public.assert_report_filable(...)` which both call, carrying the
`regexp_replace` whitespace normalisation **verbatim**. `report_and_block_member`
keeps its exact signature, its exact error codes and its insert-both-rows body.

| Alternative | Why not |
| --- | --- |
| Extend the existing RPC with `p_also_block boolean default true` | Conditional guarantee; and it redefines a function whose body has already been patched twice for the whitespace bug (R-4). |
| Duplicate the validation in the new function | Two implementations of "is this report filable" will diverge; the whitespace bug would need fixing twice. |
| A separate `content_reports` table | Needs its own RLS, its own admin query, its own probe, and a second queue. No gain — a report is a report; what it points at is optional detail. |

**Trade-off accepted:** two entry points instead of one. Mitigated by the shared
helper and by probing both paths for every validation case.

### AD-2 — Evidence lives in its own table, not a column

**[DECISION]** `public.report_evidence` — one row per report, RLS enabled with
**no policies**, exactly like `moderation_actions`.

Three reasons a JSONB column on `member_reports` is wrong:

1. **Access control granularity.** `admin_list_reports` is the queue. Evidence
   must be reachable only through a separate, independently-audited call. On the
   same row it is one widened `select` away from the listing.
2. **Independent expiry.** The report is the record that must persist; the
   content is what expires. A column cannot be deleted without rewriting the
   report row, which is the thing a retention policy must not touch.
3. **Access logging.** Reading evidence is an act that belongs in the audit
   trail (G18). A column read inside an existing query cannot be logged
   distinctly.

**Trade-off accepted:** one extra join in one admin function.

### AD-3 — Photo evidence: hold in place, never copy

**[DECISION]** Three layers, no duplication of the file.

| Layer | What | Survives |
| --- | --- | --- |
| **1. Reference** | `member_reports.content_kind` + `content_id`, **no foreign key** (an FK to `profile_photos` would cascade with the account and reintroduce G5) | Always |
| **2. Descriptor** | In `report_evidence`: the `storage_path`, mime type, byte size, and the object's `etag`/checksum as reported by the Storage API at report time. **No image bytes, ever** — not in Postgres, not in an email, not in a log | Always |
| **3. Legal hold** | The object itself, **moved** (not copied) by the service role to a `legal-hold/<report_id>/…` prefix inside the **same** `profile-photos` bucket when a moderator opens a child-safety investigation | Until retention expiry |

Why a prefix move is the right primitive, and it is **not** a copy:

- Every member policy on `storage.objects` is of the form
  `(storage.foldername(name))[1] = auth.uid()::text` **[VERIFIED]**. An object
  under `legal-hold/` matches no member's policy, so the owner can no longer
  read, replace or delete it — using the existing security model rather than
  adding a new one.
- `photos:sweep` filters top-level folders through
  `/^[0-9a-f]{8}-[0-9a-f]{4}-…$/i` **[VERIFIED]**, so `legal-hold` is **already**
  skipped. No change to the sweep is required for it to be safe.
- Both account-deletion paths enumerate objects under the member's `<uid>/`
  prefix **[VERIFIED]**; a moved object is no longer there.
- One object exists throughout. No second copy of suspected illegal material is
  created, which is both the review's instruction and the right instinct.

**The gap a move alone leaves:** the move needs the service role and therefore a
moderator, so between filing and hold the owner can still delete the file. Two
mitigations, together:

- **Immediate, pure-SQL, no new infrastructure:** filing a content report writes
  an `evidence_hold` row in the same transaction, and the `storage.objects`
  DELETE and UPDATE policies gain `and not exists (select 1 from
  public.evidence_hold h where h.storage_path = name)`. This closes the
  member-initiated window the instant the report is filed, with no edge function
  and no service-role action.
- **Explicit checks in the two service-role paths**, because **the service role
  bypasses RLS** **[VERIFIED]** — `apps/web/src/features/account/actions.ts`
  deletes photos with `createAdminClient`, so the policy above does not constrain
  it. That path, and `photos:sweep --apply`, must consult `evidence_hold`.

| Alternative | Why not |
| --- | --- |
| Copy the object to a moderator-only `evidence` bucket | Creates a second copy of suspected illegal material. Explicitly excluded. |
| Store the bytes in Postgres | Same objection, plus it puts the material in every backup and dump. |
| Record the path only and accept loss | The review's point exactly: preserves nothing. |
| Enforce the hold only in application code | Four paths, three languages, one of which bypasses RLS. The RLS policy is the only layer that holds when someone adds a fifth. |

**Trade-off accepted:** enforcement is in three places (RLS + two service-role
callers). Unavoidable, because Supabase forbids the database-level mechanism
that would otherwise be correct. A probe asserts all three.

### AD-4 — Account deletion is never refused

**[DECISION]** Withdraw the first assessment's proposal to block
`delete_my_account()` for suspended members. Replace it with **tombstone +
bounded preservation**.

| Mechanism | Detail |
| --- | --- |
| **Reports outlive accounts** | `reported_id` / `reporter_id` → `on delete set null`, columns nullable. |
| **Tombstone** | `member_reports.reported_ref` — a stable opaque identifier plus **only** the fields an investigation needs to remain intelligible: the first name as it stood, and the account email. Not the profile, not the date of birth, not the photos, not the city. |
| **Deletion proceeds** | The account, profile, remaining photos, messages, interests, connections and subscription all go, exactly as today. |
| **Evidence retained** | `report_evidence` and any `legal-hold` object survive, for a **fixed, documented period** held in `ops_config`, after which a documented expiry job removes them. The report row and the audit trail persist longer than the evidence, because a record that a decision was made is not the same as the material it was made about. |
| **Bounded deferral only where law demands it** | A named, time-limited hold with a hard maximum (proposed: 30 days) and no renewal without a written legal basis recorded in `moderation_actions`. **Never indefinite.** **[LEGAL — L-1]** |

**Trade-off, stated plainly:** retaining a tombstone and evidence about a person
who has asked to be deleted is a real privacy cost, and it is being paid
deliberately. The alternative is that the subject of a child-safety
investigation can erase the investigation by pressing a button in the product.
Minimisation is the whole mitigation: two fields, a fixed expiry, no profile, no
photos beyond a held object, and nothing retained at all for reports that are
not under investigation.

| Alternative | Why not |
| --- | --- |
| Refuse deletion while suspended (first assessment) | An indefinite restriction on a deletion right, triggered by a moderator action with no appeal and no time limit. Bad for the member, bad under Play's deletion requirement, and unnecessary. |
| Soft-delete the whole account | Keeps everything about everybody. The opposite of minimisation. |
| Preserve nothing; accept the loss | The critical vulnerability, left open. |

### AD-5 — Duplicate prevention: advisory lock plus a short window

**[DECISION]** Replace the partial unique index entirely.

The review is right that the index was wrong. `create unique index … where status
in ('received','reviewing')` makes the refusal last **as long as the report stays
unresolved** — days, with one moderator — so a genuinely new incident involving
the same person could not be reported. A unique index cannot express "within the
last N minutes" at all.

```
1. pg_advisory_xact_lock( hashtextextended(reporter || ':' || target, 0) )
2. refuse if an identical (reporter, target, content_id, reason) exists
     within ops_config 'report_duplicate_window_minutes'   -- proposed 10
3. refuse if distinct targets reported by this reporter in the last day
     >= ops_config 'report_distinct_targets_daily_cap'     -- proposed 15
4. refuse if reports filed platform-wide in the last hour
     >= ops_config 'report_global_hourly_cap'              -- proposed 200
5. insert the report (and the block, on the blocking path)
```

Each element answers one requirement:

- **Concurrent duplicates** — step 1. This is the part a count-based check cannot
  do: without the lock, two simultaneous transactions both see zero and both
  insert. The lock is **transaction-scoped**, so it releases on commit *and* on
  rollback, and it is taken on `(reporter, target)` so it never serialises
  unrelated reporters.
- **Accidental duplicates** — step 2, a short window, not a status check. A real
  new incident ten minutes later is accepted.
- **Scripted mass-reporting** — step 3 counts **distinct targets**, which is the
  actual abuse signature. Reporting one person repeatedly is step 2's problem;
  reporting fifty people is this one's.
- **Urgent child-safety reports are never blocked by a global limit** — steps 3
  and 4 are **skipped entirely** when the reason is `csae` or `underage`. Step 1
  and step 2 still apply, because those only stop an exact double-submit and
  cannot suppress a real report.
- **No partial records** — every check precedes every write, in one function, in
  one transaction. A refusal raises, so nothing is committed. The existing probe
  check *"a refused report writes neither a report nor a block"* is extended to
  each new refusal path.
- **Atomicity preserved** — the blocking path still writes both rows or neither.

**Trade-off accepted:** a determined abuser can file unlimited `csae` reports.
That is the correct direction for the error to run. Mitigation is observation,
not refusal: a separate much higher `report_csae_daily_cap` as a backstop against
pure automation, and a reporter-level signal surfaced to the moderator, so a
false pattern is judged by a human rather than silently rejected.

**[VERIFIED]** `pg_advisory_xact_lock` and `hashtextextended` are core Postgres,
available on 17.6. No extension needed.

### AD-6 — Notifications: immediate, with a fallback and a ledger

**[DECISION]** Three parts.

1. **Immediate.** An `after insert` trigger on `member_reports`, firing only for
   `csae` and `underage`, calls `net.http_post` to a new edge function. `pg_net`
   is asynchronous, so the member's report does not wait on it and a failing
   notification cannot fail the report — the same rule `record_product_event`
   already follows **[VERIFIED: `docs/11`]**.
2. **Fallback.** A `pg_cron` job every 15 minutes finds child-safety reports
   still `received` with no successful delivery recorded, and re-posts. This is
   what makes "do not assume email delivery is guaranteed" operational rather
   than a sentence.
3. **Ledger.** `public.moderation_notifications` — one row per
   `(report_id, channel)`, with attempt count, last attempt, last error and
   `delivered_at`. It gives duplicate prevention (the trigger and the cron both
   insert-if-absent), retry state, and an answer to "did anyone actually get
   told".

Content of the email: **report id, category, timestamp, and a link to
`/admin/reports`.** No name, no description, no evidence, no photo, no reporter.
The link grants nothing — `/admin/reports` still answers `notFound()` to anyone
not on the allowlist, so the email is useless to an interceptor.

Recipients: read from `ops_config.moderation_admins`, so "authorised moderators
only" is true by construction and revoking a moderator revokes their
notifications in the same update.

**[VERIFIED]** Neither `pg_net` nor `pg_cron` is currently installed — the only
`create extension` in the repository is `pg_trgm` in
`20260829100100_cities_all_india.sql`. Both are available on Supabase at no
charge **[EXTERNAL — needs confirmation on this project's plan]**.

**Why the key cannot live in the database:** if `pg_net` posted to Resend
directly, the API key would have to sit in `ops_config` or in the trigger body —
inside every schema dump and every backup. Posting to an edge function instead
keeps the key in Supabase function secrets (`supabase secrets set`), which is
the only place in this architecture designed to hold one.

**A possible saving worth one command of your time.** Resend's SMTP transport
uses the API key as the SMTP password. If `SUPABASE_SMTP_PASS` begins with `re_`,
it **is** a Resend API key and no new credential is needed — only a second
reference to it. I attempted to read the first three characters and the action
was correctly blocked by the sandbox classifier for touching a secret, so this is
unverified. You can settle it without revealing anything:

```bash
grep -c '^SUPABASE_SMTP_PASS=re_' apps/web/.env.local   # 1 = already a Resend API key
```

| Alternative | Why not |
| --- | --- |
| Hourly digest (first assessment) | An hour is the wrong latency for the one category the design exists to prioritise. |
| `pg_cron` only, every 5 minutes | Simpler, no `pg_net`, but up to five minutes of delay on every report and a job running 288 times a day to find nothing. Acceptable fallback (see §9), not the primary. |
| Expo push to the operator's device | Needs push infrastructure and an admin build. Disproportionate. |
| Supabase Database Webhooks | Is `pg_net` with a dashboard in front of it; the trigger is in version control, the dashboard setting is not. |

### AD-7 — Evidence access: minimal by default, audited, two levels

**[DECISION]**

- `admin_report_evidence(p_report)` — checks `is_moderator()`, **writes the audit
  row before it returns anything**, and returns the `report_evidence` descriptor
  plus, for a message report, **that one message**. Nothing else.
- `admin_report_context(p_report, p_limit)` — a second, separate call for the
  surrounding messages in the **same connection**, derived from the reported
  message, never from a connection id a caller supplies. Separately audited,
  capped, and refused outright when the report carries no content reference.

`moderation_actions_known` gains `'evidence_viewed'` and `'context_viewed'`
(G18), so looking at a member's messages is itself on the record.

This satisfies "do not expose arbitrary private conversations" by construction:
there is no parameter through which a moderator can name a conversation. The
default is one message; reading more is a deliberate second act that leaves a
trace.

### AD-8 — Staging: a second free Supabase project

**[DECISION]** See §5. Summarised here for completeness: no local stack is
possible (no Docker), Supabase Branching is a paid feature, and a second free
project in the same organisation is the one option that is both real and free.

---

## 5. Database migration strategy

### 5.1 What was investigated, and what was found

| Question from the review | Finding |
| --- | --- |
| **1. Can a local Supabase environment be established?** | **No.** `docker: command not found` **[VERIFIED]**. `supabase start` requires Docker. Installing Docker Desktop on this machine is possible but is a material change to the developer environment and needs your decision (D-6). Note also that `config.toml` pins the local stack to Postgres **15** while production is **17.6** **[VERIFIED]**, so even with Docker a local test would be two major versions off until that line is corrected (G19). |
| **2. Can a temporary staging database be used?** | **Yes — a second free Supabase project.** `supabase projects create` exists **[VERIFIED: in the CLI's subcommand list]** but needs `supabase login`, for which no token is stored **[VERIFIED]**. `supabase branches` also exists, but **Supabase Branching is a paid Pro-plan feature billed per branch-hour [EXTERNAL]** and is therefore excluded under "no paid infrastructure without approval". **Recommended:** one free project, `phoenix-staging`, created once, migrated with `supabase db push --db-url …`, and **seeded with synthetic rows only — never a copy of production member data**, because copying real profiles to a second project is itself a privacy event. |
| **3. Does the plan support backup and recovery?** | **Unverified, and it must be settled before Stage 3.** `supabase backups list` and `supabase backups restore` exist **[VERIFIED]** but need `supabase login`. PITR is a paid add-on **[EXTERNAL]**. The free plan does not include point-in-time recovery **[EXTERNAL — confirm]**. This is decision D-1 and it gates the FK migration. |
| **4. How can foreign-key changes be tested without risking production?** | Four layers, all free: (a) run the migration on the staging project; (b) seed staging with synthetic rows that reproduce the exact shapes — a report whose target is deleted, a report whose reporter is deleted, a report with both gone, a report with an open child-safety category; (c) `supabase db push --dry-run` against production as a mandatory pre-flight **[VERIFIED: the flag exists]**; (d) a pre-migration dump of the affected tables via `supabase db dump --linked -f …` **[VERIFIED: the command exists]**, which needs the database password from you. |
| **5. How are report records preserved after account deletion?** | AD-4: `on delete set null` plus a two-field tombstone, with evidence in its own table and photos under legal hold. |
| **6. How are deletion requests handled during an investigation?** | AD-4: deletion is **never refused**; the investigation record is preserved independently. A bounded deferral exists only where law requires one, with a hard maximum and no silent renewal. **[LEGAL — L-1]** |
| **7. How is a retention and deletion policy enforced?** | §6.4: periods in `ops_config`, an expiry function, a `pg_cron` job, and secure deletion through the Storage API. |

### 5.2 Migration inventory — one concern per migration

The review's instruction *"do not combine unrelated changes into a single large
migration"* is taken literally. Seven migrations, each independently deployable
and independently reversible except where noted.

| # | File (proposed) | Concern | Reversible? |
| --- | --- | --- | --- |
| **N-1** | `…_report_evidence_tables.sql` | `report_evidence`, `evidence_hold`, `moderation_notifications`. Pure additions — new tables, RLS on, no policies. | Yes — `drop table` |
| **N-2** | `…_reports_outlive_accounts.sql` | **The critical fix.** FK → `on delete set null`, columns nullable, `reported_ref`/`reporter_ref` tombstones, `member_reports` backfill, `admin_list_reports` updated to read the tombstone. | **Partially.** FK direction is restorable; rows already null-ed by a deletion are not. |
| **N-3** | `…_storage_evidence_hold.sql` | The two `storage.objects` policy replacements (DELETE, UPDATE) consulting `evidence_hold`. | Yes — restore the prior policy text |
| **N-4** | `…_report_reason_csae.sql` | `alter type report_reason add value 'csae'`. **Nothing else.** | **No — irreversible.** Hence its own migration. |
| **N-5** | `…_report_content_and_validation.sql` | `content_kind`/`content_id` columns, `assert_report_filable()` helper, `report_content()`, `report_and_block_member()` redefined to call the helper. | Yes — `create or replace` back |
| **N-6** | `…_report_rate_limits.sql` | `ops_config` ceilings, advisory lock and window checks inside the two filing functions. | Yes |
| **N-7** | `…_moderation_escalation.sql` | Queue priority, category filter, `admin_begin_review`, `admin_report_evidence`, `admin_report_context`, `admin_remove_content`, `admin_remove_member`, `moderation_actions_known` widened, evidence-expiry function. | Yes, except the `check` constraint widening (trivially restorable) |

**Dependency order:** N-1 → N-2 → N-3 → N-4 → N-5 → N-6 → N-7.

- N-2 needs N-1's tables to exist only if the tombstone backfill records
  evidence; it does not, so **N-1 and N-2 are independent** and N-2 could go
  first. Keeping N-1 first means the critical migration lands on a schema that
  already has somewhere to put evidence.
- N-3 needs `evidence_hold` from N-1.
- N-5 needs N-4's enum value to validate a `csae` content report.
- N-6 needs N-4 for the child-safety exemption.
- N-7 needs N-1 (evidence), N-4 (priority) and N-5 (content references).

**Irreversibility, stated once, clearly.** `alter type … add value` cannot be
undone in Postgres. Removing `csae` later would mean creating a replacement type,
rewriting every dependent column, function signature and index, and deciding
what happens to reports already filed under it — which is why
`incorrect_relationship_status` is still in the enum today **[VERIFIED]**. N-4 is
a one-line migration specifically so that this one irreversible act is not
bundled with anything that might need rolling back.

### 5.3 Deployment checkpoints

Each numbered migration passes all five gates before the next is considered.
**None of this is executed during this assessment.**

```
CP-0  Prerequisites: `supabase login` done; database password to hand;
      `supabase backups list` output recorded; staging project exists.
CP-1  Migration applied to staging; synthetic fixtures in place.
CP-2  `npm run moderation:probe` green against staging, including new checks.
CP-3  `supabase db push --dry-run --linked` shows exactly and only this migration.
CP-4  `supabase db dump --linked -f backup-pre-N.sql` for the affected tables.
CP-5  Apply to production; re-run the probe against production; record the result.
```

A failure at CP-2 stops the stage. A failure at CP-5 triggers §14's recovery
procedure for that specific migration.

### 5.4 What cannot be made safe, and must be said

- **There is no tested rollback for rows already affected.** If N-2 ships and a
  member deletes their account before a defect is noticed, the FK has already
  null-ed their id. The dump at CP-4 is the only route back, and restoring it
  would overwrite reports filed in between. This is why N-2 is small, alone, and
  gated on a verified backup.
- **Edge functions cannot be type-checked here** (no Deno **[VERIFIED]**). The
  notification function ships last and alone, and is verified against production
  with a throwaway report.
- **A staging project cannot prove a data migration against production data**,
  only against synthetic shapes. Stated so the confidence is not overstated.

---

## 6. Evidence retention and deletion design

### 6.1 What is captured, and what is deliberately not

| Report of | Captured in `report_evidence` | Never captured |
| --- | --- | --- |
| A member | Nothing. The report row is the record. | — |
| A message | The message body (≤ 4000 by existing constraint **[VERIFIED]**), its author id, its `created_at`, its connection id | The rest of the conversation; the profile |
| A photo | `storage_path`, mime type, byte size, checksum/etag as reported by the Storage API | **The image bytes.** Never in Postgres, never in an email, never in a log, never in a dump |

**Why a message body is copied but an image is not.** The message row can be
deleted and the text is the evidence — a few hundred characters, and the only
durable form it has. An image's evidentiary value is the file, which must not be
duplicated; it is held in place instead (AD-3). The asymmetry is deliberate.

**Data minimisation.** One row per report. No profile snapshot — the tombstone's
two fields cover intelligibility. No conversation snapshot — context is fetched
live, on an audited call, from a connection the function derives itself.

### 6.2 Access

| | |
| --- | --- |
| Members | No path. `report_evidence` has RLS enabled and **no policies**, like `moderation_actions` **[VERIFIED pattern]**. |
| Moderators | `admin_report_evidence` / `admin_report_context` only, each checking `is_moderator()` in its own body and writing the audit row **before** returning (AD-7). |
| The service role | Reaches everything, as it must and as it already does. This is why the hold is enforced in the service-role application paths too (AD-3). |
| In the queue listing | A boolean "evidence present" and its kind. Never the content. |

A reported photo is **not** rendered in the browser and no signed URL is minted
by any admin function — decision **D-4**, carried forward from the first
assessment's Q3 and now recommended rather than merely raised. Viewing a held
object is a deliberate out-of-band act by the operator with the service role. The
trade-off is moderator convenience against never having a URL to suspected CSAM
in a browser history, a server log, or a referrer header.

### 6.3 Storage lifecycle

```
report filed ──► evidence_hold row (same transaction)
                 │  member can no longer delete the object: RLS policy (N-3)
                 ▼
moderator opens investigation ──► service role MOVES the object to
                                  legal-hold/<report_id>/…   (one object, no copy)
                                  │  outside every member policy's prefix
                                  │  already skipped by photos:sweep [VERIFIED]
                                  ▼
retention expiry ──► Storage API delete + evidence row delete
                     report row and audit trail persist
```

The four deletion paths and how each is stopped:

| Path | Credential | Stopped by |
| --- | --- | --- |
| Member deletes their own photo | User session | RLS policy (N-3) |
| Mobile account deletion `supabase.storage…remove` **[VERIFIED: `apps/mobile/src/features/account/delete.ts:40`]** | User session | RLS policy (N-3) |
| Web account deletion via `createAdminClient` **[VERIFIED: `apps/web/src/features/account/actions.ts`]** | **Service role — RLS bypassed** | Explicit `evidence_hold` check in that server action |
| `photos:sweep --apply` | Service role | Already skips non-UUID top-level folders **[VERIFIED]**; an explicit check is added as a second layer |

### 6.4 Retention and expiry

Periods in `ops_config` so they change without a deploy, following the existing
pattern:

```
('evidence_retention_days',            '<pending L-2>')
('evidence_retention_days_csae',       '<pending L-2>')
('report_record_retention_days',       '<pending L-2>')
('deletion_deferral_max_days',         '30')   -- hard ceiling, never renewed silently
```

Enforced by `expire_report_evidence()` on a `pg_cron` schedule: for each expired
report, delete the `report_evidence` row, release the `evidence_hold`, remove the
held object **through the Storage API** (never SQL — Supabase forbids it
**[VERIFIED]**), and write a `moderation_actions` row recording the expiry. The
report row and the audit trail outlive the evidence, because the record that a
decision was taken is not the material it was taken about.

**Secure deletion.** Honest limits: a Storage API delete removes the object;
whether the bytes are promptly unrecoverable from the underlying store is
Supabase's property, not something this repository can assert **[EXTERNAL]**. And
any pre-expiry `supabase db dump` taken as a backup contains the message-body
snapshots that existed at the time — so **backup files are themselves evidence
and must be handled and destroyed accordingly**. That consequence is easy to miss
and belongs in the operational doc.

**Every retention number above is [LEGAL — L-2] and is left blank on purpose.**
Writing a plausible number into the proposal would be the mistake this section
exists to avoid.

---

## 7. Reporting UI changes

Minimal and additive. No existing flow is restructured.

### 7.1 Shared — `packages/i18n`

- `csae` added to `REPORT_REASONS`, **first in the order**. The file's own stated
  rule is that "the reasons somebody reaches for when frightened come first"
  **[VERIFIED]**, which puts it at the top, and both clients then render it
  prominently with no client change (they map over the array).
- `report.reasons.csae` in all six locales: en, hi, mr, bn, ta, te. English:
  *"Child sexual abuse or exploitation"*.
- `CSAE_REASONS = ['csae','underage']` exported, so "is this a child-safety
  report" is named once rather than compared in six places — the same reasoning
  `OTHER_REASON` already follows **[VERIFIED]**.
- `report.csaeNotice` — rendered only when a `CSAE_REASONS` value is selected:
  if a child is in immediate danger, contact the police first (112, or 1098 for
  Childline); and **do not attach, forward or re-share suspected material**. This
  mirrors `/child-safety` exactly, so the two cannot drift.
- `report.note` **rewritten** (M1). Proposed English, for approval as D-2:
  > *"Reports are read by hand. We are small, so we cannot promise a reply or say
  > how long it will take. The block does not wait for us — it takes effect
  > immediately."*
  True in all three clauses, consistent with `/child-safety`, and still obeying
  `docs/11`'s rule against implying review faster or more certain than exists.
- `report.content.*` for the per-item flow.
- **Tamil and Telugu overflow** must be re-checked: those two carry known
  baseline overflow numbers, and "Child sexual abuse or exploitation" is a long
  string in every language. `npm run locale:probe` is the gate.

### 7.2 Web

| File | Change |
| --- | --- |
| `features/members/MemberSafety.tsx` | Conditionally render `report.csaeNotice`. Correct the now-false "there is no moderation team and no queue" comment. No structural change. |
| `features/members/Conversation.tsx` | A visible **Report** control on each **incoming** message (the component already maps messages at line 79 **[VERIFIED]**). Visible, keyboard-reachable, `min-h-11` per the design system — **not** a hover-only or long-press-only affordance. |
| `app/(app)/discovery/[id]/page.tsx` | A visible **Report this photo** control beneath the gallery. |
| **New** `features/members/ReportContent.tsx` | The shared reason list bound to one message or photo, reusing the existing `Confirm` panel shape. Calls the RPC **from the browser**, per the established web pattern **[VERIFIED]**. |
| `app/admin/reports/page.tsx` | §8. |

Content reporting offers blocking as an **explicit, unticked choice**, never a
side effect — the review's requirement, and the reason AD-1 adds a separate RPC.

### 7.3 Mobile (Android)

| File | Change |
| --- | --- |
| `src/features/connections/SafetyActions.tsx` | The same conditional notice. The category list needs no change — it reads `REPORT_REASONS` **[VERIFIED]**. |
| `app/messages/[id].tsx` → `Bubble` | A visible report affordance on incoming messages only. The component already distinguishes direction via `message.fromMe` **[VERIFIED: line ~535]**, so "incoming only" needs no new data. Long-press **may** be added as a convenience, never as the only route — R-7 records that gesture-only code here once passed every repo check while being completely dead. |
| `app/member/[id].tsx` | A visible control on the photo viewer. |

Reuses `BottomSheet`, `SelectionCard`, `Field`, `Button`, `Text` **[VERIFIED: all
present]**. **No new dependency in either client.**

---

## 8. Moderation workflow

`/admin/reports` is extended, not replaced. It stays a list with a few actions
and no dashboard.

### 8.1 The queue

- **Ordering:** child-safety first (`csae`, `underage`), then open, then
  `created_at desc`. Backs M4.
- **Filters:** the existing status row, plus a category row. `p_reason
  report_reason[] default null` added to `admin_list_reports` as a defaulted
  parameter so every existing caller keeps working unchanged.
- **Row additions:** a child-safety marker; "evidence attached" and its kind; the
  tombstone name when the account is gone.
- The listing itself returns **no evidence content** — unchanged in spirit from
  today.

### 8.2 The actions

| Action | RPC | Audit value |
| --- | --- | --- |
| Start review | `admin_begin_review` | `reviewing` (new) |
| View evidence | `admin_report_evidence` | `evidence_viewed` (new) |
| View surrounding context | `admin_report_context` | `context_viewed` (new) |
| Dismiss (with a note) | `admin_dismiss_report` — existing, note now threaded from the UI | `dismissed` |
| Suspend (with a note) | `admin_suspend_member` — existing, note now threaded | `suspended` |
| Restore | `admin_restore_member` — existing | `restored` |
| Remove content | `admin_remove_content` | `content_removed` (new) |
| Remove account | `admin_remove_member` | `removed` (new) |

Every new function: `is_moderator()` in its own body, raising 42501 — never a
quiet no-op; `revoke execute … from public, anon` then `grant … to
authenticated`; the audit row written before the effect where the effect is
destructive. No admin identity is ever a parameter. `admin_remove_member` is
two-step in the UI and is only safe **after N-2**, because before N-2 removing an
account cascades away the reports that justified it.

G9 is closed by threading the note; G10 by `admin_begin_review`; G11 by
`admin_remove_member`; G15 by `admin_remove_content`; G18 by the two new audit
values.

---

## 9. Notification architecture

```
member files a csae/underage report
   │  (same transaction: report + block + evidence_hold)
   ▼
after-insert trigger  ── filtered to CSAE_REASONS ──►  net.http_post  (async)
   │                                                        │
   │  insert-if-absent into moderation_notifications        ▼
   │                                              edge fn  moderation-notify
   │                                                 │  holds RESEND_API_KEY
   │                                                 │  recipients from ops_config
   │                                                 ▼
   │                                              Resend API ──► moderator inbox
   ▼
pg_cron every 15 min ──► unresolved child-safety reports with no delivered_at
                         ──► re-post, increment attempts, record last_error
```

| Review question | Answer |
| --- | --- |
| **Existing Supabase scheduling** | None in use — `pg_trgm` is the only extension in the repository **[VERIFIED]**. `pg_cron` and `pg_net` are Supabase-provided and free to enable **[EXTERNAL — confirm on this project]**. |
| **Is Resend's free tier sufficient?** | 3,000/month and 100/day on the free tier **[EXTERNAL]**. Child-safety reports plus a 15-minute fallback for unresolved ones is comfortably inside that at Eraya's volume **[ASSUMPTION — volume is low; checkable against `member_reports` counts]**. The sending domain is already verified, since Auth email is live **[VERIFIED: `config.toml`]**. |
| **Secure storage of the key** | Supabase function secrets via `supabase secrets set`, read as an environment variable inside the function. Never in `ops_config`, never in a trigger body, never in the repository — otherwise it enters every schema dump. Possibly already present as `SUPABASE_SMTP_PASS` (AD-6's one-line check). |
| **Retry and failure handling** | `pg_net` is fire-and-forget with no retry, so retry is the cron's job, driven by `moderation_notifications.delivered_at` being null. Attempts and `last_error` are recorded; a plateauing attempt count is itself the alarm. |
| **Duplicate prevention** | One row per `(report_id, channel)`, inserted if absent. The trigger and the cron contend for the same row, so neither can send twice. |
| **Can delivery be tested without affecting production?** | Only partly, and this should not be oversold. The function cannot run locally (no Deno **[VERIFIED]**). The honest path is the one `moderation:probe` already uses **[VERIFIED]**: temporarily point `ops_config.moderation_admins` at a throwaway address, file a throwaway report from a `@demo.eraya.invalid` account, confirm the email, restore the allowlist in a `finally`. It touches production, so it is a deliberate, logged, out-of-hours act — not a routine test. |
| **Do not assume delivery** | The ledger is the mechanism. The fallback sweep means a lost email delays notice by 15 minutes rather than losing it, and the queue remains the system of record either way. |

**If immediate notification proves impractical** — if `pg_net` is unavailable on
this plan, or if the trigger proves unreliable — the fallback position is
**`pg_cron` alone on a 5-minute schedule**, polling for unresolved child-safety
reports. Trade-off: up to five minutes of latency instead of seconds, and a job
that runs 288 times a day mostly finding nothing. That is a real but acceptable
cost, and it needs no `pg_net`, no trigger and no change to the filing path. It
is the safest realistic alternative and is what should ship if anything about
part 1 is in doubt.

---

## 10. Security and privacy considerations

| Concern | How it is handled | Changed? |
| --- | --- | --- |
| Reporter anonymity | `member_reports` keeps **no select policy**. No new read path for a member is added anywhere in this proposal. | No |
| Reported user never notified | No notification path toward them. Content removal is silent. Suspension already raises the same `unavailable` a block raises. | No |
| Admin privilege | `is_moderator()` against a service-role-only allowlist, re-checked in every new function. Doubled with `requireModerator()`'s honest 404. | No |
| Evidence minimisation | One row per report; message text only where the row can vanish; **never image bytes**; no profile or conversation snapshot. | **Yes** |
| Evidence access | Separate functions, audited before returning, minimal by default, context behind a second call, no caller-supplied connection id. | **Yes** |
| Evidence durability | RLS hold + prefix move + explicit checks in both service-role paths. | **Yes** |
| No duplicate illegal material | A move, not a copy. One object throughout. No evidence bucket. No bytes in Postgres, dumps or email. | **Yes** |
| Notification leakage | Id, category, timestamp, link. The link grants nothing — `/admin/reports` still 404s. Recipients from the allowlist. | **Yes** |
| Deletion rights | Never refused. Tombstone of two fields, fixed expiry, bounded deferral with a hard ceiling. | **Yes** |
| Abuse of reporting | Advisory lock, short duplicate window, distinct-target cap, global hourly cap — with child-safety categories exempt from the two caps that could suppress an urgent report. | **Yes** |
| Backups as evidence | Named explicitly: a pre-migration dump contains message snapshots and must be handled and destroyed like evidence. | **Yes (new)** |
| Secret handling | Resend key in function secrets only. During this assessment, an attempt to read a secret's prefix was **correctly blocked by the sandbox**, and no secret value has been read or written. | — |

---

## 11. Legal and policy questions

### 11.1 Requiring qualified legal advice

**No compliance claim in this document rests on code inspection.** Each item
below needs a qualified Indian legal opinion, and several touch Google Play
policy, which is not a legal question but a contractual one.

| | Question | Blocks |
| --- | --- | --- |
| **L-1** | May an account deletion be deferred at all during an active child-safety investigation, and if so for how long? Is the proposed 30-day hard ceiling defensible, and what must be recorded to rely on it? | AD-4, N-2, `/delete-account` and `/privacy` wording |
| **L-2** | What retention period applies to child-safety evidence — a message snapshot, and a held image? What must be preserved, for how long, and when does preservation become unlawful retention? **Every number in §6.4 is blank pending this.** | §6.4, the expiry job |
| **L-3** | What are Eraya's actual reporting obligations? **POCSO Act 2012 §19/§20** (§20 binds media and internet personnel; failure to report is itself an offence); **IT Rules 2021 Rule 3(2)(b)** (removal of material depicting a child in a sexual act within **24 hours** of a complaint); **DPDP Act 2023** retention and erasure duties, including §8(7) retention where law requires. These are cited as the questions to put to counsel, **not as a statement of Eraya's position**. | `docs/17`, policy copy |
| **L-4** | Is a named **Grievance Officer** with published contact details required at Eraya's size under the Intermediary Guidelines? `support@eraya.app` is published; a named individual may not be. | Policy copy |
| **L-5** | Should Eraya register with the **NCMEC CyberTipline**? Open to non-US platforms and free to register **[EXTERNAL]**, but reporting obligations and data-transfer implications follow. | `docs/17`, policy copy |
| **L-6** | Does retaining a tombstone and evidence after deletion satisfy **Google Play's account-deletion requirement**, and how must it be disclosed in the Data safety form and on `/delete-account`? Contractual, not statutory. | `/delete-account`, Play declaration |
| **L-7** | Holding a suspected-CSAM object in `legal-hold/` means Eraya knowingly retains the material. Under what basis, with what access controls, and for how long is that the right thing to do rather than immediate deletion and a report? **This is the single question most worth asking first**, because AD-3's whole design turns on it. | AD-3, §6.3 |

### 11.2 Policy consistency — proposed resolution of each mismatch

All wording below is **proposed for approval**. Nothing is published unilaterally.

| | Resolution | Direction |
| --- | --- | --- |
| **M1** — reporting confirmation text | Rewrite `report.note` as in §7.1. | Change the **app** to match the page |
| **M2** — permanent removal claim | Build `admin_remove_member` (N-7). | Change the **code** to match the page |
| **M3** — evidence inspection claim | Build `admin_report_evidence` / `admin_report_context` (N-7). **And narrow the page**: it currently says review "may mean reading the profile and the messages connected to it", while the design returns one message by default and context only on a second audited call. Proposed: *"Reviewing a report may mean reading the reported message or photograph, and the conversation it sits in."* | **Both** |
| **M4** — prioritisation claim | Build queue priority (N-7) plus immediate notification (§9). | Change the **code** to match the page |
| **Reporting procedure** | Once `csae` exists, the page should name it directly instead of routing people to "Under 18" or "Threats or safety concern". Proposed step 3: *"choose Child sexual abuse or exploitation, or Under 18 if you believe the member is a child."* | Change the **page** after the code ships |
| **Escalation procedure** | New `docs/17-child-safety.md`, internal. The page gains only what is true, and only once L-1…L-7 are answered. | New doc |

**Sequencing rule:** the page is only edited *after* the capability it describes
is deployed and probed. The one exception is M1, which corrects app copy to match
a page that is already right — and that is why it is Stage 1.

---

## 12. Cost assessment

| Item | Cost | Note |
| --- | --- | --- |
| Migrations N-1 … N-7 | **₹0** | Existing project |
| Admin UI, client UI, i18n | **₹0** | Existing design system; no new dependency in either client |
| Probe extensions | **₹0** | Existing harness |
| **Second free Supabase project (staging)** | **₹0** | Free tier. Free organisations allow two active projects **[EXTERNAL — confirm]**. Pauses after inactivity, which is fine for episodic use. |
| `pg_cron`, `pg_net` | **₹0** | Supabase-provided **[EXTERNAL — confirm on this plan]** |
| Resend notifications | **₹0** | Free tier 3,000/month, 100/day **[EXTERNAL]**; domain already verified. **May need no new credential at all** (AD-6). |
| **Supabase Branching** | **PAID — excluded** | Pro plan plus per-branch-hour billing **[EXTERNAL]**. Named only to record that it was considered and rejected under the no-paid-infrastructure constraint. |
| **PITR add-on** | **PAID — decision D-1** | If `supabase backups list` shows no recovery option, this is the only purchasable safety net for N-2. The free alternative is the CP-4 dump, which is weaker but real. |
| Docker Desktop | **₹0 licence for personal use**, but a material environment change | Decision D-6. Free for individuals and small businesses; **[EXTERNAL]** for commercial licensing thresholds. |

**Nothing paid is proposed.** Two items (PITR, Docker) are decisions put to you
because the alternative is accepting less safety, and that should be your call
rather than mine.

---

## 13. Revised implementation stages

Ten stages, in the review's requested priority, with two dependency-driven
adjustments noted at the end. Every stage carries the nine required fields.

---

### Stage 1 — Correct the user-facing reporting text

- **Objective.** Close M1: stop the app telling every reporter that nothing will
  be read, when a queue exists and the published page says reports are read.
- **Components.** `packages/i18n/src/locales/{en,hi,mr,bn,ta,te}.ts`
  (`report.note`, new `report.csaeNotice`);
  `apps/web/src/features/members/MemberSafety.tsx` and
  `apps/mobile/src/features/connections/SafetyActions.tsx` (stale comments, and
  conditional rendering of the notice).
- **Database changes.** **None.**
- **Security.** None. No new data path, no new privilege.
- **Dependencies.** Approval of the wording (D-2). **None technical.**
- **Testing.** `npm run i18n:check`; `npm run locale:probe` (expect ≥ 565/580 and
  no new overflow); `npm run typecheck`; `npm run lint`; `npm run build`;
  `expo export`; read the flow in a real browser and on a device.
- **Deployment risk.** Very low. Web deploys from `main` via GitHub Actions
  **[VERIFIED]**; mobile copy ships with the next build.
- **Rollback.** `git revert`. No state.
- **Acceptance.** No string in either client claims there is no moderation team
  or no queue. `report.note` is consistent with `/child-safety`. Six locales
  present, probe clean. The CSAE notice is not yet reachable (no `csae` category
  until Stage 4) and that is expected.

---

### Stage 2 — Migration safety and evidence architecture

- **Objective.** Make it possible to ship a schema change safely, and create the
  tables evidence will live in. **No behaviour changes.**
- **Components.** A staging Supabase project; `docs/06-technical.md` or a new
  `docs/18-migration-safety.md` recording the procedure; migration **N-1**
  (`report_evidence`, `evidence_hold`, `moderation_notifications`); `config.toml`
  `[db] major_version` corrected to 17 (G19); `scripts/moderation-probe.mjs`
  extended with a staging target.
- **Database changes.** N-1 only — three new tables, RLS enabled, **no policies**.
  Nothing existing is altered.
- **Security.** The new tables are unreachable by any client from the moment they
  exist, which is the correct default. Probe asserts it before anything writes to
  them.
- **Dependencies.** `supabase login` (D-5); the database password; D-1 (backup
  position); D-6 (Docker, optional).
- **Testing.** Create staging; `supabase db push --db-url` the **entire**
  migration history to it, which incidentally proves the history replays from
  scratch — something never verified; seed synthetic fixtures; probe green
  against staging; `--dry-run` against production; apply; probe production.
- **Deployment risk.** Low — additive only. The real risk is procedural: this is
  the first time the migration history has been replayed anywhere.
- **Rollback.** `drop table` for all three. Fully reversible.
- **Acceptance.** Staging exists and replays the full history. `supabase backups
  list` output is recorded. The three tables exist in production and the probe
  confirms a member can read none of them. CP-0 … CP-5 are documented.

---

### Stage 3 — Fix the critical evidence-loss vulnerability

- **Objective.** A report survives the deletion of either account. Closes G5.
- **Components.** Migration **N-2**; `admin_list_reports` (tombstone fallback);
  `features/admin/data.ts` and the queue page (render the tombstone);
  `apps/web/src/features/account/actions.ts` and
  `apps/mobile/src/features/account/delete.ts` (no behaviour change yet — read
  only, to confirm they are unaffected).
- **Database changes.** N-2: FK → `on delete set null`; `reported_id` /
  `reporter_id` nullable; `reported_ref` / `reporter_ref` tombstone columns;
  backfill for existing rows; `admin_list_reports` redefined.
- **Security.** Tombstones are the minimum for intelligibility (name, email) and
  nothing more. No read path is widened: `member_reports` still has no select
  policy.
- **Dependencies.** **Stage 2 complete, including a recorded backup position.**
  This stage must not proceed on an unverified recovery story.
- **Testing.** On staging, four synthetic shapes: target deleted, reporter
  deleted, both deleted, and a deleted target with an open child-safety report.
  Probe asserts the report survives each, and that the queue renders it with the
  target named. Then: an ordinary member's deletion still works end to end.
- **Deployment risk.** **Highest in the plan.** An FK change on a live table.
- **Rollback.** FK direction restorable by migration. **Rows already null-ed by a
  real deletion are not recoverable** except from the CP-4 dump, which would
  overwrite anything filed since. This limitation is the reason for Stage 2.
- **Acceptance.** A reported member deletes their account; the report is still in
  the queue, attributed to the tombstone, with its reason and description intact.
  `delete_my_account()` still succeeds for an ordinary member. All 42 existing
  probe checks still pass.

---

### Stage 4 — Explicit CSAE reporting

- **Objective.** A member can name the thing directly. Closes half of G1.
- **Components.** Migration **N-4** (one line); `packages/i18n/src/report.ts`
  (`csae` first, `CSAE_REASONS`); six locale files;
  `features/admin/data.ts` `reasonLabels`.
- **Database changes.** N-4: `alter type public.report_reason add value if not
  exists 'csae'`. **Nothing else in this migration.**
- **Security.** None — the enum is what makes an unknown identifier a 400 before
  any application code has an opinion **[VERIFIED: the design's own reasoning]**.
- **Dependencies.** Stage 2 (staging exists, so an irreversible change is
  rehearsed before it is permanent).
- **Testing.** On staging: the value files and reads back; the admin queue labels
  it; `i18n:check` and `locale:probe` with specific attention to Tamil and Telugu
  overflow; the CSAE notice now renders in both clients.
- **Deployment risk.** Low to apply, **irreversible once applied**.
- **Rollback.** **None.** Documented in §5.2. This is why it is one line alone.
- **Acceptance.** Both clients offer "Child sexual abuse or exploitation" first,
  in six languages, with the emergency notice. A report files under it and
  appears in the queue correctly labelled. No locale overflows.

---

### Stage 5 — Safe duplicate prevention and rate limiting

- **Objective.** Stop concurrent duplicates and scripted mass-reporting without
  ever suppressing an urgent child-safety report. Closes G2, G4.
- **Components.** Migrations **N-5** and **N-6**; error-code mapping in
  `features/members/report.ts` and `apps/mobile/src/features/members/data.ts`;
  new copy keys for each refusal.
- **Database changes.** N-5: `assert_report_filable()` helper carrying the
  `regexp_replace` normalisation verbatim; `report_and_block_member` redefined to
  call it with its signature and behaviour unchanged. N-6: `ops_config` ceilings;
  `pg_advisory_xact_lock`; the window and cap checks, with `CSAE_REASONS` exempt
  from both caps.
- **Security.** Every check precedes every write in one transaction, so a refusal
  commits nothing. The lock is transaction-scoped and keyed on
  `(reporter, target)`, so it cannot be used to stall other reporters.
- **Dependencies.** Stage 4 (the exemption needs `csae` to exist).
- **Testing.** Boundary: cap − 1 allowed, cap refused. Window: inside refused,
  outside allowed. **Concurrency: two simultaneous identical submissions produce
  exactly one row** — the check the whole redesign exists for, run by firing both
  requests without awaiting the first. Exemption: a `csae` report files when the
  global cap is exhausted. Atomicity: every refusal path writes neither a report
  nor a block. Regression: all 11 existing validation checks, whitespace
  included.
- **Deployment risk.** Medium — it redefines the most-exercised function in the
  system.
- **Rollback.** `create or replace` back to the prior definitions; ceilings
  removable from `ops_config` without a deploy, which also means a cap set too
  low can be relieved in seconds.
- **Acceptance.** Concurrent duplicates produce one row. A legitimate second
  report of the same person after the window succeeds **even while the first is
  unresolved** — the specific defect this redesign fixes. A child-safety report
  is never refused by a cap. No partial records on any refusal.

---

### Stage 6 — Message and photo reporting, both clients

- **Objective.** Report individual content, with evidence captured and held.
  Closes the rest of G1, plus G6 and G16.
- **Components.** `report_content` (in N-5, activated here); migration **N-3**
  (storage policies); `features/members/ReportContent.tsx` (new);
  `Conversation.tsx`; `discovery/[id]/page.tsx`; mobile `Bubble` and
  `member/[id].tsx`; `report.content.*` copy;
  `apps/web/src/features/account/actions.ts` and `scripts/photo-sweep.mjs`
  (consult `evidence_hold`).
- **Database changes.** N-3 replaces the `storage.objects` DELETE and UPDATE
  policies to respect `evidence_hold`. `content_kind` / `content_id` columns
  arrive with N-5.
- **Security.** The hold row is written in the same transaction as the report, so
  the member-initiated deletion window closes immediately. The service-role paths
  are patched because **RLS does not constrain them** **[VERIFIED]**. No photo is
  copied; no bytes enter Postgres.
- **Dependencies.** Stages 2 (tables), 4 (category), 5 (helper).
- **Testing.** Probe: a content report captures a descriptor; the reporter cannot
  read it; a member **cannot** delete a held photo (user session); the web's
  service-role deletion **skips** a held photo; `photos:sweep` does not touch
  `legal-hold/`; blocking happens **only** when chosen. Clients: driven in a real
  browser and **on a real device** — R-7.
- **Deployment risk.** Medium. Replacing a storage policy risks breaking ordinary
  photo deletion for everyone, so the probe must prove an **unheld** photo still
  deletes normally.
- **Rollback.** Restore the prior policy text; `report_content` is additive and
  droppable; client changes revert by `git revert`.
- **Acceptance.** A message and a photo can each be reported from both clients
  via a visible control. Evidence is captured. A held photo survives every one of
  the four deletion paths. An unheld photo still deletes normally. Reporting
  content does not block unless the member ticks it.

---

### Stage 7 — Extend administrative moderation

- **Objective.** Everything §8 describes. Closes G7–G12, G15, G18, and M2–M4.
- **Components.** Migration **N-7**; `app/admin/reports/page.tsx`;
  `features/admin/{data,actions}.ts`; `ReportActions.tsx`.
- **Database changes.** N-7 as inventoried in §5.2.
- **Security.** Each new function re-checks `is_moderator()` and raises; audit
  written before destructive effect; `admin_report_context` derives the
  connection itself so no conversation can be named by a caller; grants follow
  the `public, anon` rule.
- **Dependencies.** Stages 3, 4, 6. `admin_remove_member` is unsafe before
  Stage 3.
- **Testing.** The non-negotiable check first: **an ordinary member gets nothing
  from every new RPC called by name.** Then: child-safety sorts first; the
  category filter narrows; evidence returns one message by default; context is
  capped and refuses a report with no content; both are audited; status
  transitions record the actor; removal writes its audit row before the account
  goes and the report survives it.
- **Deployment risk.** Medium — the most new surface area, but all additive.
- **Rollback.** All functions `create or replace`-able; the widened `check`
  constraint is restorable; UI reverts by `git revert`.
- **Acceptance.** A moderator can triage, review, inspect scoped evidence, note,
  suspend, remove content, and remove an account — each audited. A member can do
  none of it. The queue is still a list, not a dashboard.

---

### Stage 8 — Urgent notifications

- **Objective.** A child-safety report reaches a moderator in seconds. Closes G13.
- **Components.** `pg_cron`, `pg_net`; a trigger on `member_reports`; new edge
  function `supabase/functions/moderation-notify/`; `moderation_notifications`
  (from N-1); `RESEND_API_KEY` in function secrets; `config.toml` function entry.
- **Database changes.** Trigger and cron job, in their own small migration.
- **Security.** The key never touches the database. The email carries no name, no
  description and no evidence. Recipients come from the allowlist. The link
  grants nothing.
- **Dependencies.** Stage 4; D-3 (approach); the AD-6 credential check.
- **Testing.** Per §9: allowlist temporarily pointed at a throwaway address, a
  throwaway report filed, delivery confirmed, allowlist restored in a `finally`.
  Ledger asserted to prevent a second send. The fallback sweep tested by marking
  a row undelivered.
- **Deployment risk.** Medium, and of a particular kind: **this cannot be
  type-checked here** (no Deno **[VERIFIED]**), and the test touches production.
  It ships last and alone.
- **Rollback.** Drop the trigger and unschedule the cron — the system returns to
  a polled queue with no loss. The function can be left deployed and inert.
- **Acceptance.** A `csae` report produces exactly one email within seconds,
  containing no sensitive content, to allowlisted addresses only. A simulated
  failure is retried by the sweep. Filing still succeeds when notification fails.

---

### Stage 9 — Documentation and proposed policy wording

- **Objective.** Write down the process; propose page edits for approval.
- **Components.** New `docs/17-child-safety.md`; `docs/11` updated;
  `docs/18-migration-safety.md`; **proposed** diffs for `/child-safety`,
  `/delete-account`, `/privacy` — written, not published.
- **Database changes.** None.
- **Security.** None.
- **Dependencies.** Stages 3–8 deployed; L-1 … L-7 answered.
- **Testing.** Every claim on `/child-safety` re-walked against deployed
  behaviour, as this assessment did — with the M3 narrowing applied.
- **Deployment risk.** Low technically, **high reputationally**: a page that
  overclaims is worse than one that underclaims.
- **Rollback.** `git revert`.
- **Acceptance.** `docs/17` describes a process that exists. No public statement
  describes a capability that does not. **Policy diffs are approved by you before
  anything is published.**

---

### Stage 10 — Final compliance-oriented verification

- **Objective.** One consolidated evidence pass.
- **Components.** `moderation:probe` (full), `security`, `locale:probe`,
  `age:check`, `analytics:probe`; a written verification record in `artifacts/`.
- **Database changes.** None.
- **Dependencies.** All stages.
- **Testing.** Every probe; a manual walk of both clients on a device and in a
  browser; a line-by-line re-read of `/child-safety` against behaviour.
- **Deployment risk.** None.
- **Rollback.** N/A.
- **Acceptance.** All probes green or green-by-design with the deviation
  explained (`npm run security` is 63/72 by design **[VERIFIED: fixture account
  stages]**). The record states what was verified **and what remains a matter of
  Google's judgement** — see §15's closing note.

---

### Ordering adjustments from the review's list

Two, both dependency-driven:

1. **Migration safety (Stage 2) is promoted above the evidence-loss fix
   (Stage 3).** The review asks for evidence preservation earlier *and* for a
   safe testing and rollback strategy first. N-2 is the least reversible change
   in the plan, so the safety net must exist before it, not after. Stage 2 also
   carries N-1's tables, so the critical fix lands on a schema ready for them.
2. **CSAE (Stage 4) comes after the evidence fix (Stage 3)** rather than before,
   because its enum value is irreversible and Stage 2's staging project is what
   lets it be rehearsed. Stages 3 and 4 are otherwise independent and could swap
   if you would rather have the category sooner.

Everything else follows the requested sequence.

---

## 14. Risk register

| ID | Risk | L | I | Mitigation | Failure recovery |
| --- | --- | --- | --- | --- | --- |
| **R-1** | N-2's FK change corrupts or orphans reports | Med | **High** | Smallest possible migration, alone; staging rehearsal with four synthetic shapes; `--dry-run`; CP-4 dump | Restore the dump for `member_reports` only; reconcile reports filed since by `created_at`. **Lossy — this is why D-1 matters** |
| **R-2** | Migrations reach production with no staging | **High** | **High** | Stage 2 creates staging and replays the whole history there first | Per-migration rollback in §13; N-4 has none |
| **R-3** | `csae` added in error — irreversible | Low | Med | Own one-line migration, rehearsed on staging first | None. Live with it, as with `incorrect_relationship_status` |
| **R-4** | Redefining `report_and_block_member` reintroduces the whitespace bug | Med | Med | `regexp_replace` moved **verbatim** into the shared helper; the 11 existing checks re-run against both paths | `create or replace` back; the probe catches it before production |
| **R-5** | Widening moderator reach is a real privacy cost | Med | Med | One message by default; context behind a second audited call; connection derived, never supplied | Revoke the context function; the queue is unaffected |
| **R-6** | ~~Deletion refusal conflicts with deletion rights~~ | — | — | **Withdrawn.** AD-4 never refuses deletion | N/A |
| **R-7** | A content-report control is invisible or dead | Med | Med | Visible control on both clients, never gesture-only; device and browser verification is an acceptance criterion | Ship a plainer control; repo checks will not catch this, so the manual walk is the gate |
| **R-8** | Play compliance assumed from implementation | Med | **High** | Stated throughout; §15 closing note | N/A — a documentation discipline |
| **R-9** | Replacing a storage policy breaks ordinary photo deletion | Med | **High** | Probe asserts an **unheld** photo still deletes for every path before the stage is accepted | Restore the prior policy text immediately; it is two statements |
| **R-10** | A held object is deleted anyway through a path not enumerated | Med | **High** | Four paths enumerated and verified; RLS as the layer that holds when a fifth appears; probe covers all four | Irrecoverable for that object. Record it; the descriptor and the report survive |
| **R-11** | A local or staging test misleads because Postgres versions differ | Med | Med | `config.toml` corrected to 17 in Stage 2; staging is a real Supabase project, so it matches production | Re-test on staging |
| **R-12** | `pg_net` or `pg_cron` unavailable on this plan | Med | Low | §9's fallback: `pg_cron` alone at 5 minutes; if neither, the polled queue plus the Stage 7 priority ordering | Documented alternative; no other stage depends on Stage 8 |
| **R-13** | Notification email leaks sensitive content via a future edit | Low | **High** | The function composes from id, category and timestamp only — it never receives a name or description, so there is nothing to leak | Probe asserts payload shape |
| **R-14** | A pre-migration dump becomes an unmanaged copy of evidence | Med | Med | Named in §6.4; dumps stored outside the repository, encrypted, and destroyed on a schedule | Destroy on discovery; record it |
| **R-15** | Retention numbers are guessed rather than advised | Med | **High** | §6.4 is deliberately blank pending L-2 | Do not ship the expiry job until L-2 is answered |

---

## 15. Acceptance criteria

### Overall

1. Every behaviour in §2 behaves identically. All 42 existing probe checks pass,
   unmodified, against production.
2. A report survives the deletion of the reported account, the reporting
   account, and both.
3. A held photo survives all four deletion paths; an unheld photo still deletes
   normally from all of them.
4. Two concurrent identical submissions produce exactly one report row.
5. A legitimate second report of the same person, after the window, succeeds
   **while the first is still unresolved**.
6. A child-safety report is never refused by a rate limit.
7. "Child sexual abuse or exploitation" is offered first, in six languages, with
   emergency guidance and no instruction to attach material.
8. An ordinary member, calling every new RPC by name with a real session, gets
   nothing from any of them.
9. Reading evidence is audited before the data is returned, minimal by default,
   and cannot be pointed at an arbitrary conversation.
10. A child-safety report reaches an allowlisted moderator within seconds, in an
    email containing no name, description or evidence.
11. No image bytes exist in Postgres, in any email, or in any log.
12. No public statement describes a capability that does not exist.
13. No new paid infrastructure.

### Explicitly **not** an acceptance criterion

**Google Play Child Safety Standards compliance.** It is a declaration in Play
Console, assessed by Google against the published page and the app's real
behaviour. This work makes the page true, gives a child-safety report a
prioritised path, and stops evidence vanishing when the subject deletes their
account. The two things most likely to be judged insufficient are facts, not
code: **there is one operator and no moderation team, and there is no automated
CSAM detection.** Both are stated plainly on `/child-safety` **[VERIFIED]**,
which is the right call and should stay.

---

## 16. Remaining decisions requiring approval

| | Decision | Recommendation | Gates |
| --- | --- | --- | --- |
| **D-1** | **Backup and recovery before N-2.** Run `supabase login` then `supabase backups list` and tell me what it reports. If there is no recovery option, choose: accept the CP-4 dump as the only net, or buy PITR. | Verify first, then decide. **Do not let Stage 3 proceed on an unverified backup position.** | Stage 3 |
| **D-2** | **`report.note` wording** (§7.1). | Approve as drafted, or redraft. | Stage 1 |
| **D-3** | **Notification approach** — immediate `pg_net` + `pg_cron` fallback, or `pg_cron` alone at 5 minutes. | Immediate, with the fallback as the documented retreat. | Stage 8 |
| **D-4** | **Should a moderator ever see a reported photo in a browser?** | **No.** Descriptor and legal hold only; viewing is out of band. Keeps a URL to suspected CSAM out of browser history, logs and referrers. | Stage 7 |
| **D-5** | **Create a second free Supabase project as staging?** Needs `supabase login` by you. | Yes. It is free and it is the only real testing option without Docker. | Stage 2 |
| **D-6** | **Install Docker Desktop** for a local stack? | Optional. Staging makes it unnecessary; it would add a faster inner loop. Free for personal use **[EXTERNAL]**. | — |
| **D-7** | **Photos or messages first** if Stage 6 is split? | Messages first — simpler evidence, no storage policy change. Photos are the likelier CSAE vector, so ideally both. | Stage 6 |
| **D-8** | **Proposed ceilings:** duplicate window 10 min; distinct targets/day 15; global/hour 200; deletion deferral max 30 days. | Approve or adjust. All live in `ops_config`, changeable without a deploy. | Stage 5 |
| **D-9** | **Who answers L-1 … L-7?** Indian counsel with IT Rules / POCSO / DPDP experience. L-7 and L-2 first — AD-3 and §6.4 depend on them. | Engage before Stage 9; Stages 1–8 do not depend on the answers except the expiry job (R-15). | Stage 9 |
| **D-10** | **Resend credential** — run `grep -c '^SUPABASE_SMTP_PASS=re_' apps/web/.env.local`. `1` means no new secret is needed. | Check; reuse if possible. | Stage 8 |

---

## Appendix — verification log for this revision

Commands run and files read during this session, for reproducibility. **No
production mutation, no `db push`, no `db dump`, no secret value read.**

| Established | How |
| --- | --- |
| Production Postgres 17.6.1.155 | `supabase/.temp/postgres-version` |
| Linked project `mwixuwmxvppeagyruueu`, region ap-northeast-1 | `supabase/.temp/linked-project.json`, `pooler-url` |
| No Docker, no Deno, no psql; Supabase CLI 2.113.0 | `docker --version`, `deno --version`, `psql --version`, `supabase --version` |
| No Management API token on this machine | `ls -a ~/.supabase` (telemetry only); `SUPABASE_ACCESS_TOKEN` unset |
| `db push --dry-run`, `db dump`, `backups list/restore`, `projects`, `branches` all exist | `supabase --help`, `supabase db push --help`, `supabase db dump --help`, `supabase backups --help` |
| Only `pg_trgm` installed | `grep -rn "create extension" supabase/migrations/` |
| `config.toml` local Postgres = 15 | `supabase/config.toml:[db] major_version` |
| No CI touching the database | `.github/workflows/` contains only `deploy-web.yml` |
| Direct SQL delete on `storage.objects` is refused | `scripts/photo-sweep.mjs`, `apps/web/src/features/account/actions.ts` |
| Storage policies are prefix-based on `auth.uid()` | `supabase/migrations/20260830160200_profile_photos.sql:88-120` |
| Web deletes photos with the **service role** | `apps/web/src/features/account/actions.ts` (`createAdminClient`) |
| Mobile deletes photos with the **user session** | `apps/mobile/src/features/account/delete.ts:34-40` |
| `photos:sweep` skips non-UUID top-level folders | `scripts/photo-sweep.mjs:78,135,208` |
| `member_reports` FKs are `on delete cascade` | `supabase/migrations/20260830100100_create_connection_tables.sql:106-116` |
| `delete_my_account()` has no guard | `supabase/migrations/20260920120300_photos_leave_with_the_account.sql` |
| `report.note` text and location | `packages/i18n/src/locales/en.ts:560` |
| Mobile `Bubble` knows `message.fromMe` | `apps/mobile/app/messages/[id].tsx:510-575` |
| Web `Conversation` maps messages | `apps/web/src/features/members/Conversation.tsx:79-81` |
| `moderation_actions_known` allows three actions | `supabase/migrations/20260911100100_moderation.sql` |
| 42 existing probe checks and their names | `scripts/moderation-probe.mjs` |
| Resend over SMTP, Auth only | `supabase/config.toml:119-126` |
| **Not** established: Resend key format | Attempted; **correctly blocked by the sandbox classifier** for reading a secret. See D-10. |
