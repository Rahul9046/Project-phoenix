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

Buyable on Android. Razorpay is integrated and a purchase completes end to end
— see [10-payments.md](10-payments.md) for the model; this section covers only
what the app itself does.

**Not buyable on iOS, and that is the only behavioural difference between the
two platforms.** `inAppPurchaseAvailable` is false there, the plans and the pay
button are replaced by a localized sentence, and Premium already paid for still
resolves exactly as it does anywhere else. Everything in the rest of this
section describes the Android path. See [16-ios.md](16-ios.md).

There is no native Razorpay module, deliberately. Buying opens `/checkout` on
the website in the system browser, the same way sign-in opens Google, and the
browser hands back to `eraya://payment`. Card details never touch this app, and
the only things crossing back are an order id and a signature that is useless
without the key secret.

That means the app must be told where the website is, through
`EXPO_PUBLIC_SITE_URL`. Unset, no payment sheet opens and nothing says why. A
dev client reads it from `.env.local`; **EAS builds do not**, and take it from
EAS environment variables instead. This is the one setting whose absence looks
identical to somebody choosing not to pay.

The app never concludes that a payment succeeded. It reports what it saw and the
server answers, from a signature check or from Razorpay's own record. Six
outcomes rather than a boolean, because money can leave an account while the
confirmation does not arrive: `unconfirmed` in particular is kept apart from
`failed` so a fault of ours is never described as somebody's bank declining.

Entitlements are read by name from the `entitlements` table, never inferred from
`tier === "premium"` in a component. The client decides what the UI offers; the
database decides what actually happens. `subscriptions` has no insert, update or
delete policy for anyone.

## Android permissions

`android.permissions` is `[]`, and `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` are
both in `blockedPermissions`.

The microphone was declared and used by nothing. On a product where people
decide whether to meet a stranger, an install screen asking for the microphone
costs trust and buys nothing, and "a library probably wanted it" is not a reason
a member ever hears. `blockedPermissions` keeps it out even if a future plugin
adds it back without anyone noticing.

`SYSTEM_ALERT_WINDOW` -- "Display over other apps" -- was blocked on
2026-10-31, after the first Google Play App Bundle was built and its manifest
actually read. React Native declares it in its **debug** source set
(`react-native/ReactAndroid/src/debug/AndroidManifest.xml`) for the redbox and
dev overlay, and it was reaching the release artifact because `expo-dev-client`
is a production dependency, so the dev launcher and its manifest get linked in.
Play accepts it without a declaration form, so nothing was broken -- but it
appears on the store listing, and a dating app asking to draw over other apps is
exactly the kind of thing the audience notices and nobody can justify.

