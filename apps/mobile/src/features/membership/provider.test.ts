import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import * as distribution from "./distribution.ts";
import {
  distributionChannelFrom,
  paymentProviderFor,
  playBillingImplemented,
  type DistributionChannel,
} from "./distribution.ts";

/**
 * Who takes the money, per build.
 *
 * These are the assertions that were impossible while the decision was a
 * `Platform.OS` comparison inside a module importing `react-native`: a check
 * could not see it, so nothing would have failed if somebody had pointed the
 * public Android download at a store it is not distributed through, or let a
 * Play-distributed build open a web checkout.
 *
 * `distribution.ts` imports nothing, which is what makes this runnable under
 * `node --test` with no bundler, no device and no store.
 *
 * ---------------------------------------------------------------------------
 * What these prove, and what nothing here can
 * ---------------------------------------------------------------------------
 * Proved: the right provider is chosen for each of the three artifacts, the
 * Play build cannot reach Razorpay or Play Billing, iOS cannot sell at all, and
 * none of it touches reading an entitlement.
 *
 * Not proved, by any check in this repository: that a Google Play purchase
 * works. It cannot, because this build has no Play Billing client -- which is
 * the thing being asserted rather than a gap in the assertions. A real purchase
 * needs a Play build, five products that do not exist, three deployed edge
 * functions and a transaction.
 *
 * Also not proved here: that the bundle Metro produces inlines
 * `EXPO_PUBLIC_DISTRIBUTION` the way this file assumes. That is a property of
 * the bundler, not of the resolver, and `scripts/play-channel.mjs` plus the
 * production export are what check it. See docs/10-payments.md.
 */

/** The three artifacts, named the way the build commands name them. */
const direct = { platform: "android", channel: "direct" as DistributionChannel };
const play = { platform: "android", channel: "play" as DistributionChannel };
const ios = { platform: "ios", channel: "direct" as DistributionChannel };

const providerFor = (build: { platform: string; channel: DistributionChannel }) =>
  paymentProviderFor(build.platform, build.channel);

// ---------------------------------------------------------------------------
// 1. The Android download still uses Razorpay
// ---------------------------------------------------------------------------

test("the Android APK from eraya.app pays through Razorpay", () => {
  assert.equal(providerFor(direct), "razorpay");
});

test("an unset distribution variable is the Android download, not the Play build", () => {
  // The load-bearing default. The public APK is built locally from a checkout
  // that declares nothing, so absent must keep meaning the behaviour already
  // in people's hands.
  assert.equal(distributionChannelFrom(undefined), "direct");
  assert.equal(paymentProviderFor("android", distributionChannelFrom(undefined)), "razorpay");
  // An empty string is what a declared-but-blank `env` entry produces, and it
  // is the same case: nothing was said.
  assert.equal(distributionChannelFrom(""), "direct");
  assert.equal(paymentProviderFor("android", distributionChannelFrom("")), "razorpay");
});

test("the explicit `direct` value is the Android download too", () => {
  assert.equal(distributionChannelFrom("direct"), "direct");
  assert.equal(paymentProviderFor("android", distributionChannelFrom("direct")), "razorpay");
});

// ---------------------------------------------------------------------------
// 2. The Google Play build cannot buy Premium at all
// ---------------------------------------------------------------------------

test("the Google Play build sells nothing", () => {
  assert.equal(providerFor(play), "none");
});

test("Play Billing is not implemented, and the resolver agrees with that", () => {
  /*
   * The pair that must change together. If somebody sets the flag true without
   * giving the `play` channel a provider, this fails -- which is the point:
   * a half-landed Play Billing integration would otherwise look finished.
   */
  assert.equal(playBillingImplemented, false);
  assert.equal(providerFor(play), "none");
});

test("the Play build never resolves to Razorpay, whatever is thrown at it", () => {
  /*
   * Play's payments policy binds apps distributed on Play, and there is no
   * input to this resolver that makes the Play build open a web checkout. Swept
   * across every platform string rather than asserted once, because the bug
   * being prevented is a fallthrough and a fallthrough is found by sweeping.
   */
  for (const platform of ["android", "ios", "web", "windows", "macos", "", "Android"]) {
    assert.notEqual(
      paymentProviderFor(platform, "play"),
      "razorpay",
      `${JSON.stringify(platform)}/play must not open a web checkout`,
    );
  }
});

