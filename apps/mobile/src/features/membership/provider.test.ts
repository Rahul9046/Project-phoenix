import assert from "node:assert/strict";
import { test } from "node:test";

import * as distribution from "./distribution.ts";
import {
  distributionChannelFrom,
  paymentProviderFor,
  type DistributionChannel,
} from "./distribution.ts";

/**
 * Who takes the money, per build.
 *
 * These are the assertions that were impossible while the decision was a
 * `Platform.OS` comparison inside a module importing `react-native`: a check
 * could not see it, so nothing would have failed if somebody had pointed the
 * public Android download at Google Play Billing, or let an App Store build
 * open a web checkout.
 *
 * What these tests prove is that the right provider is chosen. What no test in
 * this repository can prove is that a Google Play purchase works -- that needs
 * a real Play build, real products and a real transaction, none of which exist.
 * See docs/14-google-play.md.
 */

/** The three artifacts, named the way the build commands name them. */
const direct = { platform: "android", channel: "direct" as DistributionChannel };
const play = { platform: "android", channel: "play" as DistributionChannel };
const ios = { platform: "ios", channel: "direct" as DistributionChannel };

const providerFor = (build: { platform: string; channel: DistributionChannel }) =>
  paymentProviderFor(build.platform, build.channel);

// ---------------------------------------------------------------------------
// 1. The Android download keeps Razorpay
// ---------------------------------------------------------------------------

test("the Android APK from eraya.app pays through Razorpay", () => {
  assert.equal(providerFor(direct), "razorpay");
});

test("an unset distribution variable is the Android download, not the Play build", () => {
  // The load-bearing default. Absent must never mean `play`: that value would
  // reach the public download link and break purchasing for every install.
  assert.equal(distributionChannelFrom(undefined), "direct");
  assert.equal(providerFor({ platform: "android", channel: distributionChannelFrom(undefined) }), "razorpay");
});

test("only the exact string `play` selects Play Billing", () => {
  for (const value of ["", "direct", "Play", "PLAY", "play ", " play", "true", "1", "google", "store"]) {
    assert.equal(
      distributionChannelFrom(value),
      "direct",
      `${JSON.stringify(value)} must not be read as the Play build`,
    );
  }
  assert.equal(distributionChannelFrom("play"), "play");
});

// ---------------------------------------------------------------------------
// 2. The Play build uses Google Play Billing
// ---------------------------------------------------------------------------

test("the Play build pays through Google Play Billing", () => {
  assert.equal(providerFor(play), "play");
});

test("the Play build never resolves to Razorpay", () => {
  // Play's payments policy binds apps distributed on Play. There is no input to
  // this resolver that makes the Play build open a web checkout.
  assert.notEqual(providerFor(play), "razorpay");
});

// ---------------------------------------------------------------------------
// 3. iOS purchasing stays disabled
// ---------------------------------------------------------------------------

test("iOS sells nothing, whatever the channel says", () => {
  assert.equal(providerFor(ios), "none");
  // Including a channel value that would be the Play build on Android: an iOS
  // binary must not be made to sell by configuration.
  assert.equal(paymentProviderFor("ios", "play"), "none");
});

test("iOS never reaches Razorpay or Play Billing", () => {
  for (const channel of ["direct", "play"] as DistributionChannel[]) {
    const provider = paymentProviderFor("ios", channel);
    assert.notEqual(provider, "razorpay", "an App Store build must not open a web checkout");
    assert.notEqual(provider, "play", "Play Billing does not exist on an iPhone");
  }
});

// ---------------------------------------------------------------------------
// 4. No build exposes another build's purchase path
// ---------------------------------------------------------------------------

test("each build resolves to exactly one provider, and they do not overlap", () => {
  const resolved = [direct, play, ios].map(providerFor);
  assert.deepEqual(resolved, ["razorpay", "play", "none"]);
  assert.equal(new Set(resolved).size, 3, "two builds resolved to the same provider");
});

test("every platform and channel pair resolves, and only to a known provider", () => {
  // An exhaustive sweep rather than three examples, so a future channel or a
  // stray platform string cannot fall through to undefined.
  for (const platform of ["android", "ios", "web", "windows", "macos", ""]) {
    for (const channel of ["direct", "play"] as DistributionChannel[]) {
      const provider = paymentProviderFor(platform, channel);
      assert.ok(
        provider === "none" || provider === "razorpay" || provider === "play",
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
// 5. Entitlements are not a function of any of this
// ---------------------------------------------------------------------------

test("nothing here can affect reading an existing entitlement", () => {
  /*
   * Asserted as a property of the module surface rather than by calling the
   * server: `distribution.ts` is the only thing that knows which build this is,
   * and it exports nothing about entitlement, membership or tier. Premium that
   * has been paid for is read from `my_membership()` by name, with no platform
   * and no provider term in that path, so an iPhone shows the three months
   * somebody bought on the website or on Android.
   */
  const surface = Object.keys(distribution).sort();
  assert.deepEqual(surface, [
    "distributedThroughPlay",
    "distributionChannel",
    "distributionChannelFrom",
    "paymentProviderFor",
  ]);

  // The resolver takes a platform and a channel, and nothing about a member, so
  // it cannot vary by who is asking. Called twice with the same build, it has to
  // give the same answer.
  assert.equal(paymentProviderFor("android", "direct"), providerFor(direct));
  assert.equal(paymentProviderFor("android", "play"), providerFor(play));
});
