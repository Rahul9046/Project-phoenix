# iOS

`apps/mobile` already builds for iOS. This document is about everything around
that: what the iOS build is configured as, what it deliberately cannot do, and
what still has to happen before anybody can install it on an iPhone.

**Nothing here has run on an iPhone.** No iOS build has been produced, signed,
uploaded or installed, and no Apple Developer membership exists. Every claim
below is either a configuration fact that can be checked on a Windows machine
or an explicitly marked prerequisite. The difference matters, so it is marked
rather than blurred.

```
npm run ios:probe          # the whole contract, including the generated Info.plist
npm run ios:probe:fast     # the same, without running the config plugins
```

## Where the configuration lives

`apps/mobile/app.json`, and nowhere else. `apps/mobile/ios/` and
`apps/mobile/android/` are both gitignored and generated — this is a
Continuous Native Generation project, so there is no Xcode project to edit and
no `Info.plist` in the repository to hand-edit. Every iOS setting below is an
`app.json` key or a config plugin option, and the way to see what it produces
is to ask Expo rather than to reason about it:

```
cd apps/mobile
npx expo config --type introspect --json     # the Info.plist, after plugins run
```

That command is what settled three of the decisions on this page, and
`ios-probe.mjs` asserts against its output rather than against our reading of
any plugin's source.

## Identity

| Thing | Value | Why |
| --- | --- | --- |
| Bundle identifier | `app.eraya.mobile` | The same string as the Android package. One product, two stores |
| Display name | Eraya | `CFBundleDisplayName` |
| Marketing version | `0.1.5` | `expo.version`, shared with Android's `versionName`. The iOS build is the same release, not a different one. `ios-probe.mjs` asserts the generated `CFBundleShortVersionString` matches |
| Build number | `1` | `ios.buildNumber`. The first iOS build of anything |
| URL scheme | `eraya` | `eraya://auth` and `eraya://payment`. Registered app-wide, so both platforms get both |
| Orientations | Portrait | No landscape is declared |

**The bundle identifier already existed.** It was not chosen as part of this
work and must not be changed: an identifier is claimed once in App Store
Connect and a later change means a new application record, a new TestFlight
build history, and no upgrade path for anybody who had installed the old one.

**`supportsTablet` is `false`.** This is an iPhone app. Five tabs and a
portrait phone layout are not an iPad design, and declaring tablet support is
a promise to App Review that they are — it also makes iPad screenshots a
condition of submission. Nothing stops it running on an iPad in compatibility
mode; the app simply does not claim to be designed for one.

## The icon, and why iOS has its own

`assets/icon.png` is a rounded terracotta tile with transparent corners. That
is correct for Android's legacy launcher icon and wrong for iOS twice over:

Apple refuses an alpha channel in the large app icon outright. Expo resolves
that during prebuild by compositing the source onto **white** — so the corners
the artwork rounds off would come back white, sitting just outside iOS's own
superellipse mask. Whether that shows as a white halo depends on whether the
artwork's corner radius happens to be larger than Apple's, which is not a thing
to leave to chance on the first screen anybody sees.

So `ios.icon` points at `assets/ios-icon.png`: 1024×1024, square, full-bleed
`#BD4F33`, written as PNG colour type 2 so that "has no transparency" is a
property of the file format rather than of its contents. iOS does the rounding,
which is what it wants to do anyway.

The mark inside is the same artwork, pixel for pixel — the two files differ
only in the 17.1% of pixels that were transparent. `assets/icon.png` is
untouched and is still what Android and the web target use.

## Permissions

The build asks for photo library access and nothing else.

That is not the default. `expo-image-picker`'s config plugin adds
`NSCameraUsageDescription` and `NSMicrophoneUsageDescription` unless each is
explicitly switched off, and `expo-secure-store`'s adds
`NSFaceIDUsageDescription`. All three were being generated, and all three are
for capabilities this app has never used: it picks from the library and never
captures (`launchCameraAsync` appears nowhere), it records no audio, and it
never passes `requireAuthentication` to SecureStore.

