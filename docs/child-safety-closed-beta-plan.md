# Child safety reporting — closed beta plan

**Status:** planning only. Nothing implemented, no migration applied, no
production data touched, no policy published, nothing committed or pushed.
**Date:** 2026-11-01
**Branch:** `feature/child-safety-standards`
**Scope:** Google Play **closed testing** with a small, selected group of adult
testers.
**Relates to:** `artifacts/safety-reporting-assessment-2026-11-01.md` (first
assessment) and `docs/child-safety-reporting-revised-proposal.md` (full
proposal). This document **narrows** both. Neither is withdrawn — the deferred
work in §5 remains the post-beta shape.

### Labels used throughout

| Label | Meaning |
| --- | --- |
| **[VERIFIED]** | Read from this repository or the Supabase CLI's cached link metadata. Reproducible. |
| **[RECOMMENDATION]** | A proposed choice, with the alternative and the trade-off stated. |
| **[ASSUMPTION]** | Believed, not verified. Names how to check it. |
| **[PLAY]** | Requires verification against Google Play's current policy text. Play policy is contractual, not statutory, and it changes. |
| **[LEGAL]** | Requires qualified legal advice. **No compliance claim here rests on code inspection.** |

---

## 1. Executive summary

The full proposal was built for a product in open distribution. For closed
testing with a handful of selected adult testers it is roughly three times
larger than it needs to be. This plan cuts it to **seven items**, of which
**four touch code** and **two touch the database**.

The cut is possible because of one finding made while preparing this document:

> **A trigger on `profiles` delete sees the reports before the cascade removes
> them.** `20260920120100_delete_photos_with_profile.sql` established that a row
> trigger on `profiles` *"fires however the row came to be deleted — including
> when it is cascaded from `auth.users`, which is every path"* **[VERIFIED]**.
> So the critical evidence-loss vulnerability can be closed by **archiving the
> report rows in that trigger** — one new table, one function, one trigger, all
> purely additive — instead of altering foreign keys, making columns nullable,
> backfilling, and rewriting the moderation queue's joins.

That single substitution removes the highest-risk migration in the entire plan.
The archive **cannot lose data**: it only ever inserts. Its one failure mode is
breaking account deletion, and that is reversible with a single `drop trigger` —
which is exactly what happened the last time a trigger was added to this table,
and it was backed out in one line one migration later **[VERIFIED:
`20260920120200_photo_trigger_diagnosis.sql`]**.

### What must happen before closed testing

| | Item | Code | DB | Risk |
| --- | --- | --- | --- | --- |
| **A1** | Correct the in-app reporting text that contradicts the published page | Yes | No | Very low |
| **A2** | Add the `csae` reporting category, six locales | Yes | Yes (enum) | Low, **irreversible** |
| **A3** | Prioritise and mark child-safety reports in the queue | Yes | Yes (function only) | Low |
| **A4** | **Archive reports before an account deletion destroys them** | No | Yes (additive + trigger) | Medium, instantly reversible |
| **A5** | Correct the three remaining policy mismatches on `/child-safety` | Yes (page copy) | No | Low — **needs approval** |
| **A6** | Write the internal escalation procedure | Docs | No | None |
| **A7** | Confirm `support@eraya.app` is monitored and reaches the operator | Operational | No | None — **but blocking** |

### What is deferred

Content-level reporting of individual messages and photos; the dedicated
`report_evidence` table; photo legal hold; automated evidence expiry;
conversation-context inspection; `pg_net`/`pg_cron` notifications; global and
per-user rate-limit ceilings; and the foreign-key/tombstone rework. Each is
justified in §5.

### Cost

**₹0.** No new project, no new extension, no new secret, no new edge function,
no paid plan. See §9.

### The one thing this plan does not do

