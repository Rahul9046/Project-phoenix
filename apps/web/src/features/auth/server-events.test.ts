import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyProviderError } from "./failure-reason.ts";

/**
 * Turning a provider's own words into something countable -- and safe.
 *
 *   npm test
 *
 * Two separate guarantees are being held here, and only one of them is about
 * analytics.
 *
 * The first is that `detail.reason` is a **category**. Facebook and Google both
 * have a great deal to say about why they refused and none of it is stable
 * enough to group by, so a chart built on their wording reads zero the week they
 * reword it.
 *
 * The second is the one that matters more: **the provider's text must never
 * reach the database.** An OAuth error message is attacker-influenced and
 * routinely carries an email address, a client id or a redirect URL with a state
 * token in it. `auth_events` is explicitly documented as never containing codes,
 * tokens or unmasked contact details, and this function is what keeps that true
 * on the OAuth path. The final test asserts the invariant directly rather than
 * trusting the mapping above it.
 */

/** Every value this function is allowed to return. */
const CATEGORIES = new Set([
  "declined",
  "provider_disabled",
  "redirect_rejected",
  "stale_exchange",
  "provider_error",
  "provider_refused",
]);

test("a declined consent screen is its own category", () => {
  /*
   * The most common outcome by far, and not really a failure of ours -- somebody
   * changed their mind. Keeping it distinguishable from a misconfiguration is
   * the reason this function exists at all: a dashboard that counts "user
   * pressed cancel" alongside "the app is not approved" cannot tell you whether
   * anything is broken.
   */
  assert.equal(classifyProviderError("access_denied"), "declined");
  assert.equal(classifyProviderError("error=access_denied&state=x"), "declined");
  assert.equal(classifyProviderError("user_denied"), "declined");
  assert.equal(classifyProviderError("Permissions error"), "declined");
  assert.equal(classifyProviderError("ACCESS_DENIED"), "declined");
});

test("a provider switched off at the project is named as such", () => {
  // Exactly what an installed Android build now hits for Facebook.
  assert.equal(
    classifyProviderError("Unsupported provider: provider is not enabled"),
    "provider_disabled",
  );
  assert.equal(classifyProviderError("Unsupported provider"), "provider_disabled");
});

test("a rejected redirect is separated from an outage", () => {
  /*
   * This is the failure that looks like an outage and is really one line of
   * configuration -- a URL missing from `additional_redirect_urls` or from the
   * provider's own allowlist. It earns its own category so nobody spends an
   * afternoon reading Worker logs for it.
   */
  assert.equal(classifyProviderError("redirect_uri_mismatch"), "redirect_rejected");
  assert.equal(classifyProviderError("requested url is not allowed"), "redirect_rejected");
  assert.equal(classifyProviderError("URL Blocked"), "redirect_rejected");
  assert.equal(classifyProviderError("this redirect uri is not whitelisted"), "redirect_rejected");
});

test("a reused or expired code is a stale exchange", () => {
  assert.equal(classifyProviderError("invalid flow state"), "stale_exchange");
  assert.equal(classifyProviderError("code verifier should be non-empty"), "stale_exchange");
  assert.equal(classifyProviderError("bad_code_verifier"), "stale_exchange");
  assert.equal(classifyProviderError("Token has expired"), "stale_exchange");
});

test("the provider's own fault is distinguishable from ours", () => {
  assert.equal(classifyProviderError("server_error"), "provider_error");
  assert.equal(classifyProviderError("temporarily unavailable"), "provider_error");
  // Facebook's generic page, which is what a Development-mode app serves.
  assert.equal(
    classifyProviderError("Sorry, something went wrong."),
    "provider_error",
  );
});

test("anything unrecognised still gets a category, never a blank", () => {
  assert.equal(classifyProviderError(""), "provider_refused");
  assert.equal(classifyProviderError("???"), "provider_refused");
  assert.equal(classifyProviderError("a brand new error nobody has seen"), "provider_refused");
});

test("the provider's text never survives classification", () => {
  /*
   * The privacy invariant, asserted on the thing that would actually leak. Each
   * of these is a shape real OAuth errors arrive in, and not one of them may
   * come back out -- no address, no token, no client id, no redirect URL.
   *
   * Every value is deliberately synthetic: `example.invalid` is reserved by
   * RFC 2606, the ids are zeroes, and the tokens say so in capitals. A test
   * whose job is to prove that secrets do not leak must not be the thing that
   * commits one, and a real-looking string here would trip secret scanning for
   * ever.
   */
  const dangerous = [
    "access_denied for someone@example.invalid",
    "invalid state=EXAMPLE.NOT-A-REAL-JWT.PLACEHOLDER",
    "redirect_uri https://eraya.app/auth/callback?code=EXAMPLE-NOT-A-REAL-CODE",
    "client_id 000000000000000 is not authorised",
    "Bearer EXAMPLE-NOT-A-REAL-TOKEN-000000",
    "user +910000000000 refused",
  ];

  for (const message of dangerous) {
    const reason = classifyProviderError(message);

    // It is one of the fixed categories, so by construction it carries nothing
    // from the input.
    assert.ok(
      CATEGORIES.has(reason),
      `"${message}" produced "${reason}", which is not a known category`,
    );

    // Stated the other way round too, because the assertion above would still
    // pass if a category were ever widened to interpolate the message.
    assert.doesNotMatch(reason, /@|\d{6,}|https?:|Bearer|\+91/);
  }
});

test("every category is reachable, so none is dead code", () => {
  const seen = new Set([
    classifyProviderError("access_denied"),
    classifyProviderError("provider is not enabled"),
    classifyProviderError("URL Blocked"),
    classifyProviderError("invalid flow state"),
    classifyProviderError("server_error"),
    classifyProviderError("something entirely new"),
  ]);
  assert.deepEqual([...seen].sort(), [...CATEGORIES].sort());
});
