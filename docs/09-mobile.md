# The mobile app

`apps/mobile` — React Native via Expo, one codebase for Android and iOS.

Android is the first release target. Nothing here is Android-specific: every
platform difference is a `Platform.select` at the point it matters, and the iOS
paths are written even where they cannot be tested from a Windows machine.

## Running it

```
cp apps/mobile/.env.example apps/mobile/.env.local   # fill in from Supabase
npm install
npm run mobile                                        # or: cd apps/mobile && npx expo start
```

Press `a` for an Android device or emulator, `i` for iOS, `w` for the browser.

**Expo Go cannot complete a sign-in.** Supabase refuses `exp://` redirects, and
correctly -- that scheme belongs to Expo Go, which every Expo project on the
device shares. Expo Go is fine for looking at screens; using the app needs a
development build, which registers `eraya://`. See `docs/MOBILE_SETUP.md` §2.

The web target is a development convenience, not a product. Eraya's web product
is the Next.js app; `expo start --web` exists here so mobile layouts can be
inspected at a phone viewport without a device attached. Two things behave
differently there and both are documented where they happen: the session lives in
memory rather than the keystore (`secure-storage.ts`), and the Supabase client
reads the session out of the URL, which is exactly what that option is for in a
browser (`client.ts`).

One React across the workspace, deliberately: `apps/mobile` pins the same
19.2.8 the web app does, rather than the 19.2.3 Expo suggests, because
`react-native@0.86`'s peer range accepts both and two Reacts in one workspace is
the classic cause of "Invalid hook call" on a device. The pin is recorded in
`expo.install.exclude` so `expo install --check` stops asking.

## Layout

```
apps/mobile/
  app/                  routing only -- a file here exists to define a screen
    _layout.tsx         fonts, session provider, deep links
    index.tsx           decides where someone belongs and sends them there
    sign-in.tsx         one screen for signing in and signing up
    onboarding/         one question per screen
    (tabs)/             the signed-in app
    member/[id].tsx     a profile, and where interest is expressed
    messages/[id].tsx   a conversation
    you/                the account area
    interests.tsx       who expressed interest (premium)
  src/
    theme/              colours, spacing, radii, type -- the only source of them
    brand/              the approved mark, as vector
    ui/                 the primitives every screen composes from
    features/           auth, onboarding, members, discovery, connections,
                        membership, account
    lib/supabase/       client, secure storage, generated types
```

`app/` is routing and nothing else. Anything reusable lives beside the feature
that owns it, and moves to `src/ui` only when a second feature genuinely needs
it. The web app is organised the same way for the same reason.

## Navigation

Expo Router, file-based, with typed routes on — a mistyped path is a build error
rather than a blank screen.

Five tabs, chosen so each answers a different question: **My Eraya** (what
matters today), **Discover** (who might I meet), **Connections** (who have I
met), **Messages** (what has been said), **You** (my account).

Every redirect comes from one function, `nextRouteFor` in
`features/auth/routing.ts`. Scattering "if no city, go to the city screen"
through the screens is how two of them end up disagreeing and someone bounces
between them — which happened during this build and rendered as a blank screen.
The rule now lives in one place, and callers wait for `loading` rather than
deciding on a half-resolved state.

## Authentication

| Method | State |
| --- | --- |
| Google | Live |
| Facebook | Live |
| Email link | Live |
| Apple | **Not configured.** A release blocker for iOS, not for Android |
| Phone SMS | **Mocked.** See below |

There is no password field anywhere in this app, deliberately. OAuth opens the
provider in the system's own authentication browser (`openAuthSessionAsync`), so
credentials are typed into the browser's UI and never into a screen Eraya drew.

Supabase can return a session in two shapes and both are handled: a PKCE `code`
in the query string, and `access_token`/`refresh_token` in the fragment. Handling
only one is why every magic link failed on the web app for a day.

**Sessions live in the platform keystore** — Keychain on iOS,
EncryptedSharedPreferences on Android — not in AsyncStorage, which is an
unencrypted file. SecureStore caps a value at 2048 bytes and a session is bigger,
so values are chunked with the header written last: an interrupted write reads
back as absent rather than corrupt.

## Talking to Supabase

The same project as the web app. No second database, no mobile-only table, and no
rule duplicated into a client.

Everything about another member goes through a `security definer` function.
There is no `select * from profiles` in this app and there must not be:
`member_card` is the privacy boundary, and a client that queried the table would
be relying on RLS to hide columns rather than on a function never to return them.

| Function | What it is for |
| --- | --- |
| `discover_members` | Introductions, with the free filters and paging |
| `member_profile` | One member |
| `express_interest` | Records a decision and creates the connection atomically |
| `interests_received` / `_count` | Premium list, and the honest count for everyone |
| `revert_last_pass` / `reverts_remaining` | Undo, with the allowance counted in SQL |
| `my_conversations` | The inbox, in one query rather than an N+1 |
| `mark_conversation_read` | Writes only the caller's own read marker |
| `home_summary` | Four real counts in one call |
| `search_cities` / `city_coverage` | Public: onboarding needs them before sign-in |
| `delete_my_account` | Self-deletion; the id comes from the session, not an argument |