```json
["expo-image-picker", { "photosPermission": "...", "cameraPermission": false, "microphonePermission": false }]
["expo-secure-store", { "faceIDPermission": false }]
```

The reasoning is the one already written down for Android's microphone: on a
product where people decide whether to meet a stranger, a permission the app
does not use costs trust and buys nothing, and "a library probably wanted it"
is not a reason a member ever hears. Here it costs more than trust — every
declared string is something App Review asks about and something a member is
shown in the iOS privacy report.

### What this does to Android

`cameraPermission: false` also blocks `android.permission.CAMERA`, which
`expo-image-picker`'s own `AndroidManifest.xml` merges in. The published
v0.1.3 APK declares it — `python -c` over its binary manifest confirms
`android.permission.CAMERA` is there — so a future Android rebuild would
declare one permission fewer.

That is a strict reduction and no behaviour changes with it: nothing in the app
calls `launchCameraAsync` or `requestCameraPermissionsAsync`, and
`launchImageLibraryAsync` does not need the permission. The published APK is a
built artifact and is not affected at all. Said here because it is the one
Android-visible consequence of an iOS change, and it should not be discovered
by someone diffing a manifest later.

## Premium cannot be bought on iOS

**This is the one behavioural difference between the two platforms.**

Android opens the website's Razorpay checkout in the system browser and comes
back through `eraya://payment`. That is a web checkout for a digital good, and
Apple's Guideline 3.1.1 does not permit one — 3.1.1(a) does not permit pointing
somebody at one either, which rules out the "buy it on our website" workaround
as well. Carrying the Android path across would not produce a working purchase
on iOS; it would produce a rejected binary.

So iOS sells nothing, and says so.

One value decides it, `apps/mobile/src/features/membership/purchasing.ts`:

```ts
export const inAppPurchaseAvailable: boolean = Platform.OS !== "ios";
```

`Platform.OS` and not a flag, for the reason the Play Billing branch dispatches
on the platform too: this is a property of the store the build is distributed
through, not a preference anybody might reasonably want to switch. A flag can
be set wrong, inherited from a stale environment, or left on after a test, and
the cost of being wrong here is a rejected submission rather than a bug.

Four layers read it, because one would be enough right up until somebody added
a second buy button:

| Layer | What it does on iOS |
| --- | --- |
| `purchase()` in `payments.ts` | Returns `{ status: "unsupported" }` before an order is created and before any browser could open |
| `app/you/membership.tsx` | Renders `<Unavailable />` where the plans and the pay button were, and does not even fetch the price list |
| `app/payment.tsx` | Redirects to the membership screen. `eraya://payment` can only be reached by typing it |
| `scripts/ios-probe.mjs` | Asserts all of the above, including that each guard is written *before* the call it guards |

`unsupported` is its own outcome rather than reusing `unavailable`, which means
a checkout that failed to open and would invite a retry. Nothing was attempted
here, nothing could have been charged, and no analytics event fires — a
platform that cannot sell Premium should not open a funnel it cannot close.

### What a member sees

`membership.notAvailableTitle` and `membership.notAvailableBody`, in all six
languages:

> **Premium is not available here**
> Premium cannot be bought in the Eraya app for iPhone. Nothing else changes —
> everything listed below is free, exactly as it has always been.

A sentence in a card, not a disabled button — a disabled button reads as a
fault somebody might retry. No price, because quoting one and then refusing to
take it is worse than quoting none. No timeline, because the product has not
committed to one, and the rule the website's Android-only sentence is held to
applies here for the same reason. And no way out to another checkout.

Everything else on the screen is unchanged: what Premium adds is still
described, what is always free is still named by name, and the payment history
is still there.

### Premium that was already paid for still works