test("no provider value for Google Play Billing exists to be selected", () => {
  /*
   * Asserted over the whole input space rather than by reading the type, since
   * the type is erased before this runs. Nothing resolves to a Play Billing
   * provider because there is no Play Billing client in the bundle to connect
   * -- so the Play build cannot initiate a purchase, acknowledge one, or create
   * an order.
   */
  for (const platform of ["android", "ios", "web", ""]) {
    for (const channel of ["direct", "play", "unknown"] as DistributionChannel[]) {
      const provider = paymentProviderFor(platform, channel);
      assert.ok(
        provider === "none" || provider === "razorpay",
        `${platform}/${channel} resolved to ${String(provider)}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Only the exact string `play` is the Play build, and a typo sells nothing
// ---------------------------------------------------------------------------

test("only the exact string `play` is the Play build", () => {
  assert.equal(distributionChannelFrom("play"), "play");
  for (const value of ["Play", "PLAY", "play ", " play", "plays", "google-play"]) {
    assert.notEqual(
      distributionChannelFrom(value),
      "play",
      `${JSON.stringify(value)} must not be read as the Play build`,
    );
  }
});

test("a value that was set but not recognised fails closed", () => {
  /*
   * The difference between absent and wrong. Absent is the public APK and keeps
   * Razorpay. A present-but-unrecognised value means somebody declared a
   * channel and mistyped it, and the build might be the one going to Play -- so
   * it sells nothing rather than guessing the answer that would be a policy
   * breach if the guess were wrong.
   */
  for (const value of ["Play", "PLAY", "plays", "true", "1", "store", "google"]) {
    assert.equal(distributionChannelFrom(value), "unknown", JSON.stringify(value));
    assert.equal(
      paymentProviderFor("android", distributionChannelFrom(value)),
      "none",
      `${JSON.stringify(value)} must not reach a till`,
    );
  }
});

// ---------------------------------------------------------------------------
// 4. iOS purchasing stays disabled
// ---------------------------------------------------------------------------

test("iOS sells nothing, whatever the channel says", () => {
  assert.equal(providerFor(ios), "none");
  // Including the channel value that is the Play build on Android: an iOS
  // binary must not be made to sell by configuration.
  assert.equal(paymentProviderFor("ios", "play"), "none");
  assert.equal(paymentProviderFor("ios", "unknown"), "none");
});

test("iOS never reaches Razorpay", () => {
  for (const channel of ["direct", "play", "unknown"] as DistributionChannel[]) {
    assert.notEqual(
      paymentProviderFor("ios", channel),
      "razorpay",
      "an App Store build must not open a web checkout",
    );
  }
});

// ---------------------------------------------------------------------------
// 5. No build exposes another build's purchase path
// ---------------------------------------------------------------------------

test("exactly one artifact can take money, and it is the Android download", () => {
  const resolved = [direct, play, ios].map(providerFor);
  assert.deepEqual(resolved, ["razorpay", "none", "none"]);
  assert.equal(
    resolved.filter((provider) => provider !== "none").length,
    1,
    "more than one artifact has an open till",
  );
});

test("every platform and channel pair resolves to a known provider", () => {
  // An exhaustive sweep rather than three examples, so a future channel or a
  // stray platform string cannot fall through to undefined.
  for (const platform of ["android", "ios", "web", "windows", "macos", ""]) {
    for (const channel of ["direct", "play", "unknown"] as DistributionChannel[]) {
      const provider = paymentProviderFor(platform, channel);
      assert.ok(
        provider === "none" || provider === "razorpay",
        `${platform}/${channel} resolved to ${String(provider)}`,
      );
    }
  }
});

test("the platform alone cannot tell the two Android artifacts apart", () => {
  // The defect this whole mechanism exists to prevent, stated as a test: if
  // somebody reverts to deciding on the platform, these two become equal.
  assert.notEqual(
    providerFor(direct),
    providerFor(play),
    "the Android download and the Play build must not take money the same way",
  );
  assert.equal(direct.platform, play.platform, "both artifacts do report `android`");
});

// ---------------------------------------------------------------------------
// 6. Entitlements are not a function of any of this
// ---------------------------------------------------------------------------

test("nothing here can affect reading an existing entitlement", () => {
  /*
   * Asserted as a property of the module surface rather than by calling the
   * server: `distribution.ts` is the only thing that knows which build this is,
   * and it exports nothing about entitlement, membership or tier. Premium that
   * has been paid for is read from `my_membership()` by name, with no platform
   * and no provider term in that path, so the Play build shows the three months
   * somebody bought on the website or on the Android download, and lets them
   * use what those months entitle them to.
   *
   * The list is exact rather than a subset check, so adding an export here is a
   * deliberate act that has to be read against this comment.
   */
  const surface = Object.keys(distribution).sort();
  assert.deepEqual(surface, [
    "distributedThroughPlay",
    "distributionChannel",
    "distributionChannelFrom",
    "paymentProviderFor",
    "playBillingImplemented",
  ]);

  // The resolver takes a platform and a channel, and nothing about a member, so
  // it cannot vary by who is asking. Called twice with the same build, it has
  // to give the same answer.
  assert.equal(paymentProviderFor("android", "direct"), providerFor(direct));
  assert.equal(paymentProviderFor("android", "play"), providerFor(play));
});

// ---------------------------------------------------------------------------
// 7. The build configuration and this resolver agree
// ---------------------------------------------------------------------------

/**
 * The join nothing else checks.
 *
 * Every assertion above feeds the resolver values chosen by this file. These
 * feed it the values `eas.json` will actually hand the bundler, which is the
 * step where a correct resolver and a correct intention still produce the wrong
 * build -- a profile that declares nothing, or declares `"Play"`, or the Play
 * profile left pointing at the direct channel after a merge.
 *
 * `scripts/play-channel.mjs` prints the same table for a human and restates
 * these rules, deliberately, so the two cannot drift silently: this is what
 * fails if they do.
 */
const easJson = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "eas.json"),
    "utf8",
  ),
) as {
  build: Record<
    string,
    {
      env?: Record<string, string>;
      android?: { buildType?: string };
      autoIncrement?: boolean;
      environment?: string;
    }
  >;
};

const declaredChannel = (profile: string): string | undefined =>
  easJson.build[profile]?.env?.EXPO_PUBLIC_DISTRIBUTION;

test("every EAS build profile declares a channel", () => {
  for (const name of Object.keys(easJson.build)) {
    assert.notEqual(
      declaredChannel(name),
      undefined,
      `profile ${name} declares no EXPO_PUBLIC_DISTRIBUTION, so it would fall back to direct`,
    );
  }
});

test("every declared channel is one this resolver recognises", () => {
  // `unknown` sells nothing, which is the safe failure -- but a profile in
  // version control resolving to it is a typo somebody should fix, not a state
  // to ship.
  for (const name of Object.keys(easJson.build)) {
    assert.notEqual(
      distributionChannelFrom(declaredChannel(name)),
      "unknown",
      `profile ${name} declares ${JSON.stringify(declaredChannel(name))}, which is not a channel`,
    );
  }
});

test("only the play profile is the Play build", () => {
  for (const name of Object.keys(easJson.build)) {
    const isPlay = distributionChannelFrom(declaredChannel(name)) === "play";
    assert.equal(
      isPlay,
      name === "play",
      `profile ${name} ${isPlay ? "claims to be" : "does not claim to be"} the Play build`,
    );
  }
});

test("the profiles that are not the Play build still pay through Razorpay", () => {
  for (const name of Object.keys(easJson.build)) {
    if (name === "play") continue;
    assert.equal(
      paymentProviderFor("android", distributionChannelFrom(declaredChannel(name))),
      "razorpay",
      `profile ${name} would stop the Android download from taking payments`,
    );
  }
});

test("the play profile resolves to no till, and builds an App Bundle", () => {
  const profile = easJson.build.play;
  assert.ok(profile, "eas.json has no `play` profile");

  assert.equal(distributionChannelFrom(profile.env?.EXPO_PUBLIC_DISTRIBUTION), "play");
  assert.equal(
    paymentProviderFor("android", distributionChannelFrom(profile.env?.EXPO_PUBLIC_DISTRIBUTION)),
    "none",
    "the Play build must not resolve to a payment provider",
  );

  // Google Play has not accepted an APK for a new app since August 2021, and
  // the rejection arrives at upload, after a cloud build has been spent.
  assert.equal(profile.android?.buildType, "app-bundle");

  // `autoIncrement` with `appVersionSource: "local"` rewrites app.json during
  // the build, so the versionCode that reaches Play would not be the one in
  // the commit.
  assert.notEqual(profile.autoIncrement, true);

  // Without this the build resolves no EAS environment, and the Supabase URL,
  // the publishable key and the site URL arrive undefined -- an app that
  // launches and can do nothing.
  assert.equal(profile.environment, "production");
});
