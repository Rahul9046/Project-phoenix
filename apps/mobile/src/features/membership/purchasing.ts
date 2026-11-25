import { Platform } from "react-native";

/**
 * Whether Premium can be bought from inside this app.
 *
 * One value, read by every surface that would otherwise offer a purchase, so
 * that "can somebody pay here" is a question with exactly one answer rather
 * than a condition repeated on each screen that happens to mention money.
 *
 * ---------------------------------------------------------------------------
 * Why iOS cannot
 * ---------------------------------------------------------------------------
 * Buying Premium on Android opens the website's Razorpay checkout in the
 * system browser and comes back through `eraya://payment` -- see
 * `payments.ts`. That is a web checkout for a digital good, and Apple's
 * App Store Review Guideline 3.1.1 does not allow one: digital content
 * unlocked inside an iOS app has to be sold through in-app purchase, and an
 * app may not send somebody out to another purchase mechanism either. So
 * carrying the Android path across would not produce a working purchase on
 * iOS, it would produce a rejected binary.
 *
 * StoreKit is the eventual answer and is deliberately not started here. It
 * needs App Store Connect products, a paid Apple Developer membership, and a
 * server that can verify an Apple receipt the way `payments-verify` verifies a
 * Razorpay signature -- none of which exist yet, and all of which are a
 * payments decision rather than a part of getting the app onto a phone.
 *
 * Until then Premium is simply not for sale on iOS. That is said plainly on
 * the membership screen, in all six languages, and nowhere does it suggest
 * buying it somewhere else -- a "buy it on our website" line is the specific
 * thing 3.1.1(a) forbids, and it would also be a worse answer than the honest
 * one.
 *
 * ---------------------------------------------------------------------------
 * Why nowhere can, today
 * ---------------------------------------------------------------------------
 * Razorpay has refused merchant activation: they do not onboard dating or
 * matrimony platforms. So the Android path above describes a checkout with no
 * merchant behind it. An eligibility enquiry is out with Cashfree and has not
 * been answered, and the public launch is not waiting on it -- Eraya goes out
 * free, on the web first.
 *
 * `premiumOnSale` is that fact, kept separate from the iOS rule rather than
 * folded into it, because the two are different kinds of closed and will not
 * reopen together. The iOS one is a property of the store and ends when
 * StoreKit is built; this one is a commercial state and ends when a provider
 * approves Eraya. Collapsing them into a single `false` would lose which is
 * which, and the screen would have to guess which sentence to show.
 *
 * It is a committed constant and not an `EXPO_PUBLIC_` variable on purpose.
 * The server is the enforcement and is an environment variable there, so the
 * till can be shut in seconds without a deploy. A client cannot be changed in
 * seconds at all -- an APK on somebody's phone is final until they install
 * another one -- so the value of a runtime switch here is nil, and the cost of
 * one is a build whose commercial state is not visible in its own source.
 *
 * ---------------------------------------------------------------------------
 * None of this is a safeguard
 * ---------------------------------------------------------------------------
 * Nothing a phone believes stops a payment. The build already installed on
 * somebody's phone -- v0.1.3, with `inAppPurchaseAvailable` true on Android --
 * does not read this file and goes on offering plans and a pay button. It
 * cannot complete a purchase, because `payments-create-order` refuses to
 * create an order at all, for every client at once and for every build this
 * repository will never be able to update. That is the control. See
 * `supabase/functions/_shared/sales.ts`.
 *
 * ---------------------------------------------------------------------------
 * What this does NOT change
 * ---------------------------------------------------------------------------
 * Premium that has already been paid for. Entitlements are read from the
 * server by name (`entitlements.ts`, `my_membership`), with no platform term
 * anywhere in that path, so a member who bought three months on the website or
 * on Android gets exactly those three months on an iPhone. Withdrawing the
 * till is not the same as withdrawing the thing that was bought.
 *
 * ---------------------------------------------------------------------------
 * Why `Platform.OS` and not a feature flag
 * ---------------------------------------------------------------------------
 * The same reason the Play Billing branch dispatches on the platform: this is
 * not a preference that someone might reasonably want to switch on, it is a
 * property of the store the build is distributed through. A flag can be set
 * wrong, inherited from a stale environment, or left on after a test, and the
 * cost of it being wrong on iOS is a rejected submission rather than a bug.
 * `Platform.OS` cannot be wrong.
 */
/**
 * Whether Eraya has a payment provider at all. See above.
 *
 * Flipping this to `true` is not sufficient on its own: the server has to be
 * opened too (`PAYMENTS_SALES_OPEN`), and migration `20261125110100` has to be
 * applied before that. See `docs/10-payments.md`.
 */
export const premiumOnSale: boolean = false;

/** Whether Premium can be bought from inside this app, on this platform. */
export const inAppPurchaseAvailable: boolean =
  premiumOnSale && Platform.OS !== "ios";