It does not make Eraya's Child Safety Standards declaration *true by itself*.
Three of the seven items are operational or documentary, and two of those
(**A7** and §11's monitoring commitment) depend on you rather than on code. The
readiness criteria in §11 are written so that the declaration is completed on
evidence, not on optimism.

---

## 2. Minimum Google Play closed-testing requirements

**[PLAY — every row in this table needs checking against the current policy
page before the declaration is submitted. This is my understanding, not a
quotation, and Play policy changes.]**

| | Requirement as I understand it | Eraya's position |
| --- | --- | --- |
| **P1** | Published CSAE standards on a publicly accessible, non-editable web page — not a PDF, not an editable document, not behind a sign-in | **Met.** `/child-safety` exists and is live **[VERIFIED: `apps/web/src/app/(marketing)/child-safety/page.tsx`, commit `90dba22`]** |
| **P2** | An **in-app mechanism for users to report CSAE** | **Partly met.** Reporting exists on both clients with `underage` and `safety_threat` categories **[VERIFIED]**, but no category names CSAE. **A2** closes this. |
| **P3** | A published **point of contact** for child safety / CSAE enquiries, reachable by authorities and by people without an account | **Met on the page** — `support@eraya.app` with a `Child safety` subject **[VERIFIED]**. **A7** confirms it is actually monitored. |
| **P4** | Compliance with applicable CSAE law in the operating jurisdiction | **[LEGAL]** Cannot be asserted from code. See §10, L-1. |
| **P5** | Completing the **Child Safety Standards declaration** in Play Console | Blocked on the items above, and possibly on Google's developer identity verification, which was already blocking Console work on Play Billing. **[ASSUMPTION — check whether verification has since cleared.]** |
| **P6** | The app must not facilitate CSAE; prohibited conduct must be stated and enforced | **Met in statement** (the prohibition list on `/child-safety` **[VERIFIED]**) and **met in mechanism** (report → immediate block → suspension → removal). |

**What is *not* on this list, and should not be assumed into it:** automated CSAM
detection, hash matching, a moderation team, a published response time, an
appeals process, or per-message reporting. None appears in my understanding of
the requirement set, and the first assessment's instinct to state their absence
plainly on the page rather than build toward them is the right one for this
phase.

---

## 3. Existing capabilities that already satisfy these requirements

Everything in this section works today and **must keep working unchanged**.
This is the preservation contract for closed beta.

### 3.1 Reporting — works on Android today

| | **[VERIFIED]** |
| --- | --- |
| Entry points | Mobile: a member's profile (`app/member/[id].tsx`) and the conversation (`app/messages/[id].tsx`). Web: `(app)/discovery/[id]` and `(app)/connections/[id]`. Both reached without a long-press and without leaving the screen. |
| Mechanism | `report_and_block_member(uuid, report_reason, text)` — definer, writes the report **and** the block atomically, or neither. |
| Categories | Eight offered, ordered so "the reasons somebody reaches for when frightened come first": `harassment`, `inappropriate_content`, `fake_profile`, `scam`, `spam`, `safety_threat`, `underage`, `other`. Defined once in `packages/i18n/src/report.ts`, so both clients cannot drift. |
| Localisation | All six locales: en, hi, mr, bn, ta, te. |
| Validation | Not signed in → 42501. Self or null target → 22023. Null reason → 22023. `other` with blank details → 22023. Details > 2000 → 22001. All-whitespace details normalised by `regexp_replace`, not `btrim` — the bug fixed in `20260920110300`. |
| Confidentiality | `member_reports` has an **insert-own policy and no select policy for anybody**. The reporter cannot read their own report back; the reported member cannot read reports about them. Both proven by probe. |
| Reported user not notified | No notification path toward them exists. Suspension raises the same `unavailable` a block raises, so moderation is never announced to anyone. |
| Report-and-block | Preserved by A1–A7. Nothing in this plan makes blocking optional, because nothing in this plan adds content reporting. |

**Assessment against P2:** the mechanism, the entry points, the confidentiality
and the queue delivery are all in place. The only gap is that no category says
"child sexual abuse or exploitation" — which **A2** fixes with an enum value and
six strings.

### 3.2 Moderation — works today

| | **[VERIFIED]** |
| --- | --- |
| Queue | `/admin/reports`, reading only through `admin_list_reports(p_filter)`. Filters open / resolved / all. Not linked from anywhere, `robots: { index: false }`. |
| Authorisation | `is_moderator()` compares the verified session `email` claim against `ops_config.moderation_admins` — a service-role-only table no client can read. Re-checked inside every admin RPC, so a page guard is never the boundary. `requireModerator()` answers `notFound()`, never 403. |
| Actions | Dismiss, suspend, restore. Each raises 42501 for a non-moderator rather than failing quietly, and each writes `moderation_actions` attributed from the session. No admin identity is ever a parameter. |
| Suspension | Enforced in the data, not the UI: `discover_members` (both directions), `express_interest`, and the `messages` insert policy. A suspended member keeps their data — moderation that destroys its own evidence cannot be reviewed or corrected. |
| Audit | `moderation_actions`, RLS enabled with **no policies at all**. |
| Proof | `npm run moderation:probe` — 42 checks, run as a **real member session, never the service role**, borrowing the admin allowlist and restoring it in a `finally`. |

**Assessment:** authorised moderators can already review and act. The gaps for
closed beta are that child-safety reports are not **identifiable or prioritised**
(**A3**) and that there is no written **procedure** (**A6**).

### 3.3 Age boundary

18+ enforced by `profiles_date_of_birth_adult` against the `Asia/Kolkata`
calendar date, plus `@eraya/eligibility` in both clients and the database
**[VERIFIED]**. No document-based verification, and `/child-safety` says so
plainly — which is the honest position and should not change.

---

## 4. Critical issues that must be fixed

### 4.1 The evidence-loss vulnerability

**[VERIFIED]** `member_reports.reporter_id` and `reported_id` are
`on delete cascade` to `profiles`; `profiles.id` is `on delete cascade` to
`auth.users`; and `delete_my_account()` has no guard of any kind. So:

```
member taps "Delete my account"
  → delete from auth.users
    → cascade to profiles
      → cascade to member_reports     ← every report about them, gone
      → cascade to messages, photos, interests, connections, blocks
```

Every route has this effect, not just the in-app one: the Supabase dashboard,
the admin API, `npm run demo:remove`, and the probes **[VERIFIED: the same list
is enumerated in `20260920120100`]**.

A second, quieter aspect found while writing this: **`admin_list_reports` joins
`profiles` twice with INNER JOINs** **[VERIFIED: lines 172–173]**. So a report
whose *reporter* deleted their account also vanishes from the queue, even though
the row itself would survive a foreign-key change. Any fix that works only on
the FK would have to correct these joins too.

**Why this cannot wait for open release.** Closed beta is when a reported tester
is most likely to delete their account — they are a small, engaged group being
asked for feedback, and deleting the account is one of the things they will try.
And the loss is silent: nothing reports it, and the free plan's recovery
position is unverified.

### 4.2 The fix — archive on delete [RECOMMENDATION]

Three additive objects. **Nothing existing is altered.**

```sql
-- 1. An append-only archive. Deliberately no foreign keys, no NOT NULLs
--    beyond the identity, and no unique constraint that could raise:
--    a trigger on this path that raises breaks account deletion.
create table public.member_reports_archive (
  id uuid primary key,              -- the original report id
  reporter_id uuid,                 -- plain uuid, no FK: the account is going
  reported_id uuid,
  reason_code text,                 -- text, not the enum: an archive must read
  description text,                 --   correctly even if the type changes
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  archived_at timestamptz not null default now(),
  archived_because uuid             -- whose deletion caused this
);
alter table public.member_reports_archive enable row level security;
-- No policies. Unreachable by any client, like moderation_actions.

-- 2. The trigger function: copy, then let the cascade proceed.
--    before delete, so member_reports is still populated.

-- 3. before delete on public.profiles for each row.
```

The trigger copies every report where the departing profile is **either** the
reported member **or** the reporter, with `on conflict (id) do nothing`.

**Why this is the smallest safe correction:**

| | Archive trigger (recommended) | FK → `set null` + tombstone (full proposal) |
| --- | --- | --- |
| Alters an existing table | No | Yes — two FKs, two columns made nullable, two columns added |
| Backfill of existing rows | No | Yes |
| Changes `admin_list_reports` | No | Yes — and its INNER JOINs must become LEFT JOINs |
| Changes account-deletion semantics | Adds a step; deletion still completes | Same |
| Can lose data if it goes wrong | **No. It only inserts.** | Yes — rows already null-ed are unrecoverable |
| Rollback | `drop trigger` — one statement | A migration, and lossy for affected rows |
| Needs a restoration-tested backup | **No** (nothing is mutated) | **Yes** |

**The known risk, stated honestly.** `20260920120100` added a trigger to this
exact table and *"broke deleting an account outright: the admin API started
answering 'Database error deleting user' with a 500, because the trigger raises
inside the cascade and takes the whole transaction with it"* **[VERIFIED]**. The
cause was specific — Supabase forbids `delete from storage.objects` from SQL
whatever the role — and does not apply to an insert into an ordinary table in the
same schema. But the precedent is why:

- the archive table carries **no constraint that can fail** (no FKs, no unique
  beyond the primary key, which is handled by `on conflict do nothing`);
- the function is `security definer` with a pinned `search_path`, matching every
  other definer function here;
- **and validation (§7) requires proving a real account deletion still succeeds
  on both clients before this is considered done.** This is the check whose
  absence caused the earlier incident to reach production.

**Should the trigger swallow exceptions?** **[RECOMMENDATION: no.]** An
`exception when others then return old` handler would guarantee deletion never
breaks, at the cost of silently losing the evidence this exists to preserve —
the same failure shape as the analytics pipeline that *"shipped that way once and
measured nothing"* **[VERIFIED: `docs/11`]**. Given the table is designed so it
cannot raise, and given the rollback is one statement, a loud failure is the
better trade. **This is a decision for you (D-3).**

### 4.3 Report metadata versus message and photo evidence

The brief asks for this distinction explicitly, and it is the heart of the
simplification.

| | Preserved by A4 | Not preserved by A4 |
| --- | --- | --- |
| **Report metadata** — who reported whom, the category, **the reporter's own description in their own words**, timestamps, review state and who reviewed it | **Yes** | — |
| **Message evidence** — the text of the messages complained about | — | No. Cascades away with the account. |
| **Photo evidence** — the image itself | — | No. Removed by the `profiles_delete_photos` trigger and by both clients' deletion paths. |

**This is the right scope for closed beta, and not only for effort reasons.**
The reporter's description is the part that *"actually says what happened"*
**[VERIFIED: the reasoning in `20260830160300`]**, and it is written by the one
person in the exchange who is not the subject of the complaint. Preserving it,
with the category and the timeline, keeps a report actionable and a pattern
visible.

Retaining the *material* is a different act with a different risk. Holding a
suspected-CSAM object means Eraya knowingly retains it, and **that must not be
built before a legally reviewed procedure exists** — the brief says so, and I
agree. Photo legal hold is therefore deferred to §5 and gated on **L-2**, not
merely postponed for convenience.

### 4.4 The remaining policy mismatches

`/child-safety` is accurate and unusually honest about what does not exist. Four
statements run ahead of the code. **A1** fixes one by changing the app; the other
three are resolved below, two of them with no code at all.

| | Mismatch **[VERIFIED]** | Closed-beta resolution |
| --- | --- | --- |
| **M1** | `report.note` tells every reporter *"Eraya is small and has no moderation team yet, so we cannot promise anyone will write back"*, and both client components carry comments asserting *"There is no moderation team and no queue."* The queue has existed since `20260911100100`; the page says reports "are reviewed by hand, by the operator". The app copy predates the queue. | **A1 — change the app.** The page is right. |
| **M2** | Page: *"Where the finding warrants it, the account is removed permanently."* No admin removal action exists; `moderation_actions_known` allows only `dismissed`/`suspended`/`restored`. | **A6 — document the manual procedure.** The operator *can* remove an account from the Supabase dashboard with the service role, so the statement is operationally true. **A4 is what makes it safe** — before A4, removing a reported account destroys the reports that justified it. An `admin_remove_member` button is a convenience, not a requirement: deferred to §5. |
| **M3** | Page: review *"may mean reading the profile and the messages connected to it."* No admin path reads messages. | **A5 — narrow the page.** The operator can read messages with direct database access, which is how a one-person operation works, but the page implies a reviewing *capability* in the product. Proposed: *"Reviewing a report may mean reading the profile of the member reported, and the conversation it concerns, using direct access to our database. Only the operator can do this."* Honest, and needs no code. |
| **M4** | Page: *"A child safety report is the highest priority thing in the queue."* The queue orders by open-ness then `created_at desc`. | **A3 — change the code.** Prioritisation is a `create or replace` on one function plus a marker in the UI. Cheap, and the claim is one worth making true rather than removing. |

One addition rather than a correction: once `csae` exists, the page's step 3
should name it instead of routing people to "Under 18" or "Threats or safety
concern". Proposed in A5.

### 4.5 A contact mismatch found while writing this

**[VERIFIED]** `/child-safety` publishes `support@eraya.app` as *"the designated
contact for child safety and CSAE matters, including from people who do not have
an Eraya account"*. The moderator allowlist in `ops_config` is
`["tech@eraya.app", "rahul@eraya.app"]`.

These are different addresses. Nothing in the repository shows whether
`support@` is a mailbox somebody reads, an alias forwarding to one of the other
two, or neither. **If `support@eraya.app` is not monitored, the single most
reviewer-visible promise on the page is false**, and no amount of code fixes it.
Hence **A7**, which is operational, takes five minutes, and **blocks the
declaration**.

---

## 5. Features that can be deferred

Each row states why deferring does **not** leave the published policy inaccurate
or a critical vulnerability open — the test the brief sets.

| | Deferred | Why it is safe to defer |
| --- | --- | --- |
| **C1** | **Message and photo reporting** | **Assessed, and genuinely deferrable.** My reading of P2 is that Play requires an in-app mechanism to report CSAE, not a mechanism anchored to each individual artefact **[PLAY — confirm]**. A member can already report the person and describe the message or photograph in up to 2000 characters, which is what a one-person review actually works from. It adds a flow, a new RPC, storage policy changes and device verification on two clients — the largest single item in the full proposal — for no change to what a reporter can tell us. **The page makes no claim about per-item reporting** **[VERIFIED]**, so deferring leaves nothing untrue. |
| **C2** | **`report_evidence` table** | Only earns its place alongside C1, since member-level reports have no content reference to describe. The reporter's description is preserved by A4. |
| **C3** | **Photo legal hold** (RLS hold + prefix move) | Not merely deferred — **should not be built until L-2 is answered**. It deliberately retains suspected illegal material, and the brief rightly forbids automatic retention without a legally reviewed procedure. |
| **C4** | **Automated evidence expiry** | Nothing is retained that needs expiring. Deferring C2 and C3 removes the need entirely. Building a retention job before L-2 would mean inventing a retention period, which §6.4 of the full proposal deliberately refused to do. |
| **C5** | **Conversation-context inspection** (`admin_report_context`) | A5 narrows the page so nothing claims it. The operator can read a conversation with direct database access; a product feature for it widens what a moderator can browse, which the existing design excluded on purpose (*"privilege to moderate is not privilege to browse"* **[VERIFIED]**). |
| **C6** | **`pg_net` / `pg_cron` notifications** | See §6. A monitored queue plus a documented check cadence is sufficient for a handful of testers, and the page publishes no response time **[VERIFIED]**, so nothing is promised that polling cannot deliver. Avoids two extensions, an edge function and a secret. |
| **C7** | **Global and per-user rate-limit ceilings** | See §7. Mass-reporting by selected, known testers is not a concrete threat; the concurrency fix that *is* worth doing is kept as B1. |
| **C8** | **FK → `set null` + tombstone, and the LEFT JOIN correction** | The proper long-term shape, and still recommended post-beta — an archived report is preserved but no longer in the live queue. A4 preserves the data, which is the critical part; C8 improves where it is *read*. Deferring trades reviewing convenience for removing the plan's only high-risk migration. |
| **C9** | **Admin UI for archived reports** | A4 includes a minimal moderator read function (§8, A4). A screen for it can wait: the archive matters when a subject has already left, which is not the common case. |
| **C10** | **`admin_remove_member`, `admin_begin_review`, moderator notes, evidence-access audit values** | Convenience and record quality. M2 is resolved operationally by A6; the `reviewing` status being unused is cosmetic with one moderator. |
| **C11** | **Web blocked-members list; reporting an already-blocked member (G3)** | Neither is a child-safety capability and neither is claimed anywhere. |

---

## 6. Notifications — nothing automated for closed beta

**[RECOMMENDATION]** Ship **no** notification infrastructure. Rely on:

1. **The moderation queue** at `/admin/reports`, with child-safety reports
   sorted to the top and visibly marked (**A3**).
2. **A documented manual check cadence** in `docs/17` (**A6**) — an internal
   commitment, not a published one.
3. **`support@eraya.app`**, confirmed monitored (**A7**).

**Why this is sufficient here, and not a shortcut.** Closed testing is a small,
selected, known group of adults. The realistic number of child-safety reports is
zero; the design still has to handle one correctly, and a prioritised queue
checked on a documented cadence does. Crucially, **`/child-safety` publishes no
response time** and says so deliberately — *"we do not publish a response time,
because committing to one we are not staffed to meet would be worse than saying
nothing"* **[VERIFIED]**. So polling promises nothing that polling cannot keep.

The full proposal's `pg_net` trigger plus `pg_cron` sweep plus delivery ledger
plus edge function plus `RESEND_API_KEY` would add two extensions, a secret and
an un-type-checkable function (no Deno on this machine **[VERIFIED]**) to shave
a latency that has no operational process behind it. That is complexity bought
with no benefit, and the brief is right to push back on it.

**What would change this:** moving to open testing or production, or any
published response commitment. At that point the full proposal's §9 is the
design, and the fallback there (`pg_cron` alone at five minutes) remains the
cheapest honest option.

**Do not promise what polling cannot deliver.** A6 must not introduce a
response-time claim into any public text. The internal cadence is for the
operator, and the page stays as it is on this point.

---

## 7. Rate limiting and duplicate prevention — the minimum

**[RECOMMENDATION]** Implement **concurrency-safe duplicate prevention only**
(item **B1**, Category B, not required before closed beta). Defer every ceiling.

What B1 is:

```
1. pg_advisory_xact_lock( hashtextextended(reporter || ':' || target, 0) )
2. refuse if an identical (reporter, target, reason) exists within
     ops_config 'report_duplicate_window_minutes'   -- proposed 10
3. insert the report and the block, exactly as today
```

Against the brief's requirements:

| Requirement | How B1 meets it |
| --- | --- |
| Server-side | Inside `report_and_block_member`. The clients' existing `pending` guards stay as a courtesy, never the boundary. |
| Concurrency-safe | Step 1 is the whole point. Without the lock, two simultaneous submissions both see a count of zero and both insert — no count-based check can fix that. The lock is **transaction-scoped**, so it releases on commit *and* on rollback, and is keyed on `(reporter, target)` so it never serialises unrelated reporters. |
| Never permanently blocks a new incident | A **time window**, not a status check. This is the defect in the first assessment's partial unique index, which would have refused a second report for as long as the first stayed unresolved — days, with one moderator. Ten minutes later, a genuinely new incident files normally. |
| Preserves atomic report-and-block | Both checks precede both inserts, in one transaction. A refusal commits nothing. |
| Preserves legitimate child-safety reporting | There are no ceilings to exempt anything from. The lock and the window only ever stop an exact double-submit within ten minutes, which no real child-safety report is. |
| Rejection behaviour tested | §8 B1 validation. |

**Why the ceilings are deferred (C7).** A per-user distinct-target cap and a
global hourly cap defend against scripted mass-reporting aimed at inflating
`reports_against_reported`, which the queue renders in bold as a trust signal
**[VERIFIED]**. That is a real attack on a public product with open signup. In
closed testing the reporters are a known list of selected adults, and the
operator reads every report by hand. Adding two ceilings means two numbers to
tune, two refusal paths to translate, and a new way to accidentally suppress a
real report. **No concrete security reason exists at this scale**, which is the
bar the brief sets.

**Why B1 is Category B and not A.** No Play requirement concerns duplicate
reports, and nothing on `/child-safety` claims they are prevented. It is cheap
and worth doing, but it should not gate the declaration — and it carries the one
risk in this plan that A2–A4 avoid: it redefines the most-exercised function in
the system, which is where the `btrim` whitespace regression lived.

---

## 8. Revised implementation stages

Eight stages. Each is independently reviewable, independently deployable, and
leaves the system coherent. **Low-risk policy and UI first, backend after.**

Legend — **Mandatory**: required before closed testing. **Checkpoint**: the
approval gate before anything leaves this machine.

---

### Stage 1 — A1: correct the in-app reporting text

| | |
| --- | --- |
| **Objective** | Stop the app telling every reporter nothing will be read, when a queue exists and the published page says reports are read by hand. Closes M1. |
| **Components** | `packages/i18n/src/locales/{en,hi,mr,bn,ta,te}.ts` — `report.note`. Comment corrections in `apps/web/src/features/members/MemberSafety.tsx` and `apps/mobile/src/features/connections/SafetyActions.tsx`. |
| **Database** | **None.** |
| **Mandatory** | **Yes.** It is the mismatch a reviewer is most likely to hit — they read the page, then use the app. |
| **Risk** | **Very low.** Copy only. |
| **Dependencies** | Approval of wording (D-1). |
| **Validation** | `npm run i18n:check`; `npm run locale:probe` (≥ 565/580, no new overflow); `npm run typecheck`; `npm run lint`; `npm run build`; `npx expo export --platform android`; read the flow in a browser and on a device. |
| **Checkpoint** | Wording approved before the edit. No database approval needed. |
| **Rollback** | `git revert`. No state. |

Proposed English **[RECOMMENDATION, needs approval as D-1]**:

> *"Reports are read by hand. We are small, so we cannot promise a reply or say
> how long it will take. The block does not wait for us — it takes effect
> immediately."*

True in all three clauses, consistent with `/child-safety`, and still obeying
`docs/11`'s rule that copy *"must not imply review that is faster or more certain
than"* a founder reading reports by hand with no SLA.

---

### Stage 2 — A3: prioritise and mark child-safety reports

| | |
| --- | --- |
| **Objective** | Make M4 true: a child-safety report is actually the first thing in the queue, and visibly marked. |
| **Components** | A migration redefining `admin_list_reports` (adds an `is_child_safety` column to the returned row, and orders child-safety first, then open, then `created_at desc`); `apps/web/src/features/admin/data.ts`; `apps/web/src/app/admin/reports/page.tsx`. |
| **Database** | `create or replace function` **only**. No table, no column, no constraint, no data touched. Returns a **wider row type**, so the function is dropped and recreated — the existing signature `(text)` is kept, so no caller changes. |
| **Mandatory** | **Yes** — unless you prefer to remove the claim from the page instead, which I do not recommend: prioritisation is cheap and worth having. |
| **Risk** | **Low.** One function, no state. The one real hazard is `drop function` + `create` leaving the queue broken between statements — mitigated by both being in one migration, hence one transaction. |
| **Dependencies** | Stage 3 (A2) if the marker is to recognise `csae`. **Ordering note:** this stage can ship first recognising only `underage`, then widen; or ship after Stage 3 recognising both. **[RECOMMENDATION: ship after Stage 3]**, so the marker is right the first time. |
| **Validation** | `npm run moderation:probe` — the existing "an admin sees the queue" and "a member listing reports receives none" checks must still pass unchanged, plus a new check that a `csae`/`underage` report sorts first. `npm run typecheck`, `build`. Open the queue as a moderator and as a non-moderator (expect 404). |
| **Checkpoint** | **Migration approval required.** Reversible, no data affected — but it is still a production migration, so §9's pre-flight applies. |
| **Rollback** | `create or replace` back to the `20260911100100` definition, which is in version control verbatim. |

---

### Stage 3 — A2: the CSAE reporting category

| | |
| --- | --- |
| **Objective** | A member can name child sexual abuse or exploitation directly. Closes P2. |
| **Components** | A migration containing **one statement**: `alter type public.report_reason add value if not exists 'csae'`. Then `packages/i18n/src/report.ts` (`csae` first in `REPORT_REASONS`; a `CSAE_REASONS` export so "is this a child-safety report" is named once); six locale files (`report.reasons.csae`, and a new `report.csaeNotice`); `apps/web/src/features/admin/data.ts` (`reasonLabels`). |
| **Database** | The enum value, alone. **Nothing else in this migration.** |
| **Mandatory** | **Yes.** |
| **Risk** | **Low to apply, IRREVERSIBLE once applied.** |
| **Dependencies** | None technical. Copy approval (D-2). |
| **Validation** | `npm run i18n:check`; `npm run locale:probe` with **specific attention to Tamil and Telugu**, which carry known baseline overflow and will be worst hit by a long string; `typecheck`; `build`; `expo export`; probe: a `csae` report files and reads back in the queue correctly labelled; **and the existing 11 validation checks still pass**, whitespace included. Device and browser walk. |
| **Checkpoint** | **Migration approval required, and this one is irreversible** — see §9's step 7. |
| **Rollback** | **None.** Postgres offers no way to remove an enum value; doing so would mean a replacement type, rewriting every dependent column, function signature and index, and deciding what happens to reports already filed under it. This is why `incorrect_relationship_status` is still in the enum today **[VERIFIED]**. The migration is one line specifically so this irreversible act is bundled with nothing that might need undoing. |

Placement: **first in the list.** `packages/i18n/src/report.ts` states that order
is *"a product decision, not an alphabet"* and that *"the reasons somebody
reaches for when frightened come first"* **[VERIFIED]** — which puts CSAE at the
top. Both clients map over the array, so neither needs a change to show it
prominently.

`report.csaeNotice`, rendered only when `csae` or `underage` is selected
**[RECOMMENDATION, D-2]**: if a child is in immediate danger contact the police
first (112, or 1098 for Childline), and **do not attach, forward or re-share
suspected material**. This mirrors `/child-safety` exactly, so the two cannot
drift, and it is the one piece of in-flow guidance that changes behaviour.

---

### Stage 4 — A4: archive reports before deletion destroys them

| | |
| --- | --- |
| **Objective** | A report survives the deletion of either account, by any route. Closes the critical vulnerability. |
| **Components** | One migration: `public.member_reports_archive` (table, RLS on, no policies); `public.archive_member_reports()` (definer, pinned `search_path`, revoked from `public, anon, authenticated`); `before delete on public.profiles for each row`; and a minimal `public.admin_list_archived_reports()` guarded by `is_moderator()` so preserved evidence is readable through the same boundary as everything else. `scripts/moderation-probe.mjs` extended. **No application file changes.** |
| **Database** | Additive: one new table, two new functions, one new trigger. **No existing table, column, constraint, policy or function is altered.** |
| **Mandatory** | **Yes.** |
| **Risk** | **Medium** — the highest in this plan, and the reason is precedent, not data. See below. |
| **Dependencies** | None. Independent of Stages 1–3. **[RECOMMENDATION: ship it after them anyway]**, so the two zero-risk and one irreversible-but-trivial stages are already settled and this one gets undivided attention. |
| **Validation** | **The decisive check is that account deletion still works.** On both clients, end to end, with a throwaway account — the check whose absence let `20260920120100` reach production and break deletion with a 500. Then probe: a reported member deletes their account and the report is in the archive with its category, description and timestamps intact; the same when the *reporter* deletes; both parties deleted; a member cannot read the archive table or call the archive-listing function; a moderator can. Plus all 42 existing checks. |
| **Checkpoint** | **Explicit migration approval required.** It affects the account-deletion path, which §1 of the brief names specifically. §9 applies in full. |
| **Rollback** | `drop trigger profiles_delete_photos`-style: **one statement**, `drop trigger member_reports_archive_on_profile_delete on public.profiles;`. Precedent exists — `20260920120200` backed out exactly this kind of trigger in one line. The table and functions can stay, inert. |

**Why the risk is medium despite being additive.** Adding a trigger to
`profiles` delete has broken account deletion on this project before
**[VERIFIED]**. The cause was a forbidden storage delete and does not recur here,
but the blast radius is the same: if the trigger raises, **every** account
deletion fails with a 500, on both clients, for everybody. Mitigations are
designed in — an archive table with no constraint that can fail, `on conflict do
nothing`, no access to storage, no external dependency — and the validation
above is written so the failure cannot reach production unnoticed.

**Why it needs no restoration-tested backup, unlike the deferred C8.** This
migration **only ever inserts**. No existing row is modified or removed, so there
is no state to restore. The recovery procedure is `drop trigger`, which restores
the previous behaviour exactly — including, regrettably, the vulnerability. That
is the correct trade: a reversible fix that might need backing out beats an
irreversible one that cannot.

---

### Stage 5 — A5 + A6: policy corrections and the written procedure

| | |
| --- | --- |
| **Objective** | Every public statement describes a capability that exists; the escalation process is written down. Closes M2, M3 and the reporting-steps wording. |
| **Components** | **Proposed** edits to `apps/web/src/app/(marketing)/child-safety/page.tsx` (M3 narrowing; step 3 naming the CSAE category; nothing else). New `docs/17-child-safety.md` — internal: triage, suspend-first, the **manual account-removal procedure via the Supabase dashboard** (which resolves M2), how to read a conversation with direct access and how to record that it was read, the check cadence, and the reporting-obligation questions marked as open. `docs/11-moderation-and-analytics.md` updated with the priority rule. |
| **Database** | **None.** |
| **Mandatory** | **Yes**, and it must come **after** Stages 2–4, because the page may only describe what is deployed. |
| **Risk** | **Low technically, high reputationally.** A page that overclaims is worse than one that underclaims. |
| **Dependencies** | Stages 2, 3, 4 deployed and verified. L-1 and L-3 inform `docs/17` but do not block the internal draft. |
| **Validation** | Re-walk every statement on `/child-safety` against deployed behaviour, as the first assessment did, and record the result. |
| **Checkpoint** | **Your explicit approval of every word of public copy before it is published.** Nothing on `/child-safety`, `/privacy` or `/delete-account` changes without it. |
| **Rollback** | `git revert`. |

---

### Stage 6 — A7: confirm the published contact is monitored

| | |
| --- | --- |
| **Objective** | `support@eraya.app` actually reaches the operator. |
| **Components** | **None in the repository.** Mail routing, and a note of the outcome in `docs/17`. |
| **Database** | None. |
| **Mandatory** | **Yes, and it blocks the declaration.** The page names this address as the designated child-safety contact, including for authorities and for people without an account **[VERIFIED]**. |
| **Risk** | None to implement. **High if skipped** — an unmonitored published contact is the most reviewer-visible false statement available. |
| **Dependencies** | You. The allowlist is `tech@eraya.app` and `rahul@eraya.app`; `support@` appears nowhere in it **[VERIFIED]**. |
| **Validation** | Send a test message to `support@eraya.app` from an unrelated address and confirm it arrives where the operator reads mail. Consider whether `support@` should also be added to `moderation_admins` — a one-row `ops_config` update, no deploy **[VERIFIED: that is the documented way]**. |
| **Checkpoint** | Report the result before the declaration is submitted. |
| **Rollback** | N/A. |

---

### Stage 7 — B1: concurrency-safe duplicate prevention *(not mandatory)*

| | |
| --- | --- |
| **Objective** | Two simultaneous submissions produce one report. |
| **Components** | A migration redefining `report_and_block_member`, carrying the `regexp_replace` normalisation **verbatim**; `report_duplicate_window_minutes` in `ops_config`; a refusal mapped to copy in `apps/web/src/features/members/report.ts` and `apps/mobile/src/features/members/data.ts`. |
| **Database** | One `create or replace`, one `ops_config` insert. |
| **Mandatory** | **No.** Category B. |
| **Risk** | **Medium** — it redefines the most-exercised function in the system, where the whitespace regression lived. |
| **Dependencies** | Stage 3, if the window is to treat `csae` distinctly (it need not). |
| **Validation** | **Concurrency: fire two identical submissions without awaiting the first; exactly one row.** Window: inside refused, outside allowed **while the first is still unresolved** — the specific defect being avoided. Atomicity: a refusal writes neither a report nor a block. All 11 existing validation checks, whitespace included. |
| **Checkpoint** | Migration approval. |
| **Rollback** | `create or replace` back to the `20260920110300` definition, verbatim in version control. The window is removable from `ops_config` with no deploy, so a value set wrongly is relieved in seconds. |

---

### Stage 8 — final verification before the declaration

| | |
| --- | --- |
| **Objective** | One consolidated evidence pass, and the §11 readiness check. |
| **Components** | `npm run moderation:probe`, `npm run security`, `npm run locale:probe`, `npm run age:check`; a written record in `artifacts/`. |
| **Database** | None. |
| **Mandatory** | **Yes.** |
| **Risk** | None — but note the probes write to production (throwaway accounts, created and destroyed), so running them is itself a production write and needs your go-ahead. |
| **Dependencies** | Stages 1–6. |
| **Validation** | All probes green, or green-by-design with the deviation explained — `npm run security` is **63/72 by design** **[VERIFIED: only the five `@seed.*` profiles are onboarded]**. A device walk of the reporting flow on Android. A line-by-line re-read of `/child-safety`. |
| **Checkpoint** | §11's criteria met and recorded, **then** the Play Console declaration. |
| **Rollback** | N/A. |

---

## 9. Database safety plan without mandatory staging

Three migrations are proposed: **Stage 2** (function redefinition), **Stage 3**
(one enum value), **Stage 4** (additive table, functions, trigger). Stage 7 is
optional. The brief's nine steps, answered for each.

### The nine steps

| | Step | Stage 2 | Stage 3 | Stage 4 |
| --- | --- | --- | --- | --- |
| 1 | **Inspect the exact changes** | `drop`+`create` one function | One `alter type … add value` | One table, two functions, one trigger |
| 2 | **Confirm PostgreSQL compatibility** | Fine on any supported version | `add value if not exists` needs PG 9.6+ | `before delete` row trigger, plain DML — fine | 
| 3 | **Usable backup?** | Not needed — no state | Not needed — no state is mutated | **Not needed — insert-only.** See below |
| 4 | **How is affected data recovered?** | Nothing affected | Nothing affected | Nothing affected |
| 5 | **Non-destructive validation available** | Probe against production after; `typecheck`; `build` | `i18n:check`; `locale:probe`; probe after | `node --check` on the probe; static SQL review; **a real deletion test on a throwaway account** |
| 6 | **`supabase db push --dry-run`** | Yes **[VERIFIED: the flag exists]** | Yes | Yes |
| 7 | **Irreversible operations** | None | **`alter type … add value` — IRREVERSIBLE** | None |
| 8 | **Explicit approval** | Required | Required, flagged as irreversible | **Required, flagged as touching account deletion** |
| 9 | **Verify immediately afterward** | Open the queue as moderator and non-moderator; probe | File a `csae` report; read the queue; probe | **Delete a throwaway account on both clients; confirm the archive row; probe** |

**Production is Postgres 17.6.1.155** **[VERIFIED: `supabase/.temp/postgres-version`,
the CLI's cached record of the linked project]**. Every construct above is
comfortably supported. Note separately that `supabase/config.toml` declares
`[db] major_version = 15` for the *local* stack **[VERIFIED]** — a two-major
disagreement that matters only if a local stack is ever used, and is worth
correcting opportunistically.

### Why no staging project is needed for these three

Not because the brief permits it, but because **none of the three mutates
existing data**:

- Stage 2 replaces a function body. No rows.
- Stage 3 adds an enum label. No rows change; existing reports keep their values.
- Stage 4 **only inserts**, into a table that did not previously exist.

Step 3 of the brief's list — "check whether a usable backup exists" — therefore
has an honest answer: **no backup is required to make these three safe, because
there is no prior state any of them can damage.** That is a stronger guarantee
than a backup would give.

**And it is exactly the guarantee the deferred C8 cannot offer.** Altering the
foreign keys, making columns nullable and backfilling *does* mutate existing
rows, and rows already null-ed by a real deletion are unrecoverable. So:

> **[RECOMMENDATION]** If C8 is ever revived, it should not proceed without
> isolated testing. That is the one migration in either proposal that genuinely
> needs a staging project, and the brief's own condition — *"unless a specific
> migration cannot be validated safely otherwise"* — is met by it and by nothing
> else here.

### On backups, stated plainly

**[VERIFIED]** There is **no credential on this machine that can reach the
production database directly**: `~/.supabase` holds only `telemetry.json`,
`SUPABASE_ACCESS_TOKEN` is unset, there is no `psql`, and the database password
is not in `apps/web/.env.local`. So:

- `supabase backups list` — which would establish whether the plan offers any
  recovery at all — **requires `supabase login` by you**.
- `supabase db dump --linked -f …` — **requires the database password from you**.
- **A SQL dump is not a verified backup.** The brief is right, and I will not
  describe one as a safety net: restoration has never been tested here, and
  testing it needs a second database, which is the thing we are not creating.
  A dump is a *copy*, and a copy of unknown restorability.

None of this blocks Stages 2–4, precisely because none of them needs a backup.
It would block C8, and that is the clearest signal available that deferring C8
is the right call for closed beta.

One consequence worth recording: **a `member_reports` dump contains reporters'
descriptions in their own words.** Any such file is sensitive, belongs outside
the repository, and should be destroyed when it has served its purpose.

### What I will not do during planning

No `db push`, no `db push --dry-run` against production, no `db dump`, no probe
run, no `ops_config` update, no `supabase login`. Every command in this section
is a proposal for a later, approved step. **[VERIFIED: nothing in this session
has mutated production; the only Supabase CLI calls made were `--help` and
reading the local `.temp` cache.]**

---

## 10. Cost assessment

### Mandatory costs

**None. ₹0.**

| Item | Cost | Uses |
| --- | --- | --- |
| Stages 1–8 | **₹0** | The existing Supabase project; the existing `admin_list_reports` queue; the existing `is_moderator()` boundary; the existing `moderation_actions` audit; the existing `ops_config` pattern; the existing `moderation-probe` harness; the existing design-system components in both clients; the existing `@eraya/i18n` package |
| New dependencies in either client | **₹0** | None added |
| New database extensions | **₹0** | None added — `pg_trgm` remains the only one **[VERIFIED]** |
| New secrets | **₹0** | None added |
| New edge functions | **₹0** | None added |
| Resend | **₹0** | Unchanged. Still Auth email over SMTP only **[VERIFIED]**. C6 would have needed an API key; deferring it means the existing configuration is untouched. |

### Optional costs, for information only — none recommended now

| Item | Cost | When it would matter |
| --- | --- | --- |
| Second free Supabase project (staging) | **₹0** | Only if C8 is revived. Free tier; needs `supabase login`. |
| Supabase Branching | **PAID** — Pro plan plus per-branch-hour **[PLAY/EXTERNAL]** | Never, for this phase. Recorded as considered and rejected. |
| PITR add-on | **PAID** | Only if a data-mutating migration (C8) is approved. Not needed for Stages 2–4. |
| Docker Desktop | ₹0 for personal use **[EXTERNAL for commercial thresholds]** | A faster inner loop. Unnecessary given Stages 2–4 need no local database. |

**Nothing is to be purchased or provisioned.** Both items that touch a
third-party account — `supabase login` (Stage 6's optional allowlist update, and
any future backup listing) and the mail routing check in Stage 6 — are actions
for you, and neither costs anything.

---

## 11. Remaining risks, decisions, and readiness criteria

### 11.1 Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| **R-1** | **Stage 4's trigger breaks account deletion**, as a trigger on this table did once before **[VERIFIED]** | Low–Med | **High** — a 500 on every deletion, both clients | Archive table with no constraint that can fail; `on conflict do nothing`; no storage access; **a real deletion test on both clients is an acceptance criterion**; rollback is one `drop trigger` |
| **R-2** | **Stage 3's enum value is wrong and cannot be removed** | Low | Med | One-line migration, alone; the name `csae` matches the policy page's own vocabulary; live with it as with `incorrect_relationship_status` |
| **R-3** | **An archived report is preserved but no longer in the live queue** — the known limitation of choosing A4 over C8 | High (by design) | Low–Med | `admin_list_archived_reports()` ships with Stage 4; the archive matters only when the subject has already left; C8 remains the post-beta fix |
| **R-4** | **Message and photo evidence is still lost on deletion** | High (by design) | Med | Accepted for closed beta. The reporter's own description survives. C3 is gated on **L-2**, so building it sooner would be wrong, not merely costly |
| **R-5** | **Tamil or Telugu overflow** from a long CSAE label | Med | Low | `locale:probe` is a Stage 3 gate; those two locales carry known baseline overflow |
| **R-6** | **`support@eraya.app` is not monitored** | **Unknown — this is the point** | **High** | Stage 6 blocks the declaration until confirmed |
| **R-7** | **Stage 7 reintroduces the `btrim` whitespace regression** | Med | Med | `regexp_replace` carried verbatim; the 11 existing checks re-run; and Stage 7 is optional, so it can simply not ship |
| **R-8** | **The declaration is submitted on the strength of this plan** rather than on verified behaviour | Med | **High** | §11.3's criteria, and §11.2's L-items |
| **R-9** | **Probes write to production**, so "verify afterwards" is itself a production write | High | Low | Throwaway `@demo.eraya.invalid` accounts, allowlist restored in a `finally` **[VERIFIED]**; run with your go-ahead, not routinely |

**High-risk database changes remaining: one — Stage 4**, and its risk is
availability (deletion breaking), not data loss. Stages 2 and 3 are low risk.
The genuinely dangerous migration from the full proposal (C8) is **out of scope**.

### 11.2 Decisions needed

| | Decision | Recommendation |
| --- | --- | --- |
| **D-1** | `report.note` wording (Stage 1) | Approve as drafted in Stage 1 |
| **D-2** | The `csae` label and `report.csaeNotice` wording (Stage 3) | Approve as drafted |
| **D-3** | **Should Stage 4's trigger swallow exceptions?** Not swallowing risks breaking deletion loudly; swallowing risks losing evidence silently | **Do not swallow.** The table is designed so it cannot raise, and a loud failure is recoverable in one statement |
| **D-4** | Ship Stage 7 (duplicate prevention) before closed beta, or defer? | **Defer.** Not a Play requirement, not claimed anywhere, and it is the only stage that touches the most-exercised function |
| **D-5** | Add `support@eraya.app` to `moderation_admins`? | Decide after Stage 6's routing check. One `ops_config` row, no deploy |
| **D-6** | Who answers the legal questions below, and when? | Before Stage 5's public copy is published. L-2 first |

### Legal questions — **[LEGAL]**, none answerable from code

| | Question | Blocks |
| --- | --- | --- |
| **L-1** | What are Eraya's actual CSAE reporting obligations in India? **POCSO Act 2012 §19/§20** (§20 binds internet personnel; failure to report is itself an offence); **IT Rules 2021 Rule 3(2)(b)** (24-hour removal of material depicting a child in a sexual act); **DPDP Act 2023** retention and erasure duties. **Cited as the questions to put to counsel, not as a statement of Eraya's position.** | `docs/17`, P4 |
| **L-2** | May Eraya retain a suspected-CSAM object at all, on what basis, with what access controls, and for how long — or must it delete and report? **This gates C3 entirely** and is why photo legal hold is deferred rather than merely postponed. | C3, C4 |
| **L-3** | Does `/child-safety` need a named **Grievance Officer** under the Intermediary Guidelines, or does a published address suffice at Eraya's size? | Stage 5 copy |
| **L-4** | Does preserving report metadata after account deletion (Stage 4) need disclosure in `/privacy` and `/delete-account`, and in the Play Data safety form? **[also PLAY]** My reading is that it should be disclosed; the wording is not mine to write. | Stage 5 copy |
| **L-5** | Should Eraya register with the **NCMEC CyberTipline**? Free, open to non-US platforms **[EXTERNAL]**, but obligations follow. | `docs/17` |

### 11.3 When Eraya is ready to complete the Play Console declaration

Every line must be true, and each names its evidence. **Do not submit on fewer.**

| | Criterion | Evidence |
| --- | --- | --- |
| **1** | `/child-safety` is live, publicly accessible, not editable by visitors, and **every statement on it describes a capability that exists** | Stage 5's line-by-line re-walk, recorded |
| **2** | A member on **Android** can report another member, choosing **"Child sexual abuse or exploitation"**, from a profile and from a conversation, in all six locales | Device walk + `locale:probe` (Stage 3) |
| **3** | The reporter's identity is not disclosed to the reported member, and the reported member is not notified | The 3 existing confidentiality probe checks, still passing |
| **4** | Reporting still blocks immediately and atomically | The existing "reporting blocked the member" and "a refused report writes neither" checks |
| **5** | A child-safety report is **visibly first** in the moderation queue | Stage 2's new probe check |
| **6** | An authorised moderator can review, suspend and dismiss; an ordinary member can do none of it when calling every RPC by name | The 8 existing authorisation checks + the new ones |
| **7** | **A report survives the reported member deleting their account** | Stage 4's probe check |
| **8** | **Account deletion still works on both clients** | Stage 4's end-to-end deletion test — R-1 |
| **9** | **`support@eraya.app` is monitored and reaches the operator** | Stage 6's test message |
| **10** | A written escalation procedure exists and matches what the product does | `docs/17` (Stage 5) |
| **11** | No in-app text contradicts the published page | Stage 1 |
| **12** | **L-1 has an answer from counsel**, so P4 is not asserted from code | D-6 |
| **13** | All probes green, or green-by-design with the deviation explained | Stage 8 |

**Explicitly not a criterion: that this work makes the declaration pass.** The
declaration is assessed by Google against the page and the app's real behaviour.
The two things most likely to be judged insufficient are facts, not code —
**there is one operator and no moderation team, and there is no automated CSAM
detection.** Both are stated plainly on `/child-safety` **[VERIFIED]**, and that
honesty is the right posture for closed testing. This plan makes the page true
and the reporting path real; it does not and cannot guarantee Google's
conclusion.

---

## Appendix — what was verified for this plan

New this session, beyond the previous two documents:

| Established | How |
| --- | --- |
| `profiles.id references auth.users (id) on delete cascade` — so the delete chain is users → profiles → reports | `supabase/migrations/20260811090400_create_profiles.sql:9` |
| **A row trigger on `profiles` fires on a cascade from `auth.users`, by every deletion route** — the basis for the A4 design | `supabase/migrations/20260920120100_delete_photos_with_profile.sql` |
| **A trigger on `profiles` delete has broken account deletion on this project before** ("Database error deleting user", 500), because a raise inside the cascade takes the transaction with it — and was backed out in one line | `supabase/migrations/20260920120200_photo_trigger_diagnosis.sql` |
| `admin_list_reports` uses **INNER JOINs** on `profiles` twice, so a report also vanishes from the queue when the *reporter* leaves | `supabase/migrations/20260911100100_moderation.sql:172-173` |
| `moderation_actions_known` allows only `dismissed`/`suspended`/`restored` — no removal action exists | same file |
| **The moderator allowlist is `tech@eraya.app`, `rahul@eraya.app`; the page publishes `support@eraya.app`** | `20260911100100:34` vs `child-safety/page.tsx` |
| Production Postgres 17.6.1.155; `config.toml` declares local 15 | `supabase/.temp/postgres-version`; `supabase/config.toml` |
| No Management API token and no database password on this machine | `ls -a ~/.supabase`; `env`; `apps/web/.env.local` key names |
| `db push --dry-run`, `db dump`, `backups list` all exist | `supabase … --help` |
| Only `pg_trgm` installed | `grep -rn "create extension" supabase/migrations/` |
| `npm run security` is 63/72 **by design** | Fixture account stages — only the five `@seed.*` profiles are onboarded |