Entitlements are read from the server by name — `entitlements.ts` and
`my_membership()` — and there is no platform term anywhere in that path. A
member who bought three months on the website or on Android gets exactly those
three months on an iPhone, with `revertLimit` and the rest resolving the same
way. Withdrawing the till is not withdrawing the thing that was bought.

### StoreKit is not started

Deliberately. It needs App Store Connect products, a paid Apple Developer
membership, and a server that can verify an Apple receipt the way
`payments-verify` verifies a Razorpay signature. None of those exist, and all
of them are a payments decision rather than part of getting the app onto a
phone. The probe asserts no in-app-purchase dependency has been added.

Nothing about web or Android payments changed. `payments-create-order`,
`payments-verify`, `payments-webhook`, the schema, the entitlement model, the
stacking rules, the prices and the website's `/checkout` are all exactly as
they were, and the probe asserts the Razorpay call Android uses is still where
it was.

## Authentication

The same code as Android, and it was already written for iOS.

| Method | On iOS |
| --- | --- |
| Email code | Works. Six digits, the primary path, and no browser involved |
| Google | Configured on Supabase; **not yet proven from an iOS build** |
| Facebook | **Off at the project** since 2026-11-25 — the Meta app is in Development mode. Never proven on any platform |
| Apple | **Not configured.** See below |
| Phone SMS | Not asked for, on either client |

`openAuthSessionAsync` uses `ASWebAuthenticationSession` on iOS, which is the
right primitive: credentials are typed into the system's own authentication UI
and never into a screen Eraya drew, and it shares the system cookie jar. The
PKCE `code` and the `access_token`/`refresh_token` fragment are both handled,
and the double-delivery race between the browser session resolving and the deep
link arriving is already claimed by URL — none of which is Android-specific.

Sessions live in the **iOS Keychain** via `expo-secure-store`, chunked at 1800
bytes with the header written last, so an interrupted write reads back as
absent rather than corrupt. Nothing about that is platform-conditional.

### The one manual step

`eraya://auth` has to be on the allow list in the Supabase dashboard under
**Authentication → URL Configuration → Redirect URLs**. It is the same string
the Android build uses, so if Android sign-in works today this is already done
— but it is the single thing that would make every OAuth sign-in on iOS fail
with an error instead of a session, and it cannot be verified from here.

Nothing in this work changed any Supabase setting, and nothing should: the
project is shared with the live web and Android products and has no staging.

### Sign in with Apple is an open policy question

Guideline 4.8 requires an app that offers a third-party login service to also
offer a login option that limits data collection to name and email, lets the
member keep their email private, and does not track them for advertising.
Eraya offers Google, so 4.8 applies. Facebook was switched off on 2026-11-25
and does not change this: one third-party login service is enough to trigger
the guideline.

Email code sign-in does not reliably satisfy it, and an earlier version of this
page said "plausibly" where it should have said "probably not". Of the three
criteria, two are comfortable and one is not:

| Criterion | Email code |
| --- | --- |
| Limits collection to name and email | Yes — it collects an address and nothing else |
| Does not track for advertising | Yes — Eraya ships no tracking SDK at all |
| **Lets the member keep their email address private** | **No.** That criterion describes Hide My Email. Eraya's own sign-in cannot offer privacy *from Eraya* |

None of 4.8's five exceptions apply either. The nearest — "your app
*exclusively* uses your company's own account setup and sign-in systems" — fails
on the word exclusively, because Google is offered too.

**So the strategy chosen in Stage 5A is to keep Google and email and add Sign in
with Apple.** It is not implemented end to end here because it cannot be: Sign
in with Apple needs a Service ID, a key and a team identifier from a paid Apple
Developer account, and Supabase's Apple provider stays `enabled = false` until
those exist. What Stage 5B did build is everything that does not need Apple:
`"apple"` has always been in the provider list that is asked about, so enabling
the provider makes the button appear with no app release.

### The correction that matters: withdrawing Google is NOT a config push

