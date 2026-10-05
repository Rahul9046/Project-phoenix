# What you need to configure

Everything that could be built has been built. This is the list of things that
need a person with account access, because they involve credentials, a developer
account, or a paid service — none of which should be invented.

Nothing here blocks running the app on Android today. Items marked **blocker**
block a specific release.

---

## 1. Local environment (2 minutes)

`apps/mobile/.env.local` already exists on this machine with the project URL and
the publishable key, copied from the web app. If you set up on another machine:

```
cp apps/mobile/.env.example apps/mobile/.env.local
```

Fill in from the Supabase dashboard, **Settings → API**:

| Variable | Where |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable (anon) key |

Both are public by design — Row Level Security is what protects the data. The
**service role key must never go in this file**; `EXPO_PUBLIC_` values are
inlined into the app binary, where anyone can read them.

Restart the bundler afterwards. Expo inlines these at build time, so a running
server will not pick up a change.

---

## 2. Redirect URLs — done, with one consequence

`eraya://auth` and `http://localhost:8081` are in `supabase/config.toml` and
pushed. Nothing to do unless you change the app's scheme.

**Expo Go cannot complete a sign-in.** Supabase refuses `exp://` redirect URLs —
tested, and a literal URL is rejected as firmly as a wildcard — and it is right
to. `exp://` belongs to Expo Go, which every Expo project on a device shares, so
a session delivered there could be picked up by another app.

What that means in practice:

| | Screens and layout | Sign-in |
| --- | --- | --- |
| Expo Go | Yes | No |
| Development build | Yes | Yes |
| Store build | Yes | Yes |

So Expo Go is useful for looking at the app and useless for using it. A
development build registers the `eraya` scheme and behaves normally — see §8.

If a sign-in ever comes back as an error instead of a session, this list is the
first thing to check: a redirect that is not on it is silently swapped for
`site_url`.

## 3. Sign in with Apple — **blocker for iOS**

Not configured, and deliberately not faked: the button is not shown, because a
provider that fails is worse than one that is absent.

Apple requires this once any other social sign-in ships, so the iOS App Store
will reject the app without it. Android is unaffected.

You will need:

1. An Apple Developer Program membership (£79/$99 a year — a paid service, hence
   this list).
2. In the Apple Developer portal: an App ID for `app.eraya.mobile` with
   "Sign in with Apple" enabled, a Services ID, and a private key (`.p8`).
3. In Supabase, **Authentication → Providers → Apple**: the Services ID, Team
   ID, Key ID and the key contents.
4. Set `enabled = true` under `[auth.external.apple]` in
   `supabase/config.toml`, run `supabase config push`, and add `"apple"` to
   `availableProviders` in `apps/mobile/src/features/auth/sign-in.ts`.

On iOS, also install `expo-apple-authentication` and use the native button —
Apple's guidelines require its own control rather than a web flow.

---

## 4. Phone verification — **not a blocker, but visible**

Mocked. No SMS is sent and any six digits are accepted. Every screen that touches
it says so, and **no member is ever shown a "phone verified" badge**, because
that would be a safety claim the system cannot support.

To switch it on:

1. Choose an SMS provider — in India, Twilio or MSG91. This is a paid service.
2. Configure it in Supabase, **Authentication → Providers → Phone**, and set
   `enable_signup = true` under `[auth.sms]` in `supabase/config.toml`.
3. Replace the two function bodies in
   `apps/mobile/src/features/onboarding/phone.ts` — the file documents exactly
   what with — and set `phoneVerificationIsLive = true`. The screens reword
   themselves from that flag.
4. Restore the "Phone verified" mark in `apps/mobile/src/ui/Person.tsx` and the
   web's `MemberPresentation.tsx`. One line in each.
5. Delete `completePhoneStep` from `features/onboarding/data.ts`. Supabase sets
   `auth.users.phone_confirmed_at` and a trigger mirrors it.

Note that Indian SMS also requires DLT registration with a telecom operator
before a template can be sent. Start that early; it takes weeks.

---

## 5. Payments — integrated, with one blocker

Both providers are built. **Nothing simulates a successful payment**, and nothing
should — the rule that has not changed is that a subscription row is written
server-side with the service role and never by a client, because
`subscriptions` has no insert, update or delete policy for anyone.

The model is [10-payments.md](10-payments.md). What still needs configuring:

**Razorpay — the web and iOS.** Integrated and settling. Still in **test mode**:
no live key is set, so no real money can be taken. Going live needs Razorpay KYC,
a live-mode webhook with its own secret, and `refund.processed` subscribed — the
full list is in `10-payments.md`.

