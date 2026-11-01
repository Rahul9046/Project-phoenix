# Child safety: the operating procedure

Internal. Not published, not linked from the product, and deliberately
different in tone from `/child-safety` — that page tells members and Google what
Eraya does; this one tells the operator how to do it.

**Eraya is operated by one person.** Everything below is written for that, and
the honest consequence is stated where it bites: there is no rota, no second
reviewer, no out-of-hours cover and no service-level promise. Nothing here
should be copied onto a public page without checking first whether it is a
commitment Eraya can keep.

---

## 0. What is a commitment and what is not

The distinction the rest of this document depends on.

| | Status |
| --- | --- |
| Reports are read by hand, by the operator | **In practice.** True today, and said in the product and on `/child-safety`. |
| Child safety reports are marked and sorted to the top of the queue | **In practice.** Enforced by `admin_list_reports`, not by habit. |
| Reporting blocks the reported member immediately | **In practice.** One transaction, enforced in the database. |
| A report survives the deletion of either account | **In practice.** `20261101100300` applied to production 2026-11-01 and proved there by `npm run moderation:probe` — a reported account deletes successfully, the report is preserved in both directions, and the original row still cascades away. |
| **Checking the queue once every 24 hours** | **Proposed.** Not yet practised, and not published anywhere. See §2. |
| **Same-day triage of a child safety report** | **Proposed, internal target.** Deliberately not published — `/child-safety` says no response time, and that stays true until there is a process capable of keeping one. |
| Removal of an account on a CSAE finding | **In practice**, by hand, via the Supabase dashboard. See §6. |
| Reporting to authorities | **Unresolved.** The obligations are not yet established. See §10 and §13. |
| Retention periods for reports | **Unresolved.** No period is set, and none is invented here. See §13. |

---

## 1. Reaching the queue

`https://eraya.app/admin/reports`

- Typed, not linked. It is not in the signed-in shell and nothing navigates to
  it.
- Sign in as an address on the `moderation_admins` allowlist in `ops_config`.
  Today that is `tech@eraya.app` and `rahul@eraya.app`.
- A non-moderator gets a **404, not a 403** — the page does not confirm it
  exists. If you get a 404, the first thing to check is which account the
  browser is signed in as.

Changing who can moderate is one row and no deploy:

```sql
update public.ops_config
   set value = '["tech@eraya.app", "rahul@eraya.app"]'::jsonb
 where key = 'moderation_admins';
```

Four views: **Open**, **Resolved**, **All**, **Preserved**. The first three read
`member_reports`. **Preserved** reads `member_reports_archive` — reports whose
account has since been deleted — and **every time you open it, a row is written
to `moderation_actions`**. That is intended. Do not open it to browse.

---

## 2. How often to check — *proposed*

**Proposed, not yet practised:** once every 24 hours, and again before closing
the laptop on any day a report arrived.

This is written down so it can be adopted and so its absence is visible, not
because it is already true. Three things make a daily check the honest number
rather than an aspiration:

- There is no notification of any kind. Nothing emails, pushes or messages the
  operator when a report arrives — it is deliberately not built, because an
  immediate alert with no process behind it is theatre.
- The reporter is already protected without the operator. Reporting blocks the
  reported member in the same transaction, so the person who filed is safe from
  that member before anybody reads anything.
- Closed beta is a small, selected group. The realistic volume is zero reports.

**Do not publish this cadence.** `/child-safety` says Eraya does not publish a
response time, and that is the correct position until a process exists that can
hold one.

---

## 3. Spotting an urgent report

A child safety report is **two things at once** in the queue:

1. **Sorted to the top.** `admin_list_reports` orders open child-safety reports
   above everything else, including newer ordinary reports.
2. **Marked.** The row carries a **Child safety · read first** badge and a
   terracotta border.

Both, because an order is not a signal once somebody filters or scrolls.

What counts as child safety is decided in the database, not on the screen:
`reason_code in ('csae', 'underage')`, returned as `is_child_safety`. The same
pair is named once in `packages/i18n/src/report.ts` as `CSAE_REASONS` for the
clients.

| Category shown to the member | Code |
| --- | --- |
| Child sexual abuse or exploitation | `csae` |
| Under 18 | `underage` |

A report under **Threats or safety concern** (`safety_threat`) is *not* sorted
as child safety. Read the description: if it describes a child, treat it as a
child safety report from that point on regardless of the category chosen.

---

## 4. Investigating

**What the admin area gives you:** the category, the reporter's own words, both
first names, whether the reported member is already suspended, and how many
reports exist against them. That is all, deliberately — privilege to moderate is
not privilege to browse.

**What it does not give you:** messages, photographs, phone numbers or payment
history. There is no button for any of it.

So an investigation that needs more than the queue shows uses **administrative
access to the database**, through the Supabase dashboard. Three rules:

