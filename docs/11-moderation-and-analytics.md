# Moderation and analytics

Two things that had the same shape of problem: a member could report somebody
and nothing read the row, and the product could take money but could not say how
many people got close. Both were writes with no reader.

## Moderation

### Who can moderate

An allowlist of email addresses, held in `ops_config` under the key
`moderation_admins`, and read by `public.is_moderator()`. The function compares
the lower-cased, trimmed `email` claim from the session against that list.

Adding or removing a moderator is an update to that one row. It is not a role,
not a column on `profiles`, and not an environment variable — so nobody has to
deploy anything to take somebody's access away, and a moderator's access does
not survive in a build artefact after it is revoked.

```sql
update public.ops_config
   set value = '["tech@eraya.app", "rahul@eraya.app"]'::jsonb
 where key = 'moderation_admins';
```

### The queue

`/admin/reports` on the web. It is not linked from anywhere, not in the
signed-in shell, and carries `robots: { index: false }`.

`requireModerator()` answers with a **404, not a 403**. A 403 tells whoever is
probing that the page exists and that they merely lack the rank; a 404 tells
them nothing. The page is reached by typing the address.

Three actions, and deliberately no fourth:

| Action | What it does |
| --- | --- |
| Dismiss | Marks the report resolved. The member is unaffected. Reversible in the sense that matters — the report stays readable under "Resolved". |
| Suspend | The member stops appearing in discovery and cannot express interest or send messages. Their account and data stay. Asks for confirmation first. |
| Restore | Undoes a suspension. |

There is no "Warn" button, because there is nothing that sends a warning. A
control that does not do what its label says is worse than a missing feature.

There is no "Remove account" button either, and that one is a gap rather than a
decision: removal is real but is carried out by hand in the Supabase dashboard.
`/child-safety` says so in those words, and `docs/17-child-safety.md` §6 has the
order to do it in — which matters, because removing an account before
`20261101100300` was deployed destroyed the reports that justified it.

### Child safety reports come first

Added 2026-11-01. `/child-safety` had been telling the public that "a child
safety report is the highest priority thing in the queue" while
`admin_list_reports` ordered by open-ness and then by age — so a report that
somebody is a child sat between two reports about unwanted promotion.

Two things now make the claim true:

- **`csae`** is a report category in its own right (`20261101100100`), offered
  first in both clients. Before it, the published page had to tell people to
  choose "Under 18" or "Threats or safety concern" instead.
- **`admin_list_reports` returns `is_child_safety`** and sorts on it
  (`20261101100200`). The order is four clauses — open-and-child-safety, then
  open, then child-safety, then newest — because "child safety first" alone
  would float a dismissed CSAE report above an open harassment report filed this
  morning. Priority is about what needs doing.

**The category pair lives in two places on purpose, and they must agree:**
`reason_code in ('csae', 'underage')` in the database, and `CSAE_REASONS` in
`packages/i18n/src/report.ts` for the clients. The database decides the queue;
the shared constant decides which reasons show the emergency notice. A report
filed as `safety_threat` is not sorted as child safety even if its description
describes a child — `docs/17` §3 tells the operator to read for that.

### Reports outlive the accounts they were about

`member_reports` cascades from `profiles`, which cascades from `auth.users`. So
deleting an account used to delete every report filed about it — and
`delete_my_account()` has no guard, so **a member who had been reported could
erase the reports about them by pressing a button in the product.** Every other
deletion route did the same: the dashboard, the admin API, `demo:remove`, and
the probes.

`20261101100300` fixes it with a `before delete` trigger on `profiles` that
copies the rows into `member_reports_archive` on the way past. Both directions:
reports about the departing member and reports they filed, because a report with
no reporter is still evidence about the person reported.

Three things worth knowing before touching it:

- **It is `before delete`, not `after`.** Referential actions run as AFTER
  triggers on the referenced table, so BEFORE DELETE on `profiles` is the only
  point at which `member_reports` is still populated.
- **A trigger on this table has broken account deletion before.**
  `20260920120100` added an AFTER DELETE trigger for photographs and deletion
  started answering "Database error deleting user" with a 500, because a raise
  inside the cascade takes the transaction with it; it was backed out one
  migration later. So the archive table has **no constraint that can fail** — no
  foreign keys, no NOT NULLs beyond the primary key, and the insert carries
  `on conflict do nothing`. There is deliberately **no exception handler**: a
  silent failure here loses the evidence the thing exists to preserve, which is
  the `record_product_event` trap described further down this document.
