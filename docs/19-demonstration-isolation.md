# Demonstration accounts

How Eraya keeps a fabricated profile and a real member from reaching each
other, in either direction, and what that cannot cover.

Migration: `supabase/migrations/20261126110100_demonstration_isolation.sql`.
Runtime proof: `npm run demonstration:local`, non-vacuity:
`npm run demonstration:local:mutations`.

---

## Why it exists

Two reasons, and the second is the one that forced it.

**App Review needs an account.** Apple's Guideline 2.1(a) asks for working demo
credentials and a back end that is switched on. On most products that is a
login. On Eraya the thing a reviewer is asked to exercise is *meeting people*,
and the people are real: a reviewer doing the job properly expresses interest in
somebody, opens a conversation, sends a message, then reports and blocks them.
On the live product every one of those actions lands on a divorced, separated or
widowed adult who signed up to meet someone and has just been approached and
dropped by a stranger who was never looking.

**Eraya already has five fabricated profiles facing real members.** They were
seeded on 2026-09-28 to make a new member's discovery non-empty, and by
2026-11-28 real members had expressed interest in them 154 times. That was an
owner decision, taken knowingly, and it is the thing this migration exists to
end: the profiles have to stop appearing to genuine members without their own
history being deleted.

Filling a reviewer's discovery with demonstration profiles was the earlier plan
and is not a boundary — it is arithmetic that gets weaker as the real population
grows. Writing "please practise on B" in the App Review notes is not a control
either; it is a request, made to somebody with no way to tell which profiles are
real.

---

## The rule

**An account meets only accounts of its own kind.** Symmetric, total, enforced
in the database.

`profiles.account_kind` is an enum — `member` or `demonstration` — defaulting to
`member`, so applying the migration changes nothing for anybody who already
exists. `public.accounts_may_meet(a, b)` is the single definition, called from
every place that decides visibility or contact, and it fails closed: a missing
profile on either side answers false.

A demonstration account is **not a privilege**. Same sign-in, same row-level
security, same entitlements, no moderator rights, no bypass. It can see less
than a member, never more.

Nobody can change their own kind. The column privilege is revoked from
`authenticated`, and `profiles_guard_account_kind` refuses the change anyway
whenever `auth.uid()` is not null — which is every caller except the service
role. Both directions are refused: a member who could mark themselves
`demonstration` would vanish from every real member's discovery while still
appearing to be in the product, and nobody would diagnose that.

---

## Where it is enforced

Writing was the easy half. The surfaces that **read what already exists** are
where a conversion actually leaks, because marking an account is something done
to an account that has a history.

| Surface | Control |
| --- | --- |
| Discovery | `discover_members` compares `account_kind`, before `LIMIT`, so paging stays correct |
| A profile by id | `member_profile` calls `accounts_may_meet` |
| Expressing interest | `express_interest` checks before it writes anything |
| `member_interests` writes | `member_interests_guard_kind` trigger |
| `connections` writes | `connections_guard_kind` trigger, INSERT **and** UPDATE |
| `messages` writes | `messages_guard_kind` trigger |
| Reading a conversation | `messages` SELECT policy requires `may_meet` on the other party |
| The connection row | `connections` SELECT policy, same |
| Outgoing interests | `member_interests` SELECT policy, same |
| Photograph bytes | `storage.objects` SELECT policy, same |
| The admirer count | `interests_received_count` filters on kind |

`interests_received`, `my_conversations` and `member_photos` need no clause of
their own: each reaches a profile through `cross join lateral member_profile()`
or `exists (select 1 from member_profile())`, and a lateral over a
set-returning function that returns nothing drops the row. That is the same
mechanism that already removes a blocked person's conversation from the inbox.

### `may_meet` and why it is a function

Row-level security expressions run as the *querying* role, so a policy may only
call something that role can execute. `accounts_may_meet` takes two arbitrary
ids and is granted to nobody. `public.may_meet(other uuid)` supplies the
caller's own id from `auth.uid()` and is granted to `authenticated`.

It must be a `security definer` function and **not** an inline subquery. The
predicate reads `profiles.account_kind` for somebody who is not the caller, and
`profiles`' own row-level security allows a member to read only their own row —
inline, the comparison is null for every other account and the policies hide
every photograph and every conversation in the product. The content-moderation
migration records the same trap costing the same mistake.

What granting it gives away: for an id the caller already holds, whether that
account is of the caller's own kind. No profile content, and the alternative is
not a safer boundary but a broken product.

---

## ❗ The window this cannot close

**A signed photograph URL keeps working for up to an hour after a conversion.**

Both clients call `createSignedUrl(path, 3600)`. A signed URL is a
self-contained token that the storage service validates on its own; it does not
re-consult the policies above. So a URL issued in the hour before an account is
converted goes on resolving until it expires, and nothing in the database can
recall it.

What that does and does not mean:

- It is bounded, at one hour, and it shrinks to nothing after that.
- It only affects URLs **already issued**. From the moment of conversion no new
  one can be signed across kinds — proved at issue time, not only at fetch time.
- The mobile client memoises signed URLs in process and re-signs a minute early,
  so a running app holds at most an hour-old URL and cannot refresh it
  afterwards.

There is no honest way to shorten it without shortening the TTL for everybody,
which would put a storage round trip into every scroll on Indian mobile data.
The accepted answer is to convert accounts at a quiet hour and to state the
window rather than imply it does not exist.

---

## What is deliberately preserved

Nothing is deleted. Interests, connections, messages, photographs,
subscriptions and payments all stay exactly as they were — the probe asserts the
row counts are unchanged across a conversion, and that the financial rows are
byte-identical.

Members can no longer reach a converted account's history through ordinary
surfaces; the service role still can, and so does a moderator where the product
already gave them sight. That is what makes support and any legally necessary
retrieval possible after a conversion.

### What a member sees

Nothing broken, and nothing untrue. Verified in a browser against a local stack,
signed in as a member who had a connection and a two-way conversation with an
account that was then converted:

| Surface | What it shows |
| --- | --- |
| `/connections` | The genuine connection only. The converted one is simply absent — no placeholder, no error |
| `/connections/<converted id>` | 404 |
| `/discovery` | Genuine members only |
| `/discovery/<converted id>` | 404 |
| `/home` | Introductions, connections and counts all consistent |

The 404 is the same treatment a blocked member's conversation already gets, so
it is the product's existing behaviour rather than something new. It is not
misleading — in particular it never suggests the person left, went quiet, or
chose not to reply.

---

## Deploying it without deploying content moderation

These are separate decisions and must stay separate: photograph moderation needs
a staffed queue before it is switched on, and demonstration isolation does not.

`20261128100100_demonstration_accounts.sql` — the first attempt at this
boundary, now deleted — could not be deployed alone. It re-declared
`discover_members` in a form that calls `public.visible_photo_path(uuid)` and
`public.visible_photo_count(uuid)`, which exist only in
`20261127100100_content_moderation.sql`:

```
ERROR:  function public.visible_photo_path(uuid) does not exist
LINE 47:     public.visible_photo_path(p.id),
```

This migration is built against the schema production actually has, and its
timestamp sits between the newest applied migration and the moderation one, so
it applies contiguously on its own. Withhold the deferred files and
`db push --dry-run` names exactly one migration.

`20261127100100` is amended to carry the boundary forward — the `account_kind`
comparison in its `discover_members`, the `accounts_may_meet` call in its
`member_profile`, and `may_meet` in its storage policy — because it legitimately
re-declares all three and would otherwise undo them when it lands. The isolation
probe passes on **both** schema shapes, which is how that is checked.