1. **Look only at what the report is about.** The conversation named, the
   profile named. Not the member's other conversations, not other members.
   This limit is a procedure, not a control — nothing in the code enforces it,
   which is exactly why it is written down here.
2. **Write down that you looked**, as a moderation note when you act (§7). A
   read through the dashboard leaves no trace of its own.
3. **Never download, forward, re-share or copy suspected child sexual abuse
   material** — not to email, not to a chat, not to a local folder, not to
   "keep a copy for evidence". Possessing or transmitting it is an offence in
   India even when the intention is to report it, and `/child-safety` tells
   members the same thing. Describe it and record where it is.

`/child-safety` describes this honestly — "only the operator can do this, and
our internal procedure limits it to the report in hand" — and it must not be
rewritten to imply a product-level permission system that does not exist.

---

## 5. Suspending

**For a child safety report: suspend first, read second.**

Suspension is reversible, destroys nothing, and stops participation at once. The
cost of suspending someone who turns out to be innocent is an apology and a
`Restore`. The cost of reading first is that somebody stays reachable while you
read.

Press **Suspend**, confirm, and the member:

- disappears from discovery, in both directions — they are shown to nobody and
  shown nobody;
- cannot express interest;
- cannot send messages;
- keeps their account and all their data.

They are **not told**, and no third party is told. `express_interest` raises the
same `unavailable` for a suspension as for a block, so nothing in the product
announces that moderation happened.

Existing conversations stay readable to the people in them. Removing history
would look like data loss rather than moderation.

**Restore** undoes it completely.

---

## 6. Removing an account

Removal is real, permanent, and **done by hand**. There is no button for it in
the admin area, and `/child-safety` says so.

For CSAE, zero tolerance is the published standard, so removal is the default
outcome of a confirmed finding rather than an escalation beyond it.

**Order matters.** Do these in sequence:

1. **Suspend first** (§5), so participation stops while you work.
2. **Read and record** what the finding is, and write the moderation note (§7)
   **before** the account goes — the note references the report, and you want
   the record written while you can still see what it is about.
3. **Delete the account** in the Supabase dashboard, under Authentication →
   Users. Deleting the auth user cascades the profile and everything hanging
   off it.
4. **Confirm the report survived.** Open **Preserved** in the admin area. The
   report should be there with its category, its description, and
   `archived_for` naming the deleted account. If it is not, stop and
   investigate — that is the one failure mode of `profiles_archive_reports`
   that matters.
5. **Sweep the storage.** `npm run photos:sweep` reports orphaned photo folders;
   `npm run photos:sweep -- --apply` removes them. A dashboard deletion does not
   remove files from the `profile-photos` bucket — nothing in SQL can, because
   Supabase refuses direct deletes on `storage.objects`.

`20261101100300` is applied in production as of 2026-11-01, so step 4 works and
step 3 no longer destroys the reports that justified it. **That was the order
before it: deleting an account took every report about it along.** If you are
ever working against a database where the trigger is absent, suspend and do not
delete.

### What removal does and does not reach

| Goes | Stays |
| --- | --- |
| The account, profile, photographs, messages, interests, connections, blocks, subscription | The report, in `member_reports_archive`: category, description, timestamps, both account identifiers |
| | `moderation_actions` — the record of what was decided |
| | Sign-in logs, with the account unlinked and the email masked |

Photographs and messages are **not** preserved. That is deliberate and is the
subject of the open legal question in §13 — retaining suspected material is not
something to start doing without advice.

---

## 7. Recording what you did

Every action through the admin area writes a `moderation_actions` row
automatically, attributed to the signed-in moderator from their session. There
is no field for a caller to substitute, so an action cannot be recorded against
somebody else.

Verbs currently recorded: `dismissed`, `suspended`, `restored`,
`archive_viewed`.

What the automatic record does **not** capture is why, or anything you read
through the dashboard. So for a child safety report, write it down:

- the suspend confirmation carries a reason — use it, briefly and factually;
- if you read a conversation or a profile through the dashboard, say so in that
  reason, so the record shows the decision was made on something;
- a removal performed in the dashboard writes nothing by itself. Suspend with a
  note first (§6 step 2), so the audit trail carries the finding even though the
  account is gone.

Write what happened, not what you concluded about the person. The record may be
read later by somebody deciding whether the decision was right — possibly a
lawyer, possibly an authority, possibly you in a year.

---

## 8. Reports involving potentially illegal material

1. **If a child may be in immediate danger, the police come first.** In India,
   112 for emergencies, 1098 for Childline. Do not wait for your own
   investigation. The app tells reporters the same thing in the notice that
   appears when they pick a child safety category.
2. **Suspend the account immediately** (§5).
3. **Do not open, download, forward or copy the material.** Record where it is —
   the `storage_path`, the conversation, the message — and work from the
   reporter's description. See §4 rule 3.
