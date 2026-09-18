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