## State

No state library. There are three kinds of state and each has an obvious home:

**Who is signed in** — `SessionProvider`, one subscription, one profile fetch per
sign-in. Every screen reads from it.

**Server data** — fetched in the screen that shows it, with cancellation on
unmount. Data functions return data; components own their state. There is no
cache layer, because almost every screen wants fresh data on focus and a stale
list of people is worse than a short wait.

**Form state** — local, initialised from loaded data at mount rather than copied
in by an effect. `you/edit.tsx` waits for its data and then mounts the form,
which removes both the flash of empty fields and the race where typing is
overwritten by a late response.

## Design system

`src/theme/tokens.ts` mirrors `apps/web/src/app/globals.css` value for value.
**No screen may write a raw hex or a raw pixel number.** Colours are named by
role, spacing by intent (`space.section`, not `32`).

Type is Manrope, the web's typeface, at the same four weights, with absolute
line heights so iOS and Android share one rhythm. `theme/typography.ts` is the
only place a family name is written -- screens choose a variant from the scale,
never a font.

The mark is copied byte-for-byte from `apps/web/src/shared/brand/mark.ts` and
rendered as vector. The launcher and splash icons are the approved SVGs
rasterised. Nothing is redrawn.

Three rules the primitives enforce, because the prototype broke all three:

- A button's height comes from the touch-target scale, never from padding
  arithmetic. Every variant clears 44pt; the standard is 54.
- A label shrinks rather than truncates, and horizontal padding is generous and
  independent of height.
- Depth comes from a hairline border, not a drop shadow. Shadows are for things
  that genuinely float.

## What the product does not do

Written down because each is a decision, not an omission:

no swiping · no endless feed · no photos required · no read receipts · no typing
indicators · no unread counts shown to a sender · no streaks · no reply nudges ·
no push notifications · no "single" · no city gate · no ranking by attractiveness
· no invented counts or activity

`messages` has no `read_at` column so that read receipts cannot be added
carelessly. Unread is a per-participant marker on the connection: "what have I
not read" is a fact about me; "has she read it" is a fact about her disclosed to
someone else.

## Membership

Priced and unbuyable. No payment provider is integrated, so the screen says so
rather than offering a button — and never simulates a success.

Entitlements are read by name from the `entitlements` table, never inferred from
`tier === "premium"` in a component. The client decides what the UI offers; the
database decides what actually happens. `subscriptions` has no insert, update or
delete policy for anyone.

## Photos

Optional, and a profile without one is complete — the monogram is a first-class
presentation, not a placeholder.

Before a file leaves the phone it is resized to 1400px and re-encoded as JPEG.
That is partly about size, and mostly about EXIF: a photo from a camera roll
usually carries the GPS coordinates of where it was taken, frequently somebody's
home, and re-encoding strips it.

The bucket is private. Uploads are constrained to a folder named for the owner's
id by the storage policies, reads are refused between members who have blocked
each other, and clients read through signed URLs that expire in an hour.

## The demo environment

```
node scripts/demo-seed.mjs                    # six fictional members
node scripts/demo-seed.mjs --interest <email> # have them express interest in you
node scripts/demo-seed.mjs --link <email>     # a sign-in link for a demo member
node scripts/demo-seed.mjs --remove           # delete every one of them
```

Every address is at `@demo.eraya.invalid`. `.invalid` is reserved by RFC 2606 and
can never resolve, so none of them can receive mail or be mistaken for a real
member — and it is what makes `--remove` able to find them all.

`--interest` is what makes the mutual connection testable: say yes to one of them
and the connection forms immediately, because their half already exists.

## Security

```
node scripts/security-probe.mjs
```

Takes two members' real tokens, talks to PostgREST directly, and tries what the
product forbids — reading another profile, forging interest, messaging without a
connection, granting itself premium, reaching around a block. Seventeen checks.

It earns its place: it found six functions reachable without a session, one of
them a write. The cause is a Postgres default worth remembering — `create
function` grants EXECUTE to PUBLIC, `anon` inherits it, and `revoke ... from
anon` removes a grant `anon` never separately held. **Revoke from `public`, then
grant to `authenticated`.**

## Checks before a phase is done

```
cd apps/mobile
npx tsc --noEmit
npx eslint .
npx expo export --platform android     # and --platform ios
node ../../scripts/security-probe.mjs
```

And then look at it. A screen is not finished because TypeScript is happy: the
build that passed every check still had a clipped call to action, a tab label two
points too wide, four rows unreachable by a screen reader, and an infinite
redirect loop that rendered as a blank page.
