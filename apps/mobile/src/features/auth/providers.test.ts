import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALL_PROVIDERS,
  allowedProviders,
  fallbackProviders,
  resolveProviders,
  type PlatformName,
} from "./providers.ts";

/**
 * Which sign-in buttons appear, and on which platform.
 *
 *   npm test
 *
 * `node --test` and `node:assert`, the same arrangement as
 * `apps/web/src/features/auth/oauth-handoff.test.ts`. No framework, no new
 * dependency, and no device -- which is the reason `providers.ts` was separated
 * from `sign-in.ts` in the first place.
 *
 * What is actually being defended here is a compliance property, not a
 * preference. App Store Guideline 4.8 is triggered by offering a third-party
 * login without an equivalent alternative, and the two ways Eraya could trip it
 * are both reachable without anybody writing a bug on purpose:
 *
 *   - enabling Apple on the shared Supabase project (which iOS requires) and
 *     thereby lighting up an untested Apple button on Android and the web;
 *   - a failed settings read on iOS falling back to Google alone.
 *
 * Both are asserted below, by name, so that removing the guard fails a test
 * rather than a review.
 */

const EVERYTHING_ON = {
  external: { google: true, facebook: true, apple: true },
};

// ---------------------------------------------------------------------------
// Platform filtering
// ---------------------------------------------------------------------------

test("iOS offers Apple and Google, and offers Apple first", () => {
  const { providers, degraded } = resolveProviders("ios", EVERYTHING_ON);

  assert.deepEqual(providers, ["apple", "google"]);
  assert.equal(degraded, false);
});

test("Apple leads on iOS because 4.8 wants an equivalent option, not a buried one", () => {
  const { providers } = resolveProviders("ios", EVERYTHING_ON);

  assert.equal(providers[0], "apple");
});

test("Android never offers Apple, even with every provider enabled", () => {
  const { providers } = resolveProviders("android", EVERYTHING_ON);

  assert.deepEqual(providers, ["google", "facebook"]);
  assert.equal(providers.includes("apple"), false);
});

test("the web target never offers Apple either", () => {
  const { providers } = resolveProviders("web", EVERYTHING_ON);

  assert.equal(providers.includes("apple"), false);
});

test("enabling Apple on the shared project cannot reach Android or web clients", () => {
  // The config push that Stage 5C has to make, simulated: Apple on, for
  // everybody, because the setting is per-project and not per-platform.
  const applePushed = { external: { google: true, apple: true } };

  assert.equal(resolveProviders("ios", applePushed).providers.includes("apple"), true);
  assert.equal(
    resolveProviders("android", applePushed).providers.includes("apple"),
    false,
  );
  assert.equal(
    resolveProviders("web", applePushed).providers.includes("apple"),
    false,
  );
});

test("iOS does not offer Facebook, which has never completed a sign-in anywhere", () => {
  const { providers } = resolveProviders("ios", EVERYTHING_ON);

  assert.equal(providers.includes("facebook"), false);
});

// ---------------------------------------------------------------------------
// Provider discovery -- the project is asked, not assumed
// ---------------------------------------------------------------------------

test("a provider the project has disabled is not offered", () => {
  // Today's production shape: Google on, Facebook off, Apple not configured.
  const today = { external: { google: true, facebook: false, apple: false } };

  assert.deepEqual(resolveProviders("android", today).providers, ["google"]);
  assert.deepEqual(resolveProviders("ios", today).providers, ["google"]);
});

test("a provider absent from the settings entirely is not offered", () => {
  const sparse = { external: { google: true } };

  assert.deepEqual(resolveProviders("ios", sparse).providers, ["google"]);
});

test("only an explicit true enables a provider", () => {
  // Supabase answers with booleans. Anything else is not a yes, and a
  // truthy-but-not-true value must not become a button.
  const sloppy = {
    external: { google: "true", facebook: 1, apple: {} },
  } as unknown as { external?: Record<string, boolean> };

  assert.deepEqual(resolveProviders("ios", sloppy).providers, []);
  assert.deepEqual(resolveProviders("android", sloppy).providers, []);
});

test("an empty settings object offers nothing, and is not treated as a failure", () => {
  const { providers, degraded } = resolveProviders("ios", {});

  assert.deepEqual(providers, []);
  // The project answered. It just said no.
  assert.equal(degraded, false);
});

// ---------------------------------------------------------------------------
// Unavailable settings and network failure
// ---------------------------------------------------------------------------

test("iOS falls back to no third-party provider at all, never Google alone", () => {
  const { providers, degraded } = resolveProviders("ios", null);

  assert.deepEqual(providers, []);
  assert.equal(degraded, true);
});

test("the iOS fallback can never be a lone third-party login", () => {
  // The 4.8 property, stated directly: whatever the fallback becomes later, it
  // must not be a single third-party provider with no alternative beside it.
  const fallback = fallbackProviders("ios");

  assert.notEqual(fallback.length, 1, "a lone provider on iOS is the 4.8 trap");
  assert.equal(fallback.includes("google"), false);
});

test("off iOS the fallback stays Google, exactly as shipped", () => {
  const android = resolveProviders("android", null);

  assert.deepEqual(android.providers, ["google"]);
  assert.equal(android.degraded, true);
});

test("the fallback is marked degraded so the screen can say so", () => {
  for (const platform of ["ios", "android", "web"] as PlatformName[]) {
    assert.equal(
      resolveProviders(platform, null).degraded,
      true,
      `${platform} must report a failed settings read`,
    );
  }
});

test("a successful read is never marked degraded", () => {
  for (const platform of ["ios", "android", "web"] as PlatformName[]) {
    assert.equal(resolveProviders(platform, EVERYTHING_ON).degraded, false);
    assert.equal(resolveProviders(platform, {}).degraded, false);
  }
});

// ---------------------------------------------------------------------------
// The allow lists themselves
// ---------------------------------------------------------------------------

test("every allowed provider is one Eraya actually has code for", () => {
  for (const platform of ["ios", "android", "web"] as PlatformName[]) {
    for (const provider of allowedProviders(platform)) {
      assert.equal(
        ALL_PROVIDERS.includes(provider),
        true,
        `${provider} is allowed on ${platform} but is not a known provider`,
      );
    }
  }
});

test("a fallback never offers a provider the platform does not allow", () => {
  for (const platform of ["ios", "android", "web"] as PlatformName[]) {
    const allowed = allowedProviders(platform);
    for (const provider of fallbackProviders(platform)) {
      assert.equal(
        allowed.includes(provider),
        true,
        `${provider} is in ${platform}'s fallback but not its allow list`,
      );
    }
  }
});

test("resolve returns a subset of the platform's allow list, always", () => {
  for (const platform of ["ios", "android", "web"] as PlatformName[]) {
    const allowed = allowedProviders(platform);
    for (const provider of resolveProviders(platform, EVERYTHING_ON).providers) {
      assert.equal(allowed.includes(provider), true);
    }
  }
});
