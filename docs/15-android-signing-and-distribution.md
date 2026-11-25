# Android signing and distribution

How the Android beta is built and signed today, why that signing identity must be
preserved, and what is still undecided about distributing through Google Play.

This document is deliberately conservative. The signing identity of a shipped
Android app is one of the few decisions that cannot be taken back after the fact,
so what follows separates **established facts** from the **open question** of how
the current beta and a future Play release relate to each other. The open part is
not guessed at here.

## How the beta is distributed today

Direct sideload. The APK is downloaded from `eraya.app/beta` and installed with
"install unknown apps" allowed for the browser. The download URL deliberately
carries no version number, and the file is not served from the web app's
`public/` directory.

Current shipped build: **v0.1.2, versionCode 3**. `apps/mobile/app.json` is at
versionCode 4, which is the next build rather than a released one.

Version lives in `app.json` (`expo.version`, `expo.android.versionCode`) and never
in `build.gradle`. `apps/mobile/android/` is gitignored and generated.

## How a release APK is built

Locally, with Gradle, not on EAS. `eas.json` still defines a `preview` profile
that produces an APK on Expo's servers, and that remains available, but the
builds that have actually been distributed were made here.

Two things cost a debugging cycle each and are worth not rediscovering:

- **JDK 17, not the Android Studio JBR.** The bundled JBR is JDK 25, and
  `assembleRelease` dies at
  `:react-native-worklets:configureCMakeRelWithDebInfo[arm64-v8a]` with a
  JEP-472 native-access restriction. That is not a project error.
- **ARM only, for testers.**
  `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a`
  produces roughly 62 MB; without the flag you get a ~109 MB universal APK
  carrying x86 slices that only an emulator can use, and testers download over
  Indian mobile data.

An ARM-only APK will not run on an x86_64 emulator -- it installs and then dies
with `SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so`.
Nothing is wrong with the APK. Build the universal variant for the emulator and
ship the ARM one.

`expo prebuild` rewrites the `android` and `ios` scripts in
`apps/mobile/package.json` to `expo run:*`. Revert that drift before committing.

## The signing identity -- established facts

**The existing sideload beta has an existing signing identity, and every build
distributed so far carries it.** Concretely:

- The signing key is the Android debug key at
  `apps/mobile/android/app/debug.keystore` -- the universal `CN=Android Debug`
  certificate, SHA-256 `fac61745…033b9c`. The Expo bare template's `release`
  build type points at `signingConfigs.debug`, which is how a release APK comes
  to carry it.
- **That identity must currently be preserved**, so that existing sideload beta
  installs can continue to be updated with the same identity. Android will not
  install an update signed by a different key over an existing install, so the
  identity is what keeps the current testers upgradeable.
- **The keystore is backed up**: a local copy, and an encrypted copy held
  off-device. That was completed on 2026-10-05 and is what makes the identity
  survivable independently of this machine.
- `expo prebuild` clears and regenerates `apps/mobile/android/`, but reproduces
  that keystore byte-for-byte, because the Expo bare template ships a fixed one.
  Verified 2026-09-25. An earlier worry that `prebuild --clean` would destroy the
  beta identity was wrong, and should not be repeated as a reason to avoid
  prebuild.
- Checked 2026-10-04: there is **no** `~/.android/debug.keystore` on this machine,
  so the file in the project is the only copy on disk here. The template is the
  reproduction path; the file itself is not a backup of anything, which is why the
  off-device copy matters.

**Verify before shipping any build:**

```
apksigner verify --print-certs <apk>
```

The expected certificate is the one above. A build that prints anything else must
not be distributed to existing testers.

## Google Play distribution -- what is established, and what is not

**Established:** Play App Signing and an upload signing configuration **still
need to be set up** before Eraya can distribute through Google Play. Neither
exists today. No build has been uploaded to any Play track, and the Play Console
work is currently blocked while Google verifies the developer identity -- see
[14-google-play.md](14-google-play.md).

**Not established, and deliberately not decided here:**

- what signing identity the eventual Play build will use;
- how that identity relates to the existing sideload identity, including whether
  the current key can serve as the upload key or whether a new one is generated;
- how the current sideload beta testers move to a Play-distributed build, and
  what that requires of them;
- whether both channels continue in parallel, and for how long.

Those four are one question, and it is **OPEN**. It is recorded in
[07-open-questions.md](07-open-questions.md) and will be settled when Play is
configured deliberately -- with Play's own upload requirements and Play App
Signing behaviour read at that time, not inferred now. Nothing in this repository
depends on the answer yet.

What is worth carrying into that decision, as inputs rather than conclusions:
the current certificate is the universal Android debug certificate rather than a
key unique to Eraya; Android's rule that an update must be signed by the same key
as the install it replaces applies to the sideload channel whatever Play does;
and the keystore is now backed up, so the current identity is preservable
regardless of which way the Play question is answered.

## Related

- [14-google-play.md](14-google-play.md) -- Play Billing, the Console blocker, and
  why no billing test is possible before a build reaches a testing track.
- [MOBILE_SETUP.md](MOBILE_SETUP.md) -- the EAS build profiles and the two
  build-time environment variables.
- [09-mobile.md](09-mobile.md) -- the app itself.
