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

## 5. Payments — **blocker for revenue**

No provider is integrated. The membership screen shows the real plans and says
plainly that premium cannot be bought yet. **Nothing simulates a successful
payment**, and nothing should.

When you choose one (Razorpay is the obvious fit for India):

- The subscription row must be written **server-side, with the service role**.
  `subscriptions` has no insert, update or delete policy for anyone, deliberately
  — a client that could write its own subscription could award itself premium.
- That means a Supabase Edge Function holding the webhook secret, verifying the
  provider's signature, and writing the row. Not the app.
- App Store and Play Store both require their own in-app purchase for digital
  subscriptions, taking 15–30%. That is a commercial decision to make before
  building either.

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
- **App Store**: the developer membership above, screenshots, and an App Privacy
  declaration.
- Both need a real **privacy policy and terms**. `/privacy` on the web describes
  what is collected but says outright that it is not the legal document. India's
  DPDP Act applies. This is a launch blocker for both stores.

---

## 8. Building for a device

Expo Go shows the screens but cannot sign in (§2), so real testing needs a
development build. It is a one-off per device; after that `npx expo start`
connects to it exactly like Expo Go.

```
npm install -g eas-cli
eas login                                        # free Expo account
cd apps/mobile
eas build --platform android --profile development
```

`eas.json` is not committed; `eas build:configure` writes it on first run.

**Android**: free. The build runs on Expo's servers, you get an APK link, and it
installs on any phone with "install unknown apps" allowed.

**iOS, with a Mac**: no paid account needed for either route.

The simulator is the easy one -- `npx expo run:ios` compiles a development build
and launches it, with no Apple account at all. It registers `eraya://`, so
sign-in works normally.

A *physical* iPhone is also free, via Xcode's free provisioning: sign in to Xcode
with an ordinary Apple ID, and it will issue a development certificate for a
device you own. The limits are real but rarely matter for testing -- the build
expires after **7 days** and must be reinstalled, up to three apps at a time, and
no push notifications or associated domains. `npx expo run:ios --device` uses it.

The $99/year membership from §3 buys distribution, not development: TestFlight,
builds that do not expire, and the App Store. It is a release requirement, not a
testing one.

**iOS, without a Mac**: neither route is available. EAS can produce a simulator
build without an Apple account, but a simulator only runs on macOS; and putting a
build on a physical iPhone from Windows needs the paid membership so EAS can do
the signing on its servers.

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