**Google Play — Android.** An app distributed through Play must sell digital
goods through Play Billing, so Android buys through Play and never through the
web checkout. Eraya sells **one-time consumable products**, not Play
subscriptions, because a term is prepaid and nothing renews. Play's cut applies
to those one-time products.

Nothing on the Play side is configured, and **the Console work is currently
blocked while Google verifies the developer identity** — contact-phone
verification and Android developer/package verification are unavailable until
that completes. So the five products do not exist, the mapping columns in
`membership_plans` are NULL, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is unset, the two
Play edge functions are undeployed, and **no Play purchase has been made on any
device**. The app handles that honestly: the button disables and says purchases
are temporarily unavailable and that nothing has been charged.

The whole Play surface — the five products, the service account, the order of
operations when the block lifts, and what has and has not been proven — is
[14-google-play.md](14-google-play.md). Do not invent product ids ahead of
creating them in Play Console.

---

## 6. Push notifications — not built

Nothing is built and Settings says so rather than showing a switch that does
nothing.

It needs an Expo push token stored per device, a Firebase project for Android, an
APNs key for iOS (same Apple membership as above), and something server-side to
send them.

Worth deciding what would justify one first. This product should not be
notifying people that somebody looked at their profile.

---

## 7. Store listings — before release

- **Google Play**: a developer account (one-off $25), a privacy policy URL that
  resolves, a data safety declaration, and a content rating. Play requires
  account deletion to be reachable both in-app and from a web page — in-app is
  done (You → Settings), the web page is not.
- **Google Play, for selling anything**: the five in-app products, a licence
  tester list, and a build on an internal testing track. A Play Billing purchase
  cannot be exercised at all until a build reaches a track, so this is a
  prerequisite for testing and not only for release. All of it is currently
  blocked behind developer identity verification — see
  [14-google-play.md](14-google-play.md). Signing is
  [15-android-signing-and-distribution.md](15-android-signing-and-distribution.md).
- **App Store**: the developer membership above, screenshots, and an App Privacy
  declaration.
- Both need a real **privacy policy and terms**. `/privacy` on the web describes
  what is collected but says outright that it is not the legal document. India's
  DPDP Act applies. This is a launch blocker for both stores.

---

## 8. Getting a build onto a device

`eas.json` defines four profiles, and all of them build on Expo's servers, so
none needs Xcode or Android Studio on the machine that starts them.

**The Android betas that have actually been distributed were not built this
way.** They were built locally with Gradle, which is also where the beta's
signing identity comes from — a detail that matters more than the build method,
because existing testers can only be updated by a build carrying the same
identity. Before producing any Android build, read
[15-android-signing-and-distribution.md](15-android-signing-and-distribution.md).

| Profile | Produces | Needs an Apple/Google account? |
| --- | --- | --- |
| `simulator` | A self-contained `.app` for the iOS Simulator | No |
| `preview` | An installable Android `.apk` | No |
| `development` | A dev client that attaches to Metro | No (simulator) |
| `production` | Store builds | Yes, both |

```
cd apps/mobile
npx eas-cli build --platform ios --profile simulator
npx eas-cli build --platform android --profile preview
```

Each finishes with a download link. Nobody needs a copy of this repository to run
the result: `simulator` and `preview` are not development clients, so the
JavaScript is bundled in and there is no Metro server to connect to.

**iOS Simulator** — download, unzip, and drag the `.app` onto a running
simulator. The Mac needs Xcode installed (for the simulator itself) and nothing
else.

**Android** — download the `.apk` and open it on any phone with "install unknown
apps" allowed for the browser.

**A physical iPhone** needs signing, which is the one thing EAS cannot do without
credentials. Two routes, covered in §3 and above: Xcode's free provisioning on a
Mac you have to hand (7-day builds, no cost), or the $99/year membership so EAS
can sign on its servers.

### The two build-time variables

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are stored
as EAS environment variables rather than read from `.env.local`, which is
gitignored and never reaches the build servers:

```
npx eas-cli env:list preview
```

Both are public by design -- a project address and a publishable key -- and RLS
is what protects the data. They are `plaintext` visibility deliberately, so
anyone can confirm what a build was given. **The service-role key is not among
them and must never be**: `EXPO_PUBLIC_` values are inlined into the binary,
where anyone can read them.

## Summary

| | Needed for | Cost |
| --- | --- | --- |
| Local env | Running the app | — |
| Redirect URLs | Sign-in | — (done) |
| Apple sign-in | iOS release (not testing) | $99/year |
| SMS provider | Real phone verification | Per message + DLT |
| Payments | Any revenue | Provider fees + store cut |
| Push | Notifications | Free tier likely enough |
| Store accounts | Release | $25 once + $99/year |
| Privacy policy | Both stores | Legal review |

Android testing needs only item 1, which is already done on this machine.
