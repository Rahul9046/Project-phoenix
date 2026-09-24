# Email delivery and the sign-in rate limit

Email is not one of the ways into Eraya. It is the only one. There is no
password, phone verification is optional on the web and absent from the app, and
Google and Facebook both resolve to an address. So the sign-in email is the
product's front door, and the rate limit on it is the width of that door.

This document exists because the beta is about to push many people through it at
once, and the limit that governs that is the one number in the whole auth system
that no file in this repository sets.

---

## What is actually configured today

Established by reading the repository and the production `auth_events` table on
2026-09-24, not from memory.

| | |
| --- | --- |
| Email provider | **Resend**, over SMTP (`smtp.resend.com`, port 587) |
| Configured in | `supabase/config.toml`, `[auth.email.smtp]`, credentials as `env()` |
| Pushed by | `npm run config:push`, which refuses when a referenced variable is missing |
| Sender | `no-reply@eraya.app`, sender name "Eraya" |
| Template | In version control, `[auth.email.template.*]` |
| **Rate limit** | **Not in any file. Dashboard only.** |
| Eraya's own email cooldown | **None** |

Custom SMTP is the important half, and it is already done. This is not a project
sending through Supabase's built-in service, which exists for development and is
capped hard enough to be useless in production. Resend is a real sender with a
real reputation attached to `eraya.app`.

What is missing is narrower than it first appears: `supabase/config.toml` has no
`[auth.rate_limit]` section and `[auth.email]` declares no `max_frequency`. Every
other auth decision in this project is in that file on purpose — the redirect
URLs, the token rotation, the templates — so that it can be reviewed and
restored. This one is not, which means nobody can say what it is without opening
the dashboard, and `config:push` neither sets nor protects it.

---

## What the limit actually is

It cannot be read from here: the Management API needs a personal access token
this machine does not have. But production has been answering the question for
three weeks, and `auth_events` records every attempt.

**On 2026-09-07 the third email inside forty-one minutes was refused.**

```
14:45:54  email_auth_requested  ->  success
15:11:50  email_auth_requested  ->  success
15:26:45  email_auth_requested  ->  email_auth_failure [rate_limited]
15:28:32  email_auth_requested  ->  email_auth_failure [rate_limited]
```

That is the signature of **two emails per hour** — Supabase's built-in-service
default.

**On 2026-09-22 seven emails inside seventy-eight minutes all succeeded**,
including three inside eight minutes:

```
08:12:37 · 08:16:35 · 08:20:30 · 08:58:18 · 09:14:01 · 09:16:04 · 09:30:42
```

So the effective limit rose at some point between those dates — consistent with
custom SMTP reaching the live project, which moves Supabase's default from 2 per
hour to **30 per hour**.

**The honest position:** the ceiling is at least 7/hour, almost certainly 30/hour,
and nobody has read it. Confirm at **Authentication → Rate Limits** before
relying on any number in this document. It was deliberately not measured by
sending: measuring means real emails from the production domain, and a
deliberately tripped rate limit on a sending domain is a reputation cost paid for
information a dashboard gives away.

---

## Why 30 an hour is the wrong size for a beta

The cap is **account-wide, not per person**. Thirty emails an hour across the
whole product is one sign-in every two minutes for everybody at once.

Monthly volume is not the problem and will not be. At 2.2 email sign-ins a day
over the last 18.6 days, a beta two orders of magnitude busier is still nowhere
near any monthly plan limit.

The problem is the shape of a beta, which is bursty by definition. Testers are
invited in batches; a batch opens the link when the message arrives; they all
sign in inside the same half hour.

| Invited in one evening | Emails needed in hour one | At 30/hour |
| --- | --- | --- |
| 20 | ~20 | fine |
| 40 | ~40 | **10 people refused** |
| 100 | ~100 | **70 people refused** |

And the people refused are the *new* ones, on their first contact with the
product, being told to try again later by a screen that cannot explain itself.
Each retry is another request against the same exhausted bucket. A tester who
gives up at that point is not a tester.

A second, quieter cap matters too: **`max_frequency`**, the minimum gap between
two emails to the *same* address, default 60 seconds. That one is doing useful
work and should stay.

---

## "Remove the rate limit" — what that can and cannot mean

It cannot be removed, and it should not be. Two reasons, and the second is the
expensive one.

**Supabase does not offer "off".** The setting takes a number. The practical
maximum is a large number, not an absence.

**An unlimited sign-in form is a spam cannon pointed at your own domain.** The
endpoint takes an arbitrary email address from an unauthenticated stranger and
causes mail to be sent to it, from `eraya.app`, paid for by Eraya. With no
ceiling, a script can enumerate addresses and have Eraya deliver unsolicited mail
to all of them. What that costs is not mainly money:

- **Deliverability.** Spam complaints and bounces against `eraya.app` degrade the
  sending reputation. Resend suspends senders who generate them. The failure mode
  is that *sign-in stops working for real members* — the entire product, since
  there is no other way in — and it is not fixed by paying.
- **Money**, second and much smaller. See the table below.
- **A bill you did not authorise**, if the plan bills per email above an
  allowance.

So the goal is not removal. It is: **a ceiling high enough that a real batch of
testers never touches it, and low enough that an abuser hits it long before the
damage is done** — plus a per-address cooldown so that one person cannot spend
the shared budget alone.

---

## What to change

Three layers, in the order they should be done.

### 1. The account-wide hourly cap — dashboard, then config.toml

**Authentication → Rate Limits → "Rate limit for sending emails".**

