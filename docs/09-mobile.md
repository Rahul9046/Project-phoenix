# The mobile app

`apps/mobile` — React Native via Expo, one codebase for Android and iOS.

Android is the first release target. Nothing here is Android-specific: every
platform difference is a `Platform.select` at the point it matters, and the iOS
paths are written even where they cannot be tested from a Windows machine.

**iOS has a document of its own: [16-ios.md](16-ios.md).** What the iOS build is
configured as, the one behaviour that differs between the platforms (Premium
cannot be bought there), and what has to happen before an iPhone can run it.

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
| Email code | Live — six digits, the primary path on mobile |
| Apple | **Not configured.** Needs a paid Apple Developer account, and may or may not be required at all -- [16-ios.md](16-ios.md) |
| Phone SMS | **Mocked.** See below |

There is no password field anywhere in this app, deliberately. OAuth opens the
provider in the system's own authentication browser (`openAuthSessionAsync`), so
credentials are typed into the browser's UI and never into a screen Eraya drew.

**Email sign-in is a code, not a link.** The link is still in the email and still
works where the browser cooperates, but a phone is where it does not: tapping it
opens a browser that has to hand `eraya://` back to the app, and Chrome blocks
launching an external app from a server redirect without a user gesture, harder
still in incognito. The failure is a blank tab with nothing to act on. Six digits
typed into the app need no browser at all, and work when mail is read on a
different device from the one holding the app.

Supabase can still return a session in two shapes and both are handled: a PKCE
`code` in the query string, and `access_token`/`refresh_token` in the fragment.
Handling only one is why every magic link failed on the web app for a day.

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
| `discover_members` | Introductions: mutual gender preference, nearest first, free filters, paging |
| `genders_are_compatible` | The mutual preference rule, in one place |
| `member_profile` | One member |
| `member_photos` | Every photo of one member. Separate from the card on purpose |
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

## When something throws

`app/_layout.tsx` exports an `ErrorBoundary`, which Expo Router picks up by name.

Without one, a render error takes the whole app down — on Android it simply
closes, with no message, no way to report it and nothing to distinguish a crash
from the OS killing a background process. That is exactly what "the app suddenly
closes after I sign in" looked like from the outside, and it made the problem
undiagnosable rather than merely present.

It cannot catch a native crash. It catches every JavaScript error thrown while
rendering, which is nearly all of them, and shows the message with a retry.

The same principle runs through `SessionProvider`: the profile read is bounded at
ten seconds and wrapped, and a failure sets an error that clears `loading`.
Without that last part the timeout would change nothing, because `loading` is
true whenever a session exists and a profile does not.

**Nothing in this app may wait indefinitely.** Three separate unbounded waits —
the profile read, the entry screen, the splash — each produced the same
symptom: a logo, for ever.

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

no swiping · no endless feed · no photos required · no one-sided preference · no read receipts · no typing
indicators · no unread counts shown to a sender · no streaks · no reply nudges ·
no push notifications · no "single" · no city gate · no ranking by attractiveness
· no invented counts or activity

`messages` has no `read_at` column so that read receipts cannot be added
carelessly. Unread is a per-participant marker on the connection: "what have I
not read" is a fact about me; "has she read it" is a fact about her disclosed to
someone else.

## Membership

Two ways to pay and one refusal, chosen by the build rather than by the
platform. See [10-payments.md](10-payments.md) for the model and
[14-google-play.md](14-google-play.md) for Play's own surface; this section
covers only what the app itself does.

**Buyable on the Android download, through Razorpay.** Integrated, and a purchase
completes end to end. This is the artifact the public is running, it is
sideloaded rather than distributed by Play, and nothing in the Play work changes
it.

**Buyable in the Play build, through Play Billing** -- and never through
Razorpay. Not yet provable: no Play purchase has been made. See
[14-google-play.md](14-google-play.md).

**Not buyable on iOS at all.** `inAppPurchaseAvailable` is false there, the plans
and the pay button are replaced by a localized sentence, and Premium already paid
for still resolves exactly as it does anywhere else. See [16-ios.md](16-ios.md).

