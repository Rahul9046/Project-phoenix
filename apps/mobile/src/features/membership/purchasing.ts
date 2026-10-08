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
export const inAppPurchaseAvailable: boolean = Platform.OS !== "ios";