This page previously said that withdrawing Google from the iOS build was "now a
config push rather than a code change". **That was wrong**, and it mattered
because it was one of the two escape routes from this question.

`/auth/v1/settings` is **per project**, and one project serves the website, the
Android app and the iOS app. Disabling Google there disables it *everywhere* —
including for the overwhelming majority of sign-ins, on two platforms that are
already live. There is no per-platform provider setting, and there was no
platform conditional anywhere in `features/auth/`.

There is now. `features/auth/providers.ts` holds a per-platform allow list, and
it does two jobs:

- **iOS may offer Apple; Android and the web may not.** This is the control that
  stops the config push Stage 5C has to make — turning Apple on so iOS can be
  submitted — from putting an untested Apple button in front of Android members
  and web visitors. `apps/web/src/features/auth/settings.ts` carries the same
  exclusion for the same reason.
- **The iOS offline fallback is empty.** When `/auth/v1/settings` cannot be read,
  the old code fell back to Google alone — a lone third-party login with no
  alternative beside it, which is the exact shape 4.8 prohibits, reached by
  nothing more exotic than a flaky connection in a reviewer's office. On iOS it
  now falls back to no third-party provider at all and the screen says so
  (`auth.signIn.providersOffline`, in all six languages). Email is a complete
  sign-in path on its own, so nobody is locked out.

The decision is a pure function with unit tests —
`apps/mobile/src/features/auth/providers.test.ts` — because it is a compliance
property rather than a layout preference, and `ios-probe.mjs` asserts the module
is still wired in and that the web list has not quietly regained Apple.

### Known consequence for already-installed Android copies

**Android v0.1.4 is already published, and it filters `/auth/v1/settings`
against its own hardcoded list, which includes `"apple"`.** So on the day the
Supabase Apple provider is enabled, installed v0.1.4 copies **will** show an
Apple button. The allow list added here protects future builds; it cannot reach
a binary that already shipped.

That is a sequencing decision for Stage 5C, not a defect, and there are two
honest options: ship an Android build carrying the allow list before enabling
the provider, or accept that installed copies offer an Apple sign-in that has
never been tested on Android. Pretending the second is impossible would be the
error.

#### ❗ Publishing v0.1.5 does not close this. Corrected 2026-11-28.

An earlier draft of the rollout treated "publish an Android build carrying the
allow list" as a mitigation that *removes* the problem. It does not, and the
distinction matters enough to write down:

**Publishing v0.1.5 does not uninstall v0.1.4.** Eraya is distributed as a
direct APK with no store and no auto-update, so a member on v0.1.4 stays on
v0.1.4 until they choose to download and install a newer one. Some never will.

| | |
| --- | --- |
| What publishing v0.1.5 achieves | Anybody who **updates** stops seeing an Apple button |
| What it does not achieve | Anybody who **does not update** still sees one, for as long as they keep v0.1.4 |
| How long that lasts | ⏳ **Indefinitely.** There is no expiry, no forced update and no minimum-version gate — deliberately, and that decision is not being revisited for this |
| Does the update notice fix it? | Only partly. v0.1.4 has no version awareness at all, so it cannot even be *told* an update exists. The notice begins working from v0.1.5 onward |

**So this is a residual compatibility risk, not a closed one.** The honest
position for Stage 5C:

- Publishing v0.1.5 **reduces** the affected population to those who have not
  updated, and reduces it further over time.
- It never reaches zero while any v0.1.4 install survives.
- Enabling the Apple provider therefore means accepting that **some installed
  Android clients will display an Apple sign-in button that cannot work**.
- The failure is visible and harmless — an OAuth attempt against an
  unconfigured provider — and it carries **no bypass and no data risk**. It is a
  cosmetic defect in a shipped binary, which is the category of thing that
  cannot be fixed retroactively on any platform.

⚠️ **Do not "solve" this with a forced update or a minimum-version gate.** Both
hand a remote value the power to lock members out of their own accounts, which
is a far worse failure than a dead button. The update notice is advisory by
design and stays that way.

