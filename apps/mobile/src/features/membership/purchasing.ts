import { Platform } from "react-native";

import { distributedThroughPlay } from "@/features/membership/distribution";

/**
 * Whether Premium can be bought from inside this app, and through what.
 *
 * One pair of values, read by every surface that would otherwise offer a
 * purchase, so that "can somebody pay here" and "who takes the money" are
 * questions with exactly one answer each rather than conditions repeated on
 * each screen that happens to mention money.
 *
 * ---------------------------------------------------------------------------
 * Why iOS cannot
 * ---------------------------------------------------------------------------
 * Buying Premium on Android either opens the website's Razorpay checkout in the
 * system browser and comes back through `eraya://payment`, or goes through
 * Google Play Billing -- see `payments.ts`. The first is a web checkout for a
 * digital good, and Apple's App Store Review Guideline 3.1.1 does not allow
 * one: digital content unlocked inside an iOS app has to be sold through in-app
 * purchase, and an app may not send somebody out to another purchase mechanism
 * either. The second is Google's billing system, which does not exist on an
 * iPhone at all. So carrying either Android path across would not produce a
 * working purchase on iOS, it would produce a rejected binary.
 *
 * StoreKit is the eventual answer and is deliberately not started here. It
 * needs App Store Connect products, a paid Apple Developer membership, and a
 * server that can verify an Apple receipt the way `payments-verify` verifies a
 * Razorpay signature and `payments-play-verify` verifies a Play purchase --
 * none of which exist yet, and all of which are a payments decision rather than
 * a part of getting the app onto a phone.
 *
 * Until then Premium is simply not for sale on iOS. That is said plainly on the
 * membership screen, in all six languages, and nowhere does it suggest buying
 * it somewhere else -- a "buy it on our website" line is the specific thing
 * 3.1.1(a) forbids, and it would also be a worse answer than the honest one.
 *
 * ---------------------------------------------------------------------------
 * What this does NOT change
 * ---------------------------------------------------------------------------
 * Premium that has already been paid for. Entitlements are read from the server
 * by name (`entitlements.ts`, `my_membership`), with no platform term and no
 * provider term anywhere in that path, so a member who bought three months on
 * the website, on the Android download or through Google Play gets exactly those
 * three months on an iPhone. Withdrawing the till is not the same as
 * withdrawing the thing that was bought.
 *
 * ---------------------------------------------------------------------------
 * Why `Platform.OS` for iOS, and not for the rest
 * ---------------------------------------------------------------------------
 * Whether a build may sell at all *is* a property of the platform. iOS is iOS
 * on every artifact Apple will ever distribute, there is no iOS build that
 * should behave otherwise, and `Platform.OS` cannot be wrong. A flag could be:
 * set wrong, inherited from a stale environment, or left on after a test, and
 * the cost of it being wrong on iOS is a rejected submission rather than a bug.
 *
 * Which store takes the money on Android is a different question, and the
 * platform is the wrong instrument for it, because both Android artifacts
 * report `android`. The public APK from eraya.app is not distributed through
 * Play and keeps Razorpay; the build uploaded to Play must use Play Billing.
 * That one is answered by `distribution.ts`, from configuration fixed when the
 * bundle is built, which has the same "cannot be wrong at runtime" property
 * that makes `Platform.OS` the right answer above.
 *
 * An earlier version of this file said the Play branch dispatched on
 * `Platform.OS` and gave that as precedent. It did, and it was correct while the
 * Play build was going to be the only Android build; it stopped being correct
 * when the APK became a public download, because the platform check would have
 * pointed a sideloaded install at a Billing client Play will not serve it.
 */

/**
 * Can Premium be bought from inside this build at all?
 *
 * False on iOS and nowhere else. Note that this is not the same as "a purchase
 * will succeed": the Play build needs products configured in Play Console
 * before it can sell anything, which is a store question answered by
 * `play-billing.ts` rather than a platform one.
 */
export const inAppPurchaseAvailable: boolean = Platform.OS !== "ios";

/**
 * Who takes the money in this build.
 *
 * `none` is iOS. `play` is the Android build distributed through Google Play.
 * `razorpay` is everything else that can sell -- which today means the Android
 * APK downloaded from eraya.app, the artifact the public is running.
 *
 * Exactly one of these is true for any given build, which is the point: the
 * three paths cannot overlap, and no screen has to work out which it is in.
 */
export type PaymentProvider = "none" | "razorpay" | "play";

export const paymentProvider: PaymentProvider = !inAppPurchaseAvailable
  ? "none"
  : distributedThroughPlay
    ? "play"
    : "razorpay";