4. **Do not reply to the reporter with any of it**, and do not quote it in an
   email to anybody.
5. **Record the finding** (§7) in words.
6. **Remove the account** (§6) where the finding warrants it, which for CSAE is
   the default.
7. **Then stop and get advice** before reporting onward, preserving anything, or
   deleting the storage objects. §10 and §13.

**Nothing in Eraya automatically preserves suspected illegal material.** There
is no legal-hold mechanism, no evidence bucket, and no copy of any image in the
database. That is a deliberate gap, not an oversight: building automatic
retention of this material without a legally reviewed procedure would be worse
than not having it. See §13, L-2.

**Consequence to be aware of:** deleting the account removes the photographs
from `profile_photos` and, once `photos:sweep --apply` runs, from storage. If
counsel later says material should have been preserved, it will be gone. If a
report is live and you have any reason to think preservation will be required,
**suspend and do not delete**, and get advice first. Suspension keeps
everything.

---

## 9. Account deletion during an investigation

**Deletion is never refused.** A member can delete their account at any time,
including while suspended and including while a report about them is open.
There is no block, no cooling-off period and no indefinite hold — an
investigation is not a reason to take away somebody's deletion right, and Google
Play requires the deletion path to work.

What happens instead: `profiles_archive_reports` copies the reports out before
the cascade reaches them. So the investigation record survives and the member's
own data does not.

| Survives their deletion | Goes |
| --- | --- |
| The report: category, description, timestamps, both account identifiers | Profile, name, date of birth, photographs, messages, interests, connections |
| `moderation_actions` for anything already decided | |

**If the subject deletes mid-investigation:**

1. The report is in **Preserved**. Find it there.
2. `archived_for` tells you whether the person reported left or the person
   reporting did — which changes what the report means.
3. You can still record a finding; there is simply nobody left to suspend.
4. The photographs and messages are gone, and cannot be recovered. If the
   report is a child safety matter, note that in the record.

This is disclosed to members: `/delete-account` names safety reports in its
"what is kept" list and says plainly that they are not unlinked; `/privacy` says
the same in its deletion section. **If this behaviour changes, those two pages
and `/child-safety` change with it.**

---

## 10. Lawful requests from authorities

Nothing here is legal advice, and the questions in §13 are not yet answered.

**On receiving a request:**

1. **Do not action it from the inbox.** Get advice first — §13, L-1 and L-3.
2. **Record that it arrived**: who from, when, what was asked, what reference
   they gave.
3. **Do not delete anything** connected to it while it is open. In particular
   do not delete the account or run `photos:sweep --apply` against it.
   Suspension preserves everything; deletion does not.
4. **Do not send material by email.** If something must be handed over, ask how
   they want to receive it.
5. Answer from `support@eraya.app`, which is the published contact for exactly
   this.

Eraya says on `/child-safety` that it responds to lawful requests from
authorities, and that it will report where legally required. **What "legally
required" means for Eraya is not yet established** — see §13.

---

## 11. Verifying the published contact

`/child-safety` publishes **`support@eraya.app`** as the designated contact for
child safety and CSAE matters, "including from people who do not have an Eraya
account".

**This is the single most reviewer-visible promise on the page, and no code
makes it true.** It needs checking by hand, and re-checking if mail routing ever
changes.

Note the asymmetry: `support@eraya.app` is **not** on the `moderation_admins`
allowlist, which is `tech@eraya.app` and `rahul@eraya.app`. Different addresses.
One being monitored does not mean the other is.

### The check

1. From an address with **no connection to Eraya** — a personal account, not an
   `@eraya.app` one, and not one already in a thread — send to
   `support@eraya.app` with subject **Child safety concern**.
2. Include a line of plain body text. Do not attach anything.
3. Confirm it **arrives in a mailbox the operator actually opens**, not merely
   that it was accepted. A catch-all that nobody reads is worse than a bounce,
   because a bounce tells the sender to try something else.
4. Confirm it is **not in spam or quarantine**. An external sender with a
   child-safety subject line is exactly the shape mail filters dislike.
5. **Reply to it**, and confirm the reply arrives. The contact has to work in
   both directions — an authority that cannot be answered is not a contact.
6. Check how long the round trip took, and whether anything would have surfaced
   it on a day nobody was looking.
7. Record the date of the check here or in the delivery report.

### If it fails

Fix the routing, not the page — the published address is the one people and
authorities will have. Only if the address genuinely cannot be made to work
should `/child-safety`, `/contact`, `/delete-account` and `site.email` change,
and that is a policy edit needing approval.

Optionally, add `support@eraya.app` to `moderation_admins` so whoever answers it
can also open the queue. One `ops_config` row, no deploy. Not required, and
worth deciding rather than doing by default — the allowlist is a privilege, and
it should be as short as it can be.