## What was reviewed for iOS and found correct

Written down because "we looked" is otherwise indistinguishable from "we did
not", and because each of these is somewhere a phone-shaped assumption usually
hides:

- **Safe areas.** `ui/Screen.tsx` reads `useSafeAreaInsets()` and claims the
  bottom inset on every screen; `(tabs)/_layout.tsx` adds the system's strip to
  the tab bar's height *and* its padding, reading the number from the device
  rather than writing one down. Built for Android's edge-to-edge enforcement,
  correct on an iPhone's home indicator for the same reason.
- **Keyboard.** `behavior="padding"` on iOS and `undefined` on Android, which
  is the right pair — Android's window is already resized by the system and
  doubling up pushes content off the top.
- **Gestures in a modal.** `PhotoFramer` mounts its own
  `GestureHandlerRootView` inside the `Modal`, which is required because a
  React Native modal is a separate native window.
- **Status bar.** `style="dark"` against a cream canvas, with
  `UIViewControllerBasedStatusBarAppearance` false.
- **Text scaling.** Tab labels shrink to 85% rather than clip, and only on iOS,
  where `adjustsFontSizeToFit` shrinks instead of truncating.
- **Screen dimensions.** No `Dimensions.get` anywhere. The one place that
  measures uses `useWindowDimensions`, which re-renders.
- **No `Alert.alert`.** `ui/Sheet.tsx` is used instead, deliberately, because
  the two platforms order alert buttons differently.

### One iOS-only defect, fixed

`app/messages/[id].tsx` kept `insets.bottom` on the composer while the
`KeyboardAvoidingView` lifted the whole view by the keyboard's height — so on
every iPhone with a gesture bar there was 34pt of empty canvas wedged between
the text field and the keys. Invisible on Android, where `behavior` is
undefined and the system resizes the window instead, which is why the device
this was built on could not show it.

`useKeyboardCovering()` now zeroes that inset while the keyboard is up, from
`keyboardWillShow`/`keyboardWillHide`, and returns `false` for ever on Android
— no listener is attached there and the arithmetic collapses to exactly what
shipped. **Needs confirming on a real iPhone.** It is the correct fix for a
correctly diagnosed problem, and that is not the same as having seen it work.

## Building it

Nothing below has been run.

The existing EAS configuration already produces the right thing, which is worth
stating because it means there was nothing to change:

```
$ npx eas-cli config --platform ios --profile production
credentialsSource: remote
distribution:      store
autoIncrement:     true
```

`distribution: store` is an App Store build — a signed `.ipa` suitable for
upload to App Store Connect and distribution through TestFlight. `eas.json` was
not modified.

The EAS **production** environment already holds `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `EXPO_PUBLIC_SITE_URL`
(`npx eas-cli env:list production`), and the `production` build profile resolves
that environment. This matters more than it looks: `lib/supabase/env.ts`
*throws* when the URL or key is missing, so a build without them would install
and then fail on launch with no screen to explain why.

### After Apple Developer enrollment

In this order. None of it needs a Mac.

1. **Enroll**, and wait for Apple's identity verification. An individual
   enrollment is $99/year and the verification is the part that takes days.
2. **Create the app record** in App Store Connect with bundle id
   `app.eraya.mobile`, name Eraya, primary language English. The identifier has
   to match `app.json` exactly.
3. **Build.** `eas build --platform ios --profile production` from
   `apps/mobile`. EAS generates the distribution certificate and provisioning
   profile on its own and stores them remotely — `credentialsSource: remote` is
   already set, and no certificate needs to exist on this machine.
4. **Upload.** `eas submit --platform ios --profile production`. It will prompt
   for the Apple ID, team and App Store Connect app id; those are deliberately
   not in `eas.json`.
5. **Answer App Store Connect's questions.** Export compliance is already
   declared in `Info.plist`. The App Privacy section needs filling in: email
   address, name, photos, city, date of birth, and the free-text profile
   fields, all for app functionality, none for tracking.
6. **TestFlight internal testing.** Add the Apple ID as an internal tester —
   internal testing needs no review and the build is usually installable within
   minutes of processing finishing. Install the TestFlight app on the iPhone.
7. **Then test it.** Everything in the next section.

`autoIncrement: true` with `appVersionSource: "local"` means EAS rewrites
`ios.buildNumber` in `app.json` on each build. That edit belongs in a commit.

## What only an iPhone can answer

Separated from everything above because none of it is known:

- Google and Facebook sign-in completing through
  `ASWebAuthenticationSession` and returning to `eraya://auth`
