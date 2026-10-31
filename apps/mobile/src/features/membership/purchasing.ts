import { Platform } from "react-native";

import {
  distributionChannel,
  paymentProviderFor,
  type PaymentProvider,
} from "@/features/membership/distribution";

/**
 * Whether Premium can be bought from inside this app, and through what.
 *
 * One set of values, read by every surface that would otherwise offer a
 * purchase, so that "can somebody pay here" and "who takes the money" are
 * questions with exactly one answer each rather than conditions repeated on
 * each screen that happens to mention money.
 *
 * ---------------------------------------------------------------------------
 * Why iOS cannot
 * ---------------------------------------------------------------------------
 * Buying Premium on the Android download opens the website's Razorpay checkout
 * in the system browser and comes back through `eraya://payment` -- see
 * `payments.ts`. That is a web checkout for a digital good, and Apple's App
 * Store Review Guideline 3.1.1 does not allow one: digital content unlocked
 * inside an iOS app has to be sold through in-app purchase, and an app may not
 * send somebody out to another purchase mechanism either. So carrying the
 * Android path across would not produce a working purchase on iOS, it would
 * produce a rejected binary.
 *
 * StoreKit is the eventual answer and is deliberately not started here. It
 * needs App Store Connect products, a paid Apple Developer membership, and a
 * server that can verify an Apple receipt the way `payments-verify` verifies a
 * Razorpay signature -- none of which exist yet, and all of which are a
 * payments decision rather than a part of getting the app onto a phone.
 *
 * ---------------------------------------------------------------------------
 * Why the Google Play build cannot, yet
 * ---------------------------------------------------------------------------
 * Play's Payments policy requires digital goods inside an app distributed on
 * Play to be sold through Google Play Billing. This build has no Play Billing
 * client, so there is nothing for it to sell through -- and Razorpay is not a
 * fallback, it is the breach. Until Billing is real, the Play build offers no
 * plans, no price and no pay button, and says so in one neutral sentence.
 *
 * That is a deliberate trade. The first closed-testing build exists to start
 * Google's fourteen-day testing clock on the core product; waiting for billing
 * would have cost two weeks and bought nothing. See `distribution.ts`.
 *
 * ---------------------------------------------------------------------------
 * What none of this changes
 * ---------------------------------------------------------------------------
 * Premium that has already been paid for. Entitlements are read from the server
 * by name (`entitlements.ts`, `my_membership`), with no platform term and no
 * provider term anywhere in that path, so a member who bought three months on
 * the website or on the Android download gets exactly those three months in the
 * Play build and on an iPhone. The membership screen still shows Premium as
 * active, still shows when it expires, and still lists the payments behind it.
 * Withdrawing the till is not the same as withdrawing the thing that was
 * bought.
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
 * report `android`. The APK from eraya.app is not distributed through Play and
 * keeps Razorpay; the build uploaded to Play must not open a web checkout.
 * That one is answered by `distribution.ts`, from configuration fixed when the
 * bundle is built, which has the same "cannot be wrong at runtime" property
 * that makes `Platform.OS` the right answer above.
 */

export type { PaymentProvider } from "@/features/membership/distribution";

/**
 * Who takes the money in this build.
 *
 * `razorpay` is the Android APK downloaded from eraya.app, the artifact the
 * public is running. `none` is everything else today: iOS, the Google Play
 * build, and any build whose channel could not be read.
 */
export const paymentProvider: PaymentProvider = paymentProviderFor(
  Platform.OS,
  distributionChannel,
);

/**
 * Can Premium be bought from inside this build at all?
 *
 * Derived from the provider rather than from the platform, so there is one
 * decision and not two that can disagree. Every screen that would offer a
 * purchase reads this.
 */
export const inAppPurchaseAvailable: boolean = paymentProvider !== "none";

/**
 * Why not, when not -- because the two reasons need different words.
 *
 * `platform` is iOS, where Premium is not for sale in the app and will not be
 * until StoreKit exists. `channel` is the Google Play build, where purchasing
 * is not available *yet*. Saying the iOS sentence in the Play build would be
 * wrong, and saying either in the Android download would be a bug.
 *
 * Neither phrasing names another place to buy Premium. On iOS that is what
 * Guideline 3.1.1(a) forbids; on Play, pointing a member at a web checkout is
 * the Payments-policy breach the whole mechanism exists to prevent. It is also
 * the more honest answer in both cases.
 */
export const purchaseUnavailableReason: "platform" | "channel" | null =
  inAppPurchaseAvailable ? null : Platform.OS === "ios" ? "platform" : "channel";