Which of the three a build is, is decided by `EXPO_PUBLIC_DISTRIBUTION` and the
platform together, through `paymentProvider` --
[10-payments.md](10-payments.md#android-is-two-artifacts-not-one).

`purchase()` in `features/membership/payments.ts` is the seam. It switches on
`paymentProvider` from `features/membership/purchasing.ts`, exhaustively, so a
fourth provider cannot be added to the type without this function failing to
compile. It is not `Platform.OS`: that cannot tell the Android download from the
Play build, and pointing the download at Play Billing would break purchasing for
every install the public already has. **The Play build never falls back to
Razorpay** -- if Play cannot sell, `purchase()` returns `unavailable` or
`unconfigured` and no sale happens, because quietly opening a web checkout is
the one thing Play's payments policy forbids.

**iOS: Razorpay, in the browser.** No native Razorpay module, deliberately.
Buying opens `/checkout` on the website in the system browser, the same way
sign-in opens Google, and the browser hands back to `eraya://payment`. Card
details never touch this app, and the only things crossing back are an order id
and a signature that is useless without the key secret.

That path must be told where the website is, through `EXPO_PUBLIC_SITE_URL`.
Unset, no payment sheet opens and nothing says why. A dev client reads it from
`.env.local`; **EAS builds do not**, and take it from EAS environment variables
instead. This is the one setting whose absence looks identical to somebody
choosing not to pay. It is not on the Android purchase path at all.

**Android: Google Play Billing, natively.** `expo-iap` 5.8.2, with the whole
client in `features/membership/play-billing.ts`. The static import is safe on web
and iOS because the native module sits behind a lazy proxy -- proven by exporting
both bundles, not assumed.

Prices on Android are **Google's own localised strings**, read from Play.
Premium's paise figure from the catalogue is the fallback. Play takes the money
and applies its own tax handling, so showing Eraya's figure beside a sheet that
says something else would make us the ones who were wrong. Display only: a term
is granted on what the server verifies, never on anything a price string says.

The Play product ids come from `membership_plans`, and which of a plan's two
columns applies is taken from the catalogue's `introApplies` -- the server's
answer about this member's history, not a rule reimplemented here. The client
never invents, chooses or edits an id.

The app never concludes that a payment succeeded. It reports what it saw and the
server answers -- from a signature check, from Razorpay's own record of the
order, or, on Android, from the Android Publisher API. **Seven** outcomes rather
than a boolean, because money can leave an account while the confirmation does
not arrive:

- `unconfirmed` is kept apart from `failed`, so a fault of ours is never
  described as somebody's bank declining.
- `unconfigured` is Android-only and means a plan has no Play product to sell, so
  **nobody was charged**. The button disables and the screen says purchases are
  temporarily unavailable rather than inviting a second attempt that cannot work.
  This is the state every plan is in today, because the Play products do not
  exist yet.

Neither is recorded as `payment_failed`: Eraya's own bugs and Eraya's own
unfinished configuration must not appear in the number that judges a provider.

A Play purchase can also arrive when nobody is waiting for it -- the app killed
between the sheet closing and verification, or a deferred payment settling later.
A `purchaseUpdatedListener` runs for the life of the process rather than the life
of a screen, and `recoverPlayPurchases()` sweeps on the membership screen for
anything left unverified. Play keeps handing such a purchase back until it is
consumed and Google refunds it after three days, which is what makes the sweep
worth having. Whether it should also run at launch is an open question.

**No Play purchase has ever been executed** -- not on a device, not by a licence
tester. The Android client is written and bundles cleanly; that is all that has
been established.

Entitlements are read by name from the `entitlements` table, never inferred from
`tier === "premium"` in a component. The client decides what the UI offers; the
database decides what actually happens. `subscriptions` has no insert, update or
delete policy for anyone.

## Android permissions

`android.permissions` is `[]` and `RECORD_AUDIO` is in `blockedPermissions`.

That describes what `app.json` declares, not the whole merged manifest.
`expo-iap` carries `com.android.vending.BILLING` in its own library manifest, and
Gradle merges library manifests at build time, so the built app is **expected** to
request it. Introspection shows nothing that would strip it -- an empty
`android.permissions` produces no blanket removal, and only `blockedPermissions`
emits a removal node. But **no build has been produced and `prebuild` has not been
run**, so the merged manifest has not been observed. Expected, not verified.

The microphone was declared and used by nothing. On a product where people
decide whether to meet a stranger, an install screen asking for the microphone
costs trust and buys nothing, and "a library probably wanted it" is not a reason
a member ever hears. `blockedPermissions` keeps it out even if a future plugin
adds it back without anyone noticing.

Photo access stays: `expo-image-picker` carries its own usage string and profile
photos need it. Camera is deliberately absent -- the app picks from the library
and never captures directly.

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

## Distribution

**Downloaded directly from eraya.app, publicly, while Google Play's mandatory
closed-testing period runs in parallel.** The two are independent: neither is
waiting on the other. This is temporary, and the end state is the website
pointing at a public Play listing instead.

Current shipped build: **v0.1.2, versionCode 3**. `apps/mobile/app.json` is at
versionCode 4, which is the next build rather than a released one -- the website
shows the *published* version and says so.

Version lives in `app.json` (`expo.version`, `expo.android.versionCode`) and
never in `build.gradle`. `apps/mobile/android/` is gitignored and generated.

### Where the bytes are

A GitHub release of this repository. Not a new hosting provider: the same
repository and account already build and deploy the site through GitHub Actions,
and release assets are free, public, served from GitHub's CDN and capped at
2 GiB.

The APK cannot live in `apps/web/public/`. The site is a Cloudflare Worker whose
static output is uploaded as Workers Assets, which refuses any single file over
25 MiB; the APK is 62.6 MiB, so dropping it there would not make a slow download
-- it would make `npm run cf:deploy` throw `Asset too large` and stop the whole
site shipping. `.gitignore` has excluded `*.apk` since the first Android build,
because an APK is a build output and a 60 MB binary per release would be in the
history for ever.

`apps/web/src/app/downloads/[file]/route.ts` 302s to the release asset rather
than streaming it through the Worker, so GitHub's CDN keeps doing ranges,
resumption and edge caching. The audience is on Indian mobile data; resumable is
not a nicety.

### The website side

One file decides everything:
`apps/web/src/features/marketing/android-app.ts`.

| Thing | Where |
| --- | --- |
| Which release the APK comes from | `release` |
| Where the CTA points | `androidCta` |
| The public download addresses | `downloads` |
| CTA, install steps, the Android-only line | `marketing.androidApp.*`, six locales |

Three surfaces read `androidCta` and nothing else knows a URL: a button in the
hero, the homepage card (`sections/AndroidApp.tsx`), and the standalone
`/download` page. The footer links `/download` from every page.

`release` and `androidCta` are deliberately **separate switches**. `release`
says which APK the `/downloads/*` addresses resolve to; `androidCta` says where
the website's button sends somebody. Those addresses were promised to people --
they are in Instagram bios and WhatsApp messages nobody gets to go back and edit
-- so they keep answering after the button has moved to Play.

**Shipping a new build is: publish the GitHub release first, then point
`release` at it.** In that order. While the two disagree the site offers a
download that 404s.

### What a visitor is told

No device sniffing, on purpose -- it cannot be wrong, it tells a desktop visitor
something useful, and the page is server-rendered on a Worker with a 10 ms CPU
budget it has already exceeded once. One unconditional sentence does the work:

> The app is currently available on Android. You can also use Eraya in your web
> browser.

An iPhone is never offered an APK as though it would install, and nothing is
promised about when one might be.

**That sentence states the current position and commits to nothing, and both
halves are deliberate.** Two earlier versions did more than that. The first --
*"Android only for now. On an iPhone or a computer, Eraya works in your
browser"* -- named the iPhone and the browser in one breath and read, to some
people, as though the download were an option there. The second fixed that and
said *"iOS is coming soon"*, which promised a release the product has not
planned: there is still no StoreKit work and no iOS in-app purchase path, and
[10-payments.md](10-payments.md) notes Apple generally requires its own billing
for digital goods.

**That sentence does not change because an iOS build is being prepared.** No
iOS build has been signed, uploaded or installed, and the website may only
describe what somebody can actually get hold of today. It changes when there is
a TestFlight or App Store link to put behind it, and not before.

**No timeline belongs in this sentence, in any language.** Not "coming soon",
not "we are working on iOS", not "available soon", and not a softer synonym. A
date the product has not committed to is the same class of claim as a trust mark
the system has not earned -- the thing this codebase refuses everywhere else. If
iOS is decided, the sentence changes because the fact changed.

`/download` carries three sentences about the install, because the unfamiliar
part of a direct install is a system dialog that appears after the download. It
says the permission Android asks for is about **this one install**. It does not
tell anybody to switch on installing from unknown sources and leave it on, and
must never be edited to. `/beta` was the old address and 308s to `/download`.

### Payments in a directly distributed build

Unchanged from [the Membership section above](#membership): the app opens
Razorpay checkout on the website in the system browser, and that works in a
directly installed build exactly as it does anywhere else. Being sideloaded
changes nothing about it, and no Play policy applies to a build Play is not
distributing.

**Play Billing no longer changes this part, and that is the point of how it was
integrated.** The Play work used to live apart on `feature/play-billing-phase-2a`
precisely because it would have switched this artifact's checkout. It no longer
would: the two are separate builds of the same source, distinguished by
`EXPO_PUBLIC_DISTRIBUTION`, and this one does not set it. The APK published here
takes Razorpay, as it always has, whatever the Play build does.

Since the five Play products do not exist yet, Premium is unbuyable in the **Play
build** with an honest disabled state rather than a broken checkout. That state
is unreachable here, where a selected plan is always buyable.

So a rebuild of the app is still **not** a free act, but it is no longer a
payments decision. It is also not a prerequisite for
anything here: the website ships against the APK already published, and that
artifact is unchanged -- same signing identity, same `app.eraya.mobile`, same
`versionCode`.

### Building a release APK

```
cd apps/mobile/android
JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2 \
  ./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
```

Three things in that command are load-bearing, and none of them is discoverable
from the repository.

**JDK 17, not whatever `java` resolves to.** Android Studio's bundled JBR is
25 and the build fails on it. Gradle's toolchain provisioning has already
downloaded Adoptium 17 into `~/.gradle/jdks/`.

**`-PreactNativeArchitectures` is not optional.** `gradle.properties` lists all
four architectures, so a plain `assembleRelease` produces a **universal** APK --
115 MB against 65.7 MB, because it carries `x86` and `x86_64` slices that exist
only for emulators. That is 49 MB of nothing on a public download link, paid for
on mobile data by an audience that is entirely on ARM phones. v0.1.2 was built
ARM-only from the command line and left no trace of it in the repository, which
is exactly how v0.1.3 nearly shipped at 115 MB. Build the universal APK only
when something has to run on an emulator, and never publish it.

**`android/` is gitignored**, so `app.json` and the native project drift. The
version has to be set in both -- `app.json` for the JS side and
`versionCode`/`versionName` in `app/build.gradle` for the APK -- and
`npx expo prebuild` must **not** be used to reconcile them, because it can
regenerate `debug.keystore` and strand every existing install. Edit the two
files.

Confirm what was built before publishing it:

```
aapt2 dump badging <apk> | head -1        # package, versionCode, versionName
unzip -l <apk> | grep -o 'lib/[^/]*' | sort -u   # the ABIs actually inside
```

### Signing

`apps/mobile/android/app/build.gradle` points the `release` build type at
`signingConfigs.debug`, which is the Expo bare template's default, so a release
APK carries the universal `CN=Android Debug` certificate from
`apps/mobile/android/app/debug.keystore`.

**That identity must be preserved.** Android will not install an update signed
by a different key over an existing install, so it is what keeps everybody
already running Eraya upgradeable -- and offering the download publicly raises
the stakes on that rather than changing the rule: the set of installs a key
change would strand is now open-ended rather than a tester list. The keystore is
backed up locally and off-device.

Verify before distributing any build:

```
apksigner verify --print-certs <apk>
```

Anything other than the expected certificate must not go to existing installs.

**Play App Signing and an upload key still have to be set up, and what identity
the Play build will carry is deliberately undecided.** Nothing in this
repository depends on the answer. See
[07-open-questions.md](07-open-questions.md).

### Switching the website to Google Play

When the public listing exists, replace one object in `android-app.ts`:

```ts
export const androidCta: AndroidCta = {
  kind: "play",
  href: "<the public listing URL>",
  version: null,
};
```

Nothing else changes anywhere. The install steps, the version line and the
"what to expect" link are already conditional on `kind` and disappear with the
direct channel; the Android-only sentence stays, because it is still true. The
`/downloads/*` addresses go on answering.

**No Play URL is written down today, not even a guessed one.** A store link that
404s is worse than a direct download that works.

## Checks before a phase is done

```
cd apps/mobile
npx tsc --noEmit
npx eslint .
npx expo export --platform android     # and --platform ios
node ../../scripts/security-probe.mjs
```

And from the repository root, for anything touching the iOS build:

```
npm run i18n:check
npm run ios:probe
```

And then look at it. A screen is not finished because TypeScript is happy: the
build that passed every check still had a clipped call to action, a tab label two
points too wide, four rows unreachable by a screen reader, and an infinite
redirect loop that rendered as a blank page.