- a session surviving a force-quit, having been written to the Keychain
- cancelling a sign-in part-way, and an expired six-digit code
- the icon as iOS actually masks it, and the launch screen
- the composer sitting against the keyboard with no gap
- the tab bar against the home indicator, on a notched phone and on an SE
- picking photos, framing them by drag and pinch, and the upload completing —
  pinch in particular has never been driven by a tool on either platform
- the whole product in six languages, including whether Tamil and Telugu
  overflow anywhere they do not on Android
- text at the largest system size

## What Stage 5B closed, and what it could not

Closed, and asserted by `npm run ios:probe` (90 assertions) or `npm test`:

| Was | Is |
| --- | --- |
| `NSAllowsArbitraryLoads: true` in the generated plist | **`false`**, set explicitly in `app.json`. The `localhost` exception and `NSAllowsLocalNetworking` stay, so `expo start` still reaches Metro |
| `UIRequiredDeviceCapabilities: ["armv7"]` — 32-bit ARM, the template default | **`["arm64"]`** |
| Provider list identical on every platform | Per-platform allow list; Apple on iOS only, with unit tests |
| iOS offline fallback = Google alone | **Empty**, with a localized explanation and a retry |
| The website would show Apple the moment the provider is enabled | It will not — `ALL` in `features/auth/settings.ts` excludes it |
| Marketing version recorded here as 0.1.3 | **0.1.4** |

**Required-reason APIs: inventoried, not guessed.** Every category Eraya reaches
is declared by the dependency that reaches it — `expo-file-system`
(FileTimestamp, DiskSpace), `expo-constants` (UserDefaults), `expo-application`
(FileTimestamp), and React Native's own manifest. Eraya's own code calls none of
them directly, which the probe asserts by symbol. **So no app-level
`PrivacyInfo.xcprivacy` is declared**, deliberately: inventing one to satisfy a
static check would be asserting something about code we did not write. If
ITMS-91053 comes back on the first upload it will name the categories, and that
is the point to add `ios.privacyManifests`.

### Must be inspected in the real IPA — not knowable from here

`expo config --type introspect` runs in development mode, so some keys it shows
are not the keys a Release build ships. These are the ones to check inside the
first `.ipa`'s `Info.plist`:

| Key | Expectation | Why it cannot be settled here |
| --- | --- | --- |
| `NSAllowsArbitraryLoads` | **false** | The `app.json` override is proven to win in introspection; a build is still the only place the final merge is observable |
| `NSBonjourServices` | **absent** | `expo-dev-launcher` deletes `_expo._tcp` in a build-phase script when `$CONFIGURATION != "Debug"`. Verified by reading the plugin, not by running it |
| `NSLocalNetworkUsageDescription` | **absent** | Same script, and only when the text still matches the dev-launcher default |
| `exp+eraya` URL scheme | present is acceptable, absent is better | Added by the dev client. Harmless, but worth knowing which it is |
| `RCTMetroPort` | **absent** | A build-time variable; it should not survive a Release build |
| `MinimumOSVersion` | **16.4** | The real floor, from the Expo SDK 57 podspecs (`ios => '16.4'`). The `LSMinimumSystemVersion: 12.0` the plist carries is a macOS key and is inert on iOS — misleading, but not worth overriding without evidence |

