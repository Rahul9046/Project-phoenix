import assert from "node:assert/strict";
import { test } from "node:test";

import { OAUTH_HANDOFF_COOKIE, readOAuthHandoff } from "./oauth-handoff.ts";

/**
 * Reading the handoff cookie back.
 *
 *   npm test
 *
 * `node --test` and `node:assert` -- no framework and no new dependency, the
 * same arrangement as `features/guides/select.test.ts`. This module can be
 * imported directly because its only import is an `import type`, which Node's
 * type stripping erases; that is deliberate and this test is what keeps it true.
 *
 * Worth testing rather than eyeballing, for one reason: **the value arrives from
 * a request**. A cookie is whatever the sender put in it, so this function is a
 * trust boundary, and a trust boundary that is only read and nodded at is the
 * kind that turns out to have been a `startsWith` all along.
 */

test("recognised providers are returned unchanged", () => {
  assert.equal(readOAuthHandoff("google"), "google");
  assert.equal(readOAuthHandoff("facebook"), "facebook");
  // Apple is not configured on the project, but it is a provider the type
  // admits, so it must round-trip rather than be silently dropped here.
  assert.equal(readOAuthHandoff("apple"), "apple");
});

test("a missing cookie is null, not a guess", () => {
  assert.equal(readOAuthHandoff(undefined), null);
  assert.equal(readOAuthHandoff(""), null);
});

test("anything unrecognised is null", () => {
  // A provider Eraya does not offer.
  assert.equal(readOAuthHandoff("twitter"), null);
  assert.equal(readOAuthHandoff("azure"), null);
  // Nonsense.
  assert.equal(readOAuthHandoff("null"), null);
  assert.equal(readOAuthHandoff("undefined"), null);
});

test("matching is exact, not a prefix and not case-insensitive", () => {
  /*
   * The failure these three pin: a `startsWith` or a lowercasing comparison
   * would let a forged cookie steer attribution, and the whole point of this
   * change is that an event means what it says. The worst outcome of a rejected
   * cookie is an unattributed outcome, which is the correct way to fail.
   */
  assert.equal(readOAuthHandoff("google-evil"), null);
  assert.equal(readOAuthHandoff("googlex"), null);
  assert.equal(readOAuthHandoff("GOOGLE"), null);
  assert.equal(readOAuthHandoff("Facebook"), null);
  assert.equal(readOAuthHandoff(" google"), null);
  assert.equal(readOAuthHandoff("google "), null);
});

test("a cookie carrying a payload is refused outright", () => {
  // Nothing is parsed out of this value, so there is nothing to smuggle in it.
  assert.equal(readOAuthHandoff("google; Path=/; HttpOnly"), null);
  assert.equal(readOAuthHandoff('{"provider":"google"}'), null);
  assert.equal(readOAuthHandoff("google\nfacebook"), null);
});

test("the cookie name is stable", () => {
  /*
   * Renaming this is a silent break, not a compile error: the browser writes one
   * name at handoff and the route reads another a few seconds later, across a
   * deploy boundary where both versions are briefly live. Every OAuth outcome in
   * that window would be recorded unattributed and nothing would complain.
   */
  assert.equal(OAUTH_HANDOFF_COOKIE, "eraya_oauth_handoff");
});
