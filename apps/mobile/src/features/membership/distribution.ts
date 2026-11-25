/**
 * Which artifact this is.
 *
 * One value, decided when the bundle is built and never afterwards, naming the
 * channel this copy of Eraya was distributed through. It exists because
 * "Android" stopped being a single answer: the same `app.eraya.mobile`, built
 * from the same source, is handed out two different ways, and the two are not
 * allowed to take money the same way.
 *
 * ---------------------------------------------------------------------------
 * The two Android artifacts
 * ---------------------------------------------------------------------------
 * `direct` -- the APK published on eraya.app and installed by tapping a link.
 * It is not distributed through Google Play, so Play's Payments policy does not
 * reach it, and it keeps the Razorpay browser checkout it has had since the
 * first build. People are running this one today, and nothing here changes it.
 *
 * `play` -- the build uploaded to Google Play. Play's Payments policy applies
 * to apps *distributed on Play*, and it requires digital goods to be sold
 * through Google Play Billing. This build cannot do that yet (see
 * `playBillingImplemented` below), so it sells nothing at all.
 *
 * iOS is neither, and the platform answers for it on its own: no iOS build may
 * sell, whatever channel it claims to be.
 *
 * ---------------------------------------------------------------------------
 * Why this is not `Platform.OS`
 * ---------------------------------------------------------------------------
 * Because both Android artifacts report `android`, so the platform cannot tell
 * them apart -- and the thing it would get wrong is the one already in people's
 * hands. Deciding on the platform would mean one answer for two builds that
 * must behave differently, and the build that would be broken by the wrong
 * answer is the public download. The platform check was the right answer while
 * the Play build was the only Android build anybody was planning; it stopped
 * being right when the APK became a public download.
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
 * Why absent means `direct`, and why a typo does not
 * ---------------------------------------------------------------------------
 * Absent means `direct` because that is the behaviour already live, and the two
 * mistakes are not equal. The public APK is built locally with Gradle from a
 * checkout that declares nothing, and a forgotten variable there must not
 * change how the artifact the public is running takes money. So the value you
 * get by forgetting is the one already shipping, and `play` has to be declared
 * deliberately -- it is declared in `eas.json`, in version control, by exactly
 * one profile.
 *
 * A value that is present but unrecognised is a different thing and gets a
 * different answer. `"plays"`, `"Play"`, `"true"` -- somebody meant to name a
 * channel and got it wrong, and the honest reading of "I do not know which
 * artifact this is" is `unknown`, which sells nothing. Failing closed there
 * costs a purchase that can be retried after a corrected build; guessing
 * `direct` would open a web checkout inside a build that might be the one on
 * Play, which cannot be undone by a later build.
 *
 * This file deliberately imports nothing, so the whole decision can be
 * asserted under Node without a bundler, a device or a store --
 * `provider.test.ts` is that check.
 */

export type DistributionChannel = "direct" | "play" | "unknown";

/**
 * Who takes the money. See `purchasing.ts` for what each one means.
 *
 * There is no `play` member, and that absence is the guarantee rather than an
 * omission: this codebase contains no Play Billing client, so no input to
 * `paymentProviderFor` can produce one, and the compiler is what enforces it.
 * When Google Play Billing lands (PR #152) this union grows a `"play"` member
 * and `playBillingImplemented` becomes true in the same commit -- not before,
 * and not separately.
 */
export type PaymentProvider = "none" | "razorpay";

/**
 * Whether this build can sell through Google Play at all.
 *
 * `false`, and deliberately a named constant rather than an implicit property
 * of the code, so that "why can nobody buy Premium on Play" has a written
 * answer in the place somebody would look for it.
 *
 * What is missing is not the client code alone. Three Supabase edge functions
 * are undeployed, two service-account secrets are unset, the five in-app
 * products do not exist in Play Console, and Play Console itself is still
 * waiting on Google's developer identity verification. Shipping a Billing
 * client against that would produce a purchase flow that opens, fails and
 * charges nobody -- which is a worse first impression for fifteen closed
 * testers than a sentence saying Premium is not on sale yet.
 *
 * The first closed-testing build exists to start Google's fourteen-day clock on
 * the core product: sign-in, onboarding, discovery, interest, messaging,
 * safety, deletion, six languages. Premium purchasing is not part of that, and
 * holding the build until billing worked would have cost two weeks for nothing.
 */
export const playBillingImplemented = false;

/**
 * The channel decision, as a function of the one value it depends on.
 *
 * Separate from the constant below so it can be asserted without a bundler, a
 * device or a store.
 */
export function distributionChannelFrom(
  value: string | undefined,
): DistributionChannel {
  if (value === undefined || value === "" || value === "direct") return "direct";
  if (value === "play") return "play";
  return "unknown";
}

/**
 * Who takes the money, given a platform and a channel.
 *
 * The platform decides whether a build may sell at all, and the channel decides
 * through what. Both are needed: neither alone distinguishes the cases, which
 * is the mistake this function exists to make impossible to repeat.
 *
 * Three of the four answers are `none`, and each is `none` for its own reason:
 *
 *   ios      -- Apple's Guideline 3.1.1 forbids a web checkout for a digital
 *               good and forbids pointing anybody at one. StoreKit is the
 *               eventual answer and does not exist yet.
 *   play     -- Play's Payments policy requires Play Billing for digital goods
 *               in an app distributed on Play, and this build has no Play
 *               Billing. Razorpay is not a fallback; it is the breach.
 *   unknown  -- we cannot tell which artifact this is, so we sell nothing.
 */
export function paymentProviderFor(
  platform: string,
  channel: DistributionChannel,
): PaymentProvider {
  if (platform === "ios") return "none";

  switch (channel) {
    case "direct":
      return "razorpay";
    case "play":
      /*
       * Not `razorpay`, now or ever: an app distributed on Play may not open a
       * web checkout for a digital good, so the absence of Play Billing makes
       * Premium unbuyable rather than making it fall back.
       *
       * This line and `playBillingImplemented` change together. When Play
       * Billing lands, the flag becomes true, `PaymentProvider` grows a
       * `"play"` member, and this returns it. `provider.test.ts` asserts the
       * pair agree, so neither can be changed on its own.
       */
      return "none";
    case "unknown":
      return "none";
  }
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