**The merged manifest is the only place this is visible.**
`expo config --type introspect` cannot show it, because the Gradle manifest
merge is a build step. It was found with
`bundletool dump manifest --bundle <aab>`, which is now the documented check
before any upload -- see [Building the Google Play App Bundle](#building-the-google-play-app-bundle).

Blocking works by emitting `tools:node="remove"` for that permission, so the
merger drops whatever a library contributed. That it works here is not a
guess: `RECORD_AUDIO` is blocked the same way and is absent from the built
bundle's manifest.

The deeper fix is to move `expo-dev-client` to `devDependencies`, which would
take the dev launcher, its manifest and its code out of the release artifact
and shrink it. That changes the dependency graph and the local dev workflow, so
it is deliberately a separate decision from blocking one permission.

Photo access stays: `expo-image-picker` carries its own usage string and profile
photos need it. It contributes `READ_EXTERNAL_STORAGE` and
`WRITE_EXTERNAL_STORAGE`, both capped at `maxSdkVersion="32"`, so on Android 13
and later neither is requested at all and no `READ_MEDIA_IMAGES` appears --
which is why Play's Photo and Video Permissions declaration is not triggered.
Camera is deliberately absent: the app picks from the library and never captures
directly.

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

**Which till a build opens is decided by the build, not by the platform.**
`EXPO_PUBLIC_DISTRIBUTION` names the channel, `distribution.ts` turns it into a
provider, and `purchasing.ts` exports the one value every screen reads. The
APK here is `direct` and keeps Razorpay; the Google Play build is `play` and
sells nothing at all until Play Billing is finished. `Platform.OS` is the wrong
instrument for this and was replaced with it: both artifacts report `android`,
and the one the platform check would get wrong is this one, the public
download. See [10-payments.md](10-payments.md) for the table and the
Metro-cache hazard that goes with it.

**Play Billing itself lands on its own branch and has not landed.** That work
is `feature/play-billing-main-integration` (PR #152), open and unmerged, with
no purchase observed through it. The direct-distribution release must not take
a merge, rebase or cherry-pick from it. The two answer different questions --
this one is how a phone gets the app while Play's closed-testing period runs,
that one is how a Play-distributed build takes money -- and tying them together
would mean the download could not ship until billing was ready.

So a rebuild of the app is **not** a free act today, and it is a payments
decision rather than a distribution one. It is also not a prerequisite for
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

### Building the Google Play App Bundle

Play takes an `.aab`, not an APK, and it is built in the cloud rather than here
— EAS holds the upload key, and the artifact has to be signed with it.

```
cd apps/mobile
npx eas-cli@latest build --platform android --profile play \
  --non-interactive --freeze-credentials --clear-cache
```

Each flag is doing something:

- **`--profile play`** is the only profile that declares
  `EXPO_PUBLIC_DISTRIBUTION=play`, builds `app-bundle` rather than an APK, and
  resolves the `production` EAS environment so the Supabase URL, the
  publishable key and the site URL are the real ones. `npm run play:channel`
  prints what every profile resolves to.
- **`--freeze-credentials`** makes the build fail rather than create or change a
  keystore. Signing changes are never a side effect of asking for a build.
- **`--clear-cache`** because Metro's transform cache does not key on
  `EXPO_PUBLIC_*` values. EAS starts cold anyway, so this is belt and braces
  for the one failure mode that would silently produce a Play build pointed at
  Razorpay.
- **`autoIncrement` is off** on this profile. `appVersionSource` is `local`, so
  an increment would rewrite `app.json` mid-build and the versionCode Play
  received would not be the one in the commit. Set it in `app.json` by hand and
  push a commit for it.

`android/` is gitignored, so EAS prebuilds the native project from `app.json` in
the cloud. The stale `versionCode` in `android/app/build.gradle` is not what
reaches Play — `app.json` is. Confirm with
`npx expo config --type introspect` before building.

Verify the artifact before it goes anywhere near the Console:

```
unzip -p <aab> BUNDLE-METADATA/com.android.tools.build.gradle/app-metadata.properties
unzip -l <aab> | grep -o 'base/lib/[^/]*' | sort -u    # the ABIs inside
```

`base/manifest/AndroidManifest.xml` in an AAB is binary; read it with
`bundletool dump manifest` if the permission set matters, because the Gradle
manifest merge can add permissions no config file mentions.

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

**The Play build cannot carry this identity, and that is settled rather than
chosen.** Google Play rejects an upload signed with the Android debug
certificate, and `CN=Android Debug` with a SHA1withRSA signature is exactly
what this is -- a certificate shipped with the Android SDK, identical on every
machine, which anybody could sign as. So the question "can the existing key be
the Play upload key" has the answer no, and no decision had to be made to reach
it.

What follows from that:

- **Play App Signing holds the app signing key.** Google generates and keeps
  it; it is not in this repository and never will be.
- **The upload key is a separate, new key**, used only to prove an upload came
  from us. EAS Build manages one per project. Nothing about it touches
  `debug.keystore`.
- **`debug.keystore` is untouched and must stay so.** It is what keeps every
  sideloaded install upgradeable, and `npx expo prebuild` must not be run,
  because it can regenerate it.
- **The two channels have different certificates, so an install cannot cross
  between them.** Android refuses an update signed by a different key, so
  somebody running the eraya.app APK has to uninstall it before installing from
  Play, and the other way round. Nothing is lost by that -- profile, photos,
  connections and messages are all server-side, and only the session goes.
  Testers have to be told, because "update failed" is what it looks like
  otherwise.

Three certificates get confused here and are worth keeping apart:

| | Who holds it | What it signs |
| --- | --- | --- |
| Direct APK certificate | us, `debug.keystore` | the APK on eraya.app |
| Upload key | us, EAS-managed | the AAB we send to Play |
| App signing key | Google (Play App Signing) | what Play serves to devices |

See [07-open-questions.md](07-open-questions.md) for what is still open.

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
