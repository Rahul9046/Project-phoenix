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
| Marketing version | `0.1.3` | `expo.version`, shared with Android's `versionName`. The iOS build is the same release, not a different one |
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

`Platform.OS` and not a flag, because whether a build may sell **at all** is a
property of the platform: iOS is iOS on every artifact Apple will distribute,
and there is no iOS build that should behave otherwise. A flag can be set wrong,
inherited from a stale environment, or left on after a test, and the cost of
being wrong here is a rejected submission rather than a bug.

Which store takes the money when a build *can* sell is a different question, and
the platform is the wrong instrument for it -- both Android artifacts report
`android`. That one is answered by `paymentProvider` in the same file, from
build-time configuration. An earlier version of this page cited the Play Billing
branch's `Platform.OS` dispatch as precedent; that dispatch was replaced when
Play Billing was integrated, for reasons that do not touch iOS. See
[10-payments.md](10-payments.md#android-is-two-artifacts-not-one).

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
| Facebook | Configured on Supabase; **not yet proven from an iOS build** |
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
Eraya offers Google and Facebook, so 4.8 applies.

Email code sign-in plausibly satisfies it: it collects an email address and
nothing else, and Eraya does no advertising tracking. "Plausibly" is doing real
work in that sentence — it is a reviewer's judgement, not a rule with a
checkbox, and the common reading is that Sign in with Apple is expected
whenever Google or Facebook ships.

It is not implemented here because it cannot be: Sign in with Apple needs a
Service ID, a key and a team identifier from a paid Apple Developer account,
and Supabase's Apple provider is `enabled = false` until those exist.
`availableProviders` reads from configuration rather than assuming, so the
button is simply not shown.

**Decide this before submitting for review, not after.** Three outcomes are
possible and they cost very different amounts: email code is accepted as the
4.8 alternative and nothing changes; Sign in with Apple is added, which is a
Supabase provider plus a button; or Google and Facebook are withdrawn from the
iOS build, which is one line in `availableProviders`.

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

## Still open

- **Sign in with Apple**, above. The only item that could block review.
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