---

## 12. If the operator is unavailable

This is the weakest part of the arrangement and the honest thing to do is say
so rather than describe cover that does not exist.

**Today:** there is one operator. If they are unavailable, nothing is read until
they are back. No rota, no deputy, no automated escalation.

**What still protects people while nobody is reading:**

- Reporting blocks the reported member in the same transaction. The reporter is
  protected the instant they press the button, with no moderator involved.
- Suspension, once applied, stays applied.
- `/child-safety` promises no response time, so a delay breaks no published
  commitment.
- The emergency guidance in the app sends somebody to the police rather than to
  Eraya when a child is in danger — which is the right destination regardless of
  who is reading the queue.

**What does not:** an open child safety report sits unread. There is no second
pair of eyes.

**Proposed mitigations, none adopted:**

- A second person on `moderation_admins` who checks the queue when the first is
  away. One `ops_config` row. The limit is trust, not technology.
- A planned-absence note: before an absence of more than a few days, check the
  queue, suspend anything open rather than leaving it undecided, and confirm
  `support@eraya.app` reaches somebody.
- Automated notification — the design is in
  `docs/child-safety-reporting-revised-proposal.md` §9 and is deliberately
  deferred. Reconsider before open testing or production, and note that an
  immediate alert is only worth building when somebody is able to act on it.

**Do not publish any of this as cover.** If a deputy is ever actually
appointed, `/child-safety` can say so, and not before.

---

## 13. Open legal questions

**None of these is answered, and nothing in this document or in the code
pretends otherwise.** They need a qualified Indian legal opinion. No retention
period and no reporting deadline is invented anywhere in this repository.

| | Question | What it blocks |
| --- | --- | --- |
| **L-1** | What are Eraya's actual CSAE reporting obligations? **POCSO Act 2012 §19/§20** (§20 binds internet and media personnel; failing to report knowledge of a child sexual offence is itself an offence). **IT Rules 2021 Rule 3(2)(b)** (removal of material depicting a child in a sexual act within 24 hours of a complaint). Cited as the questions to put to counsel, **not as a statement of Eraya's position**. | §10; any statement on `/child-safety` about reporting onward |
| **L-2** | May Eraya retain a suspected CSAM object at all — on what basis, with what access controls, for how long — or must it delete and report? **This is the question to ask first**, because §8 currently tells the operator not to preserve anything, and whether that is right or wrong depends on the answer. | §8; whether photo legal hold is ever built |
| **L-3** | What must be preserved, and for how long, once a report is made to an authority or a lawful request arrives? | §10 step 3 |
| **L-4** | How long may a report be kept in `member_reports_archive`? Right now: indefinitely, with no expiry job. Is that defensible under the **DPDP Act 2023**, and if not, what period applies? | An expiry job, if one is needed |
| **L-5** | Is the retention disclosure on `/delete-account` and `/privacy` sufficient, and does it satisfy **Google Play's account-deletion requirement**? Contractual as well as statutory. | Those two pages' wording |
| **L-6** | Does Eraya need a named **Grievance Officer** with published contact details under the Intermediary Guidelines, or does a published address suffice at this size? | `/child-safety` contact section |
| **L-7** | Should Eraya register with the **NCMEC CyberTipline**? Free and open to non-US platforms, but obligations follow from registering. | §10 |

**Until L-2 and L-4 are answered:** do not build evidence retention, do not
build an expiry job, and do not add a retention period to any public page.

---

## 14. What this procedure does not do

Said plainly, because `/child-safety` says it too and the two must not drift:

- **No automated CSAM detection.** No hash matching, no PhotoDNA, no CSAI
  Match. Nothing scans an image.
- **No moderation team.** One person.
- **No published response time**, and no process capable of keeping one.
- **No age verification against a document.** The 18+ boundary is a date of
  birth, checked in both clients and again in the database, and somebody
  determined to lie about it can create an account. This is precisely why
  reporting matters.
- **No appeals process.** A suspension can be restored by the operator; there
  is no route for a member to request it other than writing in.
- **No per-message or per-photograph reporting.** A member reports a person and
  describes the message or photograph in up to 2000 characters.

Every one of these is stated on `/child-safety` as well. **Implementing any of
them changes that page; claiming any of them without implementing it is worse
than the gap.**

---

## See also

- `docs/11-moderation-and-analytics.md` — the moderation mechanism, who may
  moderate, and why the authorisation checks are doubled.
- `docs/child-safety-closed-beta-plan.md` — what was in scope for closed beta
  and what was deferred.
- `docs/child-safety-reporting-revised-proposal.md` — the fuller design,
  including the evidence and notification work that was deliberately not built.
- `artifacts/child-safety-closed-beta-delivery-report.md` — what was actually
  implemented, tested, and left pending.