## What Stage 5B.1 closed

Rollout hardening, between Stage 5B (compliance built) and Stage 5C (Apple
enrolment). Nothing here needed the paid account.

| Was | Is |
| --- | --- |
| The website would have had Android v0.1.4's silent-failure defect — a photograph accepted and nobody told it is invisible | The website shows waiting / refused state per photograph, and re-reads it after an upload. `features/account/photo-review.ts` |
| Review copy promised *"usually within a day"* | ❌ Removed from **all six languages**. The product says a photograph is waiting and that only the owner can see it, which is true at any queue length |
| One text policy for profiles and conversations | Two: contact details refused in a profile, **allowed** in a private conversation between connected adults. Links refused in both |
| Native-script filtering listed as "not guessed at" | Devanagari patterns exist and **fire**, flagged `needs_native_review`. See the two defects below |
| App Review privacy relied on demo profiles crowding discovery plus a note asking the reviewer not to contact real members | `profiles.account_kind` — an account meets only accounts of its own kind, enforced in `discover_members`, `member_profile`, `express_interest` and two triggers |
| The documented rollback mass-published every pending photograph | ❌ Deleted. Recovery now preserves every state, and the probe asserts no bulk publisher exists |
| Queue monitoring was a count | `photo_queue_health()` reports the **age of the oldest waiting photograph**, which is the only figure that detects an abandoned queue |
| Subtitle undecided | ✅ `Meet again, at your own pace` |
| No in-app update path for direct APK installs | `app-version.json` + a dismissible home-screen card, six languages, no forced update |

### Two defects found by measuring instead of reasoning

Both were in the unapplied moderation migration, both would have shipped, and
both failed **silently** — the rows would have sat in the table looking like a
working filter.

**1. The normaliser shattered every Indic word.** In PostgreSQL an Indic
consonant is `[[:alnum:]]` but a vowel sign or anusvara is **not** — they are
combining marks, and no POSIX class includes them. So the
`[^[:alnum:]]+ -> ' '` step replaced every matra with a space:

```
Devanagari 'randi'  ->  two meaningless fragments
Tamil 'vanakkam'    ->  two meaningless fragments
```

Fixed by naming the four Unicode blocks Eraya's languages use (Devanagari,
Bengali, Tamil, Telugu) in every class that removes characters. **Add a block
before adding a language.**

**2. `\m` / `\M` word boundaries never match Indic script.** A word ending in a
matra cannot match `\M`, because the matra is not a word character — so
`'\m<word>\M'` matched nothing, for ever. Native-script patterns anchor on
spaces instead, `(^| )...( |$)`, which is sound because the normaliser returns
space-separated tokens.

### ❗ versionCode 7 for v0.1.5

`main` said 5 (v0.1.4) when this was decided. **6 is already consumed** by the Google Play
closed-testing AAB on `release/google-play-closed-beta-1`, under the same
application id. Play requires a strictly increasing versionCode, so the next
direct release is **7**.

## Still open

- **Sign in with Apple** needs the paid account: a Service ID, a key and a team
  identifier. The app side is ready; see the correction above.
- **In-app purchase.** Premium is unbuyable on iOS until StoreKit exists. That
  is a defensible first release and not a permanent position.
- **Apple's judgement on an app that sells nothing.** Disabling purchases
  removes the 3.1.1 problem. It does not guarantee approval, and it is worth
  expecting a reviewer to ask how Premium is obtained at all.
- **No screenshots, no App Store description, no privacy policy URL entered.**
  All required at submission; none required for TestFlight internal testing.
- **`expo-doctor` reports 18 packages behind on their patch versions.** Every
  one is inside its `~57.0.x` range and this predates the iOS work — the
  shipped Android v0.1.3 was built on exactly these versions. Worth a pass of
  its own, on its own branch, with an Android rebuild to confirm it.