Recommended for the beta: **200 per hour.**

That is roughly seven times the current likely value and absorbs a batch of a
hundred and fifty testers arriving together with room for their retries. It is
still a hard stop well below the volume an abuser needs for the damage to matter,
and it is far below any monthly allowance.

Then put it in the repository so it stops being invisible:

```toml
[auth.rate_limit]
# Account-wide, per hour. Sized for a beta batch arriving together rather than
# for steady traffic -- see docs/12-email-delivery.md. The binding constraint is
# a burst of new members on their first contact with the product, not the
# monthly total, which is nowhere near any plan limit.
email_sent = 200

[auth.email]
# The gap between two emails to the same address. Left at the default on
# purpose: this is the limit that stops one person spending the shared hourly
# budget, and it is the phone flow's 60-second cooldown by another name.
max_frequency = "1m"
```

**Push with `npm run config:push`, never `supabase config push`.** The wrapper
refuses when a referenced `env()` variable is absent; the bare CLI pushes the
literal text `env(NAME)` as the value and reports success. That is how the OAuth
credentials were wiped repeatedly.

**Verify first, on a throwaway branch of the config:** confirm whether the CLI
sends defaults for keys the file omits. If it does, any future push made for an
unrelated reason silently resets whatever the dashboard holds — which is the same
class of bug, and the reason this value belongs in the file regardless of what
number is chosen.

### 2. A resend cooldown of Eraya's own — code

`apps/web/src/features/auth/components/EmailAuthForm.tsx` disables its resend
control with `disabled={resending}`, which is only true while a request is in
flight. The button can be pressed again the moment the last one returns.

The phone flow already solves this properly: a 60-second server-enforced
cooldown, with the remaining seconds counted down on screen. Email should match
it, and the sentence for a refusal already exists.

This is worth more than the number in step 1. A cooldown converts the commonest
cause of exhaustion — one impatient person pressing resend eight times because
the mail is slow — from a shared-budget problem into a personal wait.

### 3. Watch it — script

`npm run auth:capacity` reports SMS capacity against thresholds of 60/75/85%. No
equivalent exists for email. The same shape applied to Resend's usage, or simply
to a count of `email_auth_requested` per hour against the configured cap, turns
"we ran out" from something a member discovers into something a check reports.

---

## What it costs

Two bills. Neither is the real constraint at beta scale.

### Supabase

**Changing the rate limit is free.** It is a dashboard setting, not a plan
feature, and it does not require an upgrade. Confirm this on the current plan
before relying on it — the free tier caps some auth settings.

The Pro plan is $25/month and is worth considering for the beta for reasons that
have nothing to do with email: daily backups, no project pausing on inactivity,
and log retention long enough to investigate an incident after a weekend.

### Resend — the actual sender

Prices as published; **verify before committing, they change.**

| Plan | Cost | Allowance | The cliff that matters |
| --- | --- | --- | --- |
| Free | $0 | 3,000/month | **100 per day** |
| Pro | $20/month | 50,000/month | no daily cap |
| Scale | $90/month | 100,000/month | — |

The **100 per day** ceiling on the free tier is the one to watch, and it binds
long before the monthly figure. It is also invisible in the Supabase dashboard:
Supabase will accept the send and Resend will refuse it, so the symptom is mail
that never arrives rather than a rate-limit error a member can understand.

**What a beta actually costs:**

| Beta size | Signup emails | Re-sign-ins (~2/month) | Monthly total | Cost |
| --- | --- | --- | --- | --- |
| 50 | 50 | 100 | ~150 | **$0** |
| 200 | 200 | 400 | ~600 | **$0** |
| 500 | 500 | 1,000 | ~1,500 | **$0** |
| 1,000 | 1,000 | 2,000 | ~3,000 | **at the free limit** |

So for the private Android beta the answer is **$0 on email**, provided no single
day exceeds 100 sends. Inviting 150 testers in one batch does exceed it — not on
cost, on the daily cap. Either stagger the invitations or move to Pro at $20 for
the month in which the batch goes out.

### What abuse would cost

Worth stating because it is the reason not to set the ceiling to a very large
number and forget it.

An unthrottled sign-in form at Resend Pro can emit 50,000 emails. A script doing
that costs $20 in plan terms and the sending reputation of `eraya.app` in every
term that matters. Recovering a burned domain takes weeks, and during them nobody
can sign in, because email is the only way in.

The 200/hour ceiling caps a sustained attack at 4,800 a day — enough to notice and
stop, in a bucket that refills, without an invoice.

---

## Recommendation

1. **Read the current value** at Authentication → Rate Limits. It is the one fact
   this document could not establish.
2. **Raise it to 200/hour** and commit `[auth.rate_limit] email_sent = 200`
   alongside `max_frequency = "1m"`, pushed with `npm run config:push`.
3. **Add the 60-second email resend cooldown** so the shared budget is not spent
   by one person's impatience.
4. **Stay on Resend Free** and keep daily sends under 100, or spend $20 for the
   month a large batch is invited.
5. **Do not remove the limit.** The cost of doing so is not the bill; it is
   sign-in itself, for everybody, for as long as the domain takes to recover.

**Total cost of solving this: $0**, plus $20 in any month the beta invites more
than a hundred people in a day.

---

## Open questions

- The live rate-limit value. Dashboard.
- Whether the current Supabase plan permits raising it.
- Whether `supabase config push` sends defaults for omitted keys, which would
  make every future push a silent reset of this value.
- Resend's current pricing and whether the daily cap still applies as described.
