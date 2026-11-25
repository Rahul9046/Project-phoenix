/**
 * Which artifact this is.
 *
 * One value, decided when the bundle is built and never afterwards, naming the
 * channel this copy of Eraya was distributed through. It exists because
 * "Android" stopped being a single answer: the same `app.eraya.mobile`, built
 * from the same source, is handed out two different ways, and the two are
 * allowed to take money differently.
 *
 * ---------------------------------------------------------------------------
 * The two Android artifacts
 * ---------------------------------------------------------------------------
 * `direct` -- the APK published on eraya.app and installed by tapping a link.
 * It is not distributed through Google Play, so Play's Payments policy does not
 * reach it, and it keeps the Razorpay browser checkout it has had since the
 * first build. People are running this one today.
 *
 * `play` -- the build uploaded to Google Play. Play's Payments policy applies
 * to apps *distributed on Play*, and it requires digital goods to be sold
 * through Play Billing, so this build must never open the website's checkout.
 *
 * iOS is neither, and is handled a step above this file: `purchasing.ts` shuts
 * the till entirely on iOS, so no channel value can turn a purchase on there.
 *
 * ---------------------------------------------------------------------------
 * Why this is not `Platform.OS`
 * ---------------------------------------------------------------------------
 * Because both Android artifacts report `android`, so the platform cannot tell
 * them apart -- and the thing it would get wrong is the one already in people's
 * hands. Dispatching the public APK to Play Billing would initialise a Billing
 * client in a build Play has never seen: `initConnection` fails on a sideloaded
 * install with no Play account entitled to the app, Premium becomes unbuyable,
 * and the only symptom is a member who cannot pay. The platform check was the
 * right answer while the Play build was the only Android build anybody was
 * planning; it stopped being right when the APK became a public download.
 *
 * ---------------------------------------------------------------------------
 * Why a build-time variable and not a runtime flag
 * ---------------------------------------------------------------------------
 * Expo inlines `process.env.EXPO_PUBLIC_*` into the bundle by matching the
 * literal text at build time -- the same mechanism `EXPO_PUBLIC_SITE_URL` and
 * the Supabase keys already use. After the build there is no variable left to
 * read and nothing to set: the value is a string constant in the JavaScript.
 * That is the property worth having here. A remote config, a stored preference
 * or anything else resolved while the app runs could be switched after the fact
 * on a build whose store cannot honour the switch, and the cost of being wrong
 * in that direction is a payments-policy breach rather than a bug.
 *
 * Read as one whole expression, never as `process.env[name]`: a computed lookup
 * is invisible to the inliner and yields undefined in a release build while
 * working perfectly in development.
 *
 * ---------------------------------------------------------------------------
 * Why absent means `direct`
 * ---------------------------------------------------------------------------
 * Because that is the safe default, and the two mistakes are not equal.
 *
 * A `direct` build that should have said `play` sells through Razorpay. That is
 * wrong, and it is caught before anybody can be affected: the Play build is
 * made from the `play` EAS profile, which declares the variable in `eas.json`
 * in version control, and `scripts/payments-probe.mjs` asserts that it does.
 *
 * A `play` build that should have said `direct` is the one that cannot be
 * caught, because it would ship to the public download link and break
 * purchasing for every person who installed the app from the website. So the
 * value that requires somebody to have deliberately declared it is the one that
 * turns Play Billing on, and the value you get by forgetting is the behaviour
 * that is already live.
 *
 * Any string other than `play` is `direct`, deliberately. A typo is not a third
 * channel, and the question "is this the Play build" has to have a yes-or-no
 * answer rather than an undefined one.
 */

export type DistributionChannel = "direct" | "play";

/** Who takes the money. See `purchasing.ts` for what each one means. */
export type PaymentProvider = "none" | "razorpay" | "play";

/**
 * The channel decision, as a function of the one value it depends on.
 *
 * Separate from the constant below so it can be asserted without a bundler, a
 * device or a store -- `provider.test.ts` is the check that was impossible while
 * this was a `Platform.OS` comparison buried in a module that imports
 * `react-native`. This file deliberately imports nothing.
 */
export function distributionChannelFrom(
  value: string | undefined,
): DistributionChannel {
  return value === "play" ? "play" : "direct";
}

/**
 * Who takes the money, given a platform and a channel.
 *
 * The platform decides whether a build may sell at all, and the channel decides
 * through what. Both are needed: neither alone distinguishes the three cases,
 * which is the mistake this function exists to make impossible to repeat.
 */
export function paymentProviderFor(
  platform: string,
  channel: DistributionChannel,
): PaymentProvider {
  if (platform === "ios") return "none";
  return channel === "play" ? "play" : "razorpay";
}

/**
 * This build's channel.
 *
 * Read as one whole expression -- Expo inlines `process.env.EXPO_PUBLIC_*` by
 * matching the literal text at build time, and a computed lookup yields
 * undefined in a release build while working perfectly in development.
 */
export const distributionChannel: DistributionChannel = distributionChannelFrom(
  process.env.EXPO_PUBLIC_DISTRIBUTION,
);

/** True only in the build uploaded to Google Play. */
export const distributedThroughPlay: boolean = distributionChannel === "play";
