# Android signing and distribution

Eraya's Android app reaches people through **two channels with two separate
signing identities**, and they are not interchangeable. Getting this wrong
cannot be undone after the fact, so this document states which key signs what,
where the credentials live, and what the channels mean for the people using the
app.

## The three keys

| Key | Signs | Held by | Certificate SHA-256 |
| --- | --- | --- | --- |
| **Direct-distribution key** | the APK on `eraya.app/downloads/eraya.apk`, v0.1.4 onward | this machine, `~/.eraya/signing/` | `dd86912d4840713 25c874aac0c4e84a0 b7ba06c80d159d44 5b84bae081aafd3c` |
| **Play upload key** | the AAB uploaded to Play Console | **EAS** (Expo's servers) | `a1d8586e02b0196b 95dc8d5a293918be 3bc35821d9156fdd ac7351a50ff20e13` |
| **Play app signing key** | what Play actually installs on a phone | **Google**, generated when Play App Signing was accepted | not exportable; read it in Play Console → App integrity |

Three keys, not one, and that is the intended arrangement:

- Google-managed Play App Signing means **Google re-signs** every upload with a
  key nobody else holds. An APK built here can therefore never be an in-place
  update for a Play install, whatever it is signed with. That is a property of
  Play App Signing, not a mistake to fix.
- Because of that, signing direct downloads with the **upload** key would buy no
  Play compatibility at all, while putting the credential that authorises Play
  submissions onto a laptop and into a public download's trust chain. The upload
  key stays on EAS and signs nothing but uploads.

**One consequence to carry into every Play conversation:** a tester who has the
`eraya.app` APK must uninstall it before installing from Play, and vice versa.
Nothing is wrong when that happens; Android is refusing a different signer.

## The direct-distribution key

| | |
| --- | --- |
| Keystore | `~/.eraya/signing/eraya-release.p12` (PKCS#12) |
| Alias | `eraya-release` |
| Subject | `CN=Eraya, O=Eraya, C=IN` |
| Key | RSA **4096** |
| Certificate signature | **SHA384withRSA** |
| Validity | 2026-11-26 → **2056-11-18** (10,950 days) |
| SHA-256 | `DD:86:91:2D:48:40:71:32:5C:87:4A:AC:0C:4E:84:A0:B7:BA:06:C8:0D:15:9D:44:5B:84:BA:E0:81:AA:FD:3C` |
| SHA-1 | `CE:2A:25:9D:C6:83:8C:2D:C1:B9:1A:1E:9E:2F:D1:66:4A:A2:53:91` |
| APK signature schemes | **v2 + v3** (v1 off, v4 off) |

v1 (JAR) signing is off because `minSdk` is 24 and v2 has existed since API 24,
so v1 would add an attack surface for no device. **v3 is on deliberately**: it is
what makes a future key rotation possible without breaking the update path, and
the identity that preceded this one had no v3, which is part of why replacing it
costs a reinstall.

## What it replaced, and why that was not optional

Every public build up to **v0.1.3 (versionCode 4)** was signed with
`android/app/debug.keystore` — `CN=Android Debug`, RSA 2048, **SHA1withRSA**,
certificate SHA-256 `fac61745…033b9c`. The Expo bare template points `release`
at `signingConfigs.debug`, which is how a release APK came to carry it.

**Its private key is public, and that is proven rather than inferred.** Delete
`apps/mobile/android/` and run `expo prebuild`: the keystore comes back with the
identical file digest `221e0a31…f39f5e58`. A key generated on this machine could
not be reproduced that way. It ships inside the template, which is also why its
certificate is dated 2014-01-01 while the file is written fresh on every
prebuild. Anyone holding the template can sign an APK that Android accepts as an
update to `app.eraya.mobile`.

So it provided no authenticity, could never be uploaded to Play, and backing it
up protected nothing — there was no secret in it. It is kept at
`~/.eraya/signing/historical/debug.keystore` for two narrow purposes, recorded in
the README beside it: re-verifying artifacts already published, and explaining
why v0.1.4 needs a reinstall.

## Where the credentials live

Nothing secret is in this repository, and nothing secret is in `android/`.

```
~/.eraya/signing/
  eraya-release.p12            the private key
  eraya-release.properties     store path, alias, passwords
  historical/debug.keystore    the superseded public template key
  historical/README.txt        its provenance, and why it is kept
```

`apps/mobile/android/` is generated and gitignored, and `expo prebuild` **deletes
and recreates it** — with or without `--clean`, in this Expo version. A keystore
placed there would be destroyed by the next prebuild, which is the reason the
directory above sits outside both the repository and the native project.

`ERAYA_RELEASE_STORE_FILE` is **relative** to the properties file, so the
directory is portable: copy it somewhere and point `ERAYA_SIGNING_DIR` at it,
as a Gradle property or an environment variable.

The repository's `.gitignore` also matches `*.keystore`, `*.jks`, `*.p12`,
`*.p8`, `keystore.properties` and `*-release.properties`. Those patterns should
never fire, because the credentials are not in the tree at all. They are there
because the repository is public and one mistake costs the identity.
`*.keystore` in particular was **not** previously covered — the debug keystore
was ignored only as a side effect of `/android` being ignored wholesale.

## How the configuration survives prebuild

`apps/mobile/plugins/with-release-signing.js` is an Expo config plugin. On every
prebuild it rewrites `android/app/build.gradle` to:

1. load `~/.eraya/signing/eraya-release.properties` before the `android {}` block;
2. add an `erayaRelease` signing config with v2 + v3 enabled;
3. **replace** `release { signingConfig signingConfigs.debug }` — the template's
   own line, warning comment and all — with the Eraya config, or `null`;
4. install a `taskGraph.whenReady` guard that **fails the build** if a release
   task is requested while credentials are unavailable.

Two deliberate refusals:

- **No fallback to the debug key.** A release build with no credentials fails in
  about forty seconds with the reason and the fix, rather than emitting an
  artifact that looks fine and is signed by a public key.
- **No silent no-op.** If the Expo template changes shape so an anchor no longer
  matches, the plugin throws during prebuild instead of leaving the debug
  signing in place. A missing patch would otherwise be invisible until someone
  checked a shipped APK's certificate.

Debug builds are unaffected and still work on a machine with no credentials at
all, which is what a new contributor has.

### Verifying the wiring without building

```sh
cd apps/mobile/android
JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2 ./gradlew :app:signingReport
```

`Variant: release` must report `Config: erayaRelease` and SHA-256 `DD:86:91:2D…`.
Anything else — above all `Config: debug` — must not be distributed.

## Building a release APK

```sh
cd apps/mobile/android
export JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

Output: `app/build/outputs/apk/release/app-release.apk`.

Three things cost a debugging cycle each and are worth not rediscovering:

- **JDK 17, not the Android Studio JBR.** The JBR is JDK 25, and
  `assembleRelease` dies at
  `:react-native-worklets:configureCMakeRelWithDebInfo[arm64-v8a]`. AGP's
  `GeneratePrefabPackages.reportErrors` treats *any* subprocess stderr as fatal,
  and JDK 24+ writes a native-access warning there. The project is fine.
  Gradle has already provisioned Temurin 17 under `~/.gradle/jdks/`.
  `JAVA_TOOL_OPTIONS` and friends do not help — they print their own line to the
  same stream.
- **ARM only.** Without `-PreactNativeArchitectures`, `gradle.properties` builds
  all four ABIs and you get a ~109 MB APK whose x86 slices only an emulator can
  use. Testers download it over mobile data.
- **An ARM-only APK cannot run on an x86_64 emulator.** It installs, then dies
  with `SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so`.
  Nothing is wrong with the APK. Build a universal variant for the emulator and
  ship the ARM one — and never report the emulator run as verification of the
  artifact you publish.

`expo prebuild` rewrites the `android` and `ios` scripts in
`apps/mobile/package.json` to `expo run:*`. Revert that drift before committing.

### Verify before distributing anything

```sh
apksigner verify --print-certs --verbose app-release.apk
```

Required: `Verifies`, v2 **and** v3 true, v1 false, one signer, and certificate
SHA-256 `dd86912d…81aafd3c`.

## Reproducing on another authorized machine

1. Install Android SDK with build-tools 36 and NDK 27, and Node 24.
2. Clone the repository and `npm install`.
3. Copy `~/.eraya/signing/` from backup to the same path on the new machine, or
   anywhere and set `ERAYA_SIGNING_DIR`. Restrict it to one user.
4. `cd apps/mobile && npx expo prebuild --platform android`, then revert the
   `package.json` script drift.
5. `./gradlew :app:signingReport` and check the release SHA-256 **before**
   building. A mismatch means the wrong keystore, and the APK it produces cannot
   update anybody's install.

The four property names are the whole interface:
`ERAYA_RELEASE_STORE_FILE`, `ERAYA_RELEASE_STORE_PASSWORD`,
`ERAYA_RELEASE_KEY_ALIAS`, `ERAYA_RELEASE_KEY_PASSWORD`.

## Backups

**Losing this key means no existing install can ever be updated again**, by
anyone, forever. There is no recovery and no authority to appeal to — unlike the
Play upload key, which Google can reset.

Verified to exist today:

| # | Location | Independent of | Verified |
| --- | --- | --- | --- |
| 1 | `~/.eraya/signing/` | — (working copy) | in use by the build |
| 2 | `D:\eraya-signing-backup\` | accidental deletion, C: corruption, OS reinstall | byte-for-byte, and a build was signed from it |

**Backup 2 is not independent of hardware failure.** `C:` and `D:` are
partitions of the same NVMe disk — checked, one physical disk on this machine.
The disk dying takes both.

**A third copy, off this machine, does not exist yet.** It is the one remaining
requirement. Nothing in this document should be read as saying the key is safe
until it is done.

### Making the off-device copy

Fifteen minutes, with a USB drive. Run from Git Bash.

```sh
# 1. Package the directory. -J keeps the archive flat, with no C:\Users\... prefix.
tar -cJf /c/Users/rahul/eraya-signing-backup.tar.xz -C /c/Users/rahul/.eraya signing

# 2. Encrypt it. You will be asked for a passphrase twice. Use a NEW passphrase,
#    not the keystore's, and store it in your password manager -- not on the drive.
gpg --symmetric --cipher-algo AES256 /c/Users/rahul/eraya-signing-backup.tar.xz

# 3. Record the digest of the encrypted file, then copy BOTH lines somewhere safe.
sha256sum /c/Users/rahul/eraya-signing-backup.tar.xz.gpg

# 4. Copy the .gpg file to the USB drive (assume E:), and remove the plaintext archive.
cp /c/Users/rahul/eraya-signing-backup.tar.xz.gpg /e/
rm -f /c/Users/rahul/eraya-signing-backup.tar.xz /c/Users/rahul/eraya-signing-backup.tar.xz.gpg

# 5. VERIFY THE DRIVE, not the source. Decrypt the copy that is actually on it
#    and confirm the keystore inside is byte-identical.
gpg --decrypt /e/eraya-signing-backup.tar.xz.gpg | tar -xJO signing/eraya-release.p12 | sha256sum
```

Step 5 must print the digest recorded in the report for `eraya-release.p12`. A
backup nobody has restored from is not a backup. If `gpg` is not installed, 7-Zip
with AES-256 and a strong password is an acceptable substitute; a plain `.zip`
password is not.

Then label the drive, store it away from the laptop, and note the date.
Do **not** put the passphrase on the drive, and do not upload the key to any
cloud service without deciding to do so deliberately.

## Related

- [09-mobile.md](09-mobile.md) — the app itself.
- [14-google-play.md](14-google-play.md) — Play Billing and the Console state.
  Currently only on the unmerged PR #152 branch.
- [07-open-questions.md](07-open-questions.md) — the signing identity question
  this document closes.