- **Deletion is never refused.** Not while suspended, not while a report is
  open. The investigation record survives instead of the member's right being
  taken away.

Reading the archive is a fourth view on `/admin/reports` — "Preserved" — behind
`admin_list_archived_reports()`, which checks `is_moderator()` and **writes a
`moderation_actions` row on every call** (`archive_viewed`). Reading a departed
member's report is itself an act worth having on the record, which is why the
function is not called when any other view is rendered.

Retention is disclosed on `/delete-account` and `/privacy`: safety reports are
named there as kept, and as the one thing that is **not** unlinked from the
account. **No retention period is set** — that is an open legal question in
`docs/17-child-safety.md` §13, and no number has been invented for it.

### Why the checks are doubled

Every action calls `requireModerator()` in the server action **and** the RPC it
calls re-checks `is_moderator()` in its own body. This is not belt and braces
for its own sake:

- The guard in the action gives an honest 404 to somebody browsing.
- The check inside the function is the one that actually holds. A server action
  is a public endpoint. An RPC is callable by name by anything that can sign in.
  A page guard protects a page; it does not protect a database function.

`npm run moderation:probe` proves this by signing in as an ordinary member and
calling every admin RPC by name. It runs as a real member session, never as the
service role — a probe that uses the service role proves nothing about the
boundary, because the service role is meant to get through.

Every action is written to `moderation_actions`, attributed to the moderator
from their session. No function takes an admin identity as an argument, so there
is no field a caller could use to act as somebody else.

### What moderation is not

No profile review, no photo review, nothing automated. Reports are read by a
founder, by hand, with no staffing and no SLA. **Copy anywhere in the product
must not imply review that is faster or more certain than that.**

## Analytics

### The one thing to know before adding an event

`product_events` constrains `event` to a known list. `record_product_event`
catches every exception and returns, so that a measurement can never break a
purchase.

Both decisions are correct. Together they mean **an event name that is not on
the list is discarded in silence** — the trigger fires, the function runs, the
insert fails the check, the handler swallows it, and the table looks exactly as
it did before. No error, no log, no row.

The entire pre-paywall funnel shipped that way once and measured nothing.
Nothing failed, which is the problem: a broken pipeline looks identical to a
product nobody is using, and the second explanation is the easier one to reach
for.

**So adding an event is two changes, never one:** the instrumentation, and the
allowlist in the `product_events_known_event` constraint. Then run
`npm run analytics:probe`, which performs each transition against the live API
and goes looking for the row.

### Where events are recorded

Everything before the paywall is recorded **by the database, on the write
itself** — inside `express_interest`, or by a trigger on the table. Three
reasons, and the third is the one that matters:

1. The clients cannot double-count. A component that re-renders fires nothing,
   because the event belongs to the write and not to the screen.
2. Web and mobile cannot drift. One definition of "expressed interest".
3. **Nothing personal can be attached by accident.** There is no parameter for a
   message, a name, a number or a date of birth, so none can be passed.

The payment funnel is still recorded by the clients, because those steps happen
in a payment sheet and never reach the database at all.

| Event | Recorded by |
| --- | --- |
| `registration_started` | trigger on `profiles` insert |
| `onboarding_completed` | trigger on the stage transition, once |
| `discovery_viewed` | `record_discovery_view()`, called per fetch |
| `profile_viewed` | `record_profile_view()`, called when a full profile opens |
| `interest_expressed` | inside `express_interest` |
| `connection_created` | inside `express_interest`, when it is mutual |
| `conversation_started` | trigger on the first message in a connection |
| `membership_screen_viewed` … `premium_activated` | the clients |

### Attribution inside a trigger

`record_product_event` reads the actor from `auth.uid()`, which is right for a
client and useless inside a trigger. A profile row is created by a trigger on
`auth.users`, which runs on GoTrue's own connection where there is no session —
so `registration_started` landed with a null actor, and `actor` is nullable, so
it failed by writing an unusable row rather than by raising anything.

The `profiles` and `messages` triggers therefore insert directly and attribute
explicitly to `new.id` / `new.sender_id`. They do not need to ask who it is.

### What is deliberately not counted

- Passing on somebody. That is a private act, and counting it turns discovery
  into a scored experience.
- Reading a message or opening a thread. Counting how often somebody reads their
  own conversations is surveillance of the private half of the product.
  `conversation_started` already says the connection turned into talking.
- Which profile was viewed. `profile_viewed` records that one was, never whose,
  so who looked at whom cannot be reconstructed from this table.

Members cannot read `product_events`, and no client can either.
