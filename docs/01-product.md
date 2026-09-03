# Product

## What Eraya is

A trusted relationship platform for people who are divorced, separated or
widowed and are ready for their next chapter.

The organising idea is **beginning again**. Not recovery, not moving on, not
replacement — a new chapter that stands on its own.

## Who it is for

- Adults in India who are divorced, separated or widowed.
- A significant share are 40+ and are not confident with new apps.
- Many have been out of the dating world for a decade or more, and some have
  never used a dating app at all.

The consequence for the product: **every screen must be usable by someone who
is not technical, on a phone, without instructions.** Large targets, plain
language, no jargon, no hidden gestures, nothing that depends on knowing an app
convention.

## What Eraya is not

- Not a dating app. No swiping, no hearts, no "matches", no gamification.
- Not a matrimony site. No biodata, no caste or community filters, no family
  brokering, no marriage-outcome framing.

Both comparisons will be made by visitors anyway. The page's job is to make the
difference obvious within a few seconds of arriving.

## MVP scope

| Area | Decision |
| --- | --- |
| Country | India only. Country selection does not appear anywhere in the MVP. |
| Cities | Opens in a few cities first: Hyderabad, Delhi, Kolkata, Mumbai, Pune, Aizawl, Chennai. Held in the `cities` table, not in code — see [08-backend.md](08-backend.md). |
| Elsewhere in India | Waitlist. People outside the launch cities register interest and are told when Eraya reaches their city. |
| Verification | Phone and email, required. |
| Relationship verification | Deferred — handled later in the product flow, not at signup, and not described on the landing page. |

### Why a few cities

A relationship community is worthless when it is empty. Growing a handful of
cities to real density beats launching nationally into a directory of blank
profiles. This is stated plainly on the landing page because it also signals
that we are not chasing vanity growth.

## Who meets whom

Three rules decide it, and all three live in the database rather than in a screen.

**Mutual gender preference.** Everyone is asked who they hope to meet. Someone
appears in your introductions only if they match what you are looking for and you
match what they are -- a one-sided filter would keep showing you to people who
have already said they are not looking for someone like you. It is permissive
wherever either side has not answered, and for `prefer_not_to_say`: a strict
reading would make every member who declined to state a gender invisible to
everybody, which punishes the people most likely to have thought about it.

**Proximity orders, and never filters.** Same city first, then same state, then
everywhere else. Everyone stays reachable, so a member in a quiet town sees the
country rather than an empty screen. Within each band the order is a per-viewer
daily hash -- the same people in the same order all day, unrelated to anything
about them, rolling over at midnight. Refreshing is not a slot machine.

**Nobody is ranked.** There is no score, no attractiveness ordering, no
algorithmic matching. The filters -- age, city, language, chapter -- are free,
because they decide whether meeting someone is even practical and paywalling them
would make the free product deliberately worse rather than the paid one better.

## Product principles

1. **Trust precedes connection.** Verification, review and privacy are the
   preconditions for the rest of the product, not features layered on later.
2. **Consent is the default.** No one can open a conversation with a member who
   has not chosen to open it.
3. **A considered few, not an endless feed.** A limited set of relevant people,
   not an infinite list to work through.
4. **Reversible, not punishing.** A member can return to the previous profile in
   a session, free of charge.
5. **No engineered urgency.** No streaks, countdowns, expiring introductions, or
   "someone liked you" prompts designed to force an upgrade.
6. **No paywall before a first conversation.** Payment must never be the price of
   finding out whether there is anything to talk about.

## Built, and not built

**Built, on both clients:** accounts with Google, Facebook and email sign-in;
onboarding; profiles with optional photos; discovery with free filters and
paging; expressing interest; mutual connections; messaging; blocking; reporting;
account deletion. The mobile app (`apps/mobile`) additionally has the account
area, membership screen and photo management.

**Built but unreachable:** premium. Entitlements exist and are enforced in SQL,
the plans are priced, and the screen says plainly that it cannot be bought
because no payment provider is connected.

**Not built:** payments, push notifications, moderation tooling, identity or
relationship verification, real phone verification, Apple sign-in, and legal
privacy/terms documents.

**The rule that governs all of it:** nothing in the product claims a feature or a
process that does not exist. Phone verification is mocked, so no member is ever
shown a "phone verified" badge. There is no moderation team, so reporting says
the report is recorded and promises no review. Premium cannot be bought, so the
button says so rather than opening a flow. Empty screens say they are empty
rather than being padded with invented activity.

See `docs/MOBILE_SETUP.md` for what each unbuilt item needs and what it costs.
