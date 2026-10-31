import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/*
 * Relative, not `@/`. The alias is a Metro and tsc path mapping; Node resolves
 * neither it nor an extensionless path, and this file has to run under
 * `node --test` with no bundler. Same reason `provider.test.ts` imports
 * `./distribution.ts` by its real name.
 */
import { distributionChannelFrom } from "../membership/distribution.ts";
import { passwordFailureKey } from "./password-failures.ts";

/**
 * The reviewer password sign-in.
 *
 * Two things are asserted here and they are different in kind.
 *
 * The failure mapping is a pure function and is tested by calling it, over
 * every status GoTrue returns from `signInWithPassword`.
 *
 * Everything else is a **property of the source**, checked by reading it. That
 * is unusual and deliberate: the claims worth defending are negative ones --
 * no service-role key, no `signUp`, no client-side email allowlist standing in
 * for security, no password in a log -- and a negative claim cannot be proved
 * by calling a function. It can be broken by one line somebody adds in good
 * faith, which is exactly what a check should catch.
 *
 * What no test here can prove: that a real password authenticates. That needs
 * the password, which is not in this repository and must never be.
 */

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "password-sign-in.ts"), "utf8");
const screen = readFileSync(
  resolve(here, "..", "..", "..", "app", "sign-in.tsx"),
  "utf8",
);

// ---------------------------------------------------------------------------
// 1. Failures say something a person can act on
// ---------------------------------------------------------------------------

test("a credential that does not match is reported as such", () => {
  assert.equal(
    passwordFailureKey(400, "Invalid login credentials").messageKey,
    "failures.passwordIncorrect",
  );
  assert.equal(
    passwordFailureKey(401, "Invalid login credentials").messageKey,
    "failures.passwordIncorrect",
  );
});

test("an unconfirmed address is not reported as a wrong password", () => {
  // Telling somebody their password is wrong when the real problem is an
  // unconfirmed mailbox sends them to retype something that was already right.
  for (const message of ["Email not confirmed", "email_not_confirmed"]) {
    assert.equal(
      passwordFailureKey(400, message).messageKey,
      "failures.signInFailed",
    );
  }
});

test("rate limiting is named, so nobody retries into it", () => {
  assert.equal(
    passwordFailureKey(429, "Too many requests").messageKey,
    "failures.emailRateLimited",
  );
});

test("no status at all is a network problem, not a rejection", () => {
  assert.equal(
    passwordFailureKey(undefined, "fetch failed").messageKey,
    "failures.signInNetwork",
  );
});

test("every mapped outcome is a failure carrying a key", () => {
  for (const status of [undefined, 400, 401, 403, 429, 500, 503]) {
    const outcome = passwordFailureKey(status, "whatever");
    assert.equal(outcome.ok, false);
    assert.ok(
      outcome.messageKey.startsWith("failures."),
      `${String(status)} produced ${outcome.messageKey}`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2. Only the Play build offers it
// ---------------------------------------------------------------------------

test("the option is offered in the Play build and nowhere else", () => {
  /*
   * Asserted through the channel resolver rather than by importing
   * `passwordSignInOffered`, which reads `process.env` at module load and would
   * be fixed to whatever this test process happens to have.
   */
  assert.equal(distributionChannelFrom("play") === "play", true);
  for (const value of [undefined, "", "direct", "Play", "plays"]) {
    assert.notEqual(
      distributionChannelFrom(value),
      "play",
      `${JSON.stringify(value)} must not offer password sign-in`,
    );
  }
});

test("the offer is derived from the build channel, not from a runtime value", () => {
  assert.match(
    source,
    /export const passwordSignInOffered: boolean = distributedThroughPlay;/,
    "the offer must come from the one build-identity authority",
  );
  // One authority, not a second copy of the rule.
  assert.ok(
    !/process\.env\.EXPO_PUBLIC_DISTRIBUTION/.test(source),
    "re-reading the variable here would be a second channel authority",
  );
});

test("the screen renders the field only behind that flag", () => {
  assert.ok(
    screen.includes("{passwordSignInOffered ? ("),
    "the password UI must be gated on the build channel",
  );
  // And the gate sits before the field, not after it.
  assert.ok(
    screen.indexOf("{passwordSignInOffered ? (") <
      screen.indexOf("secureTextEntry"),
    "the field must be inside the gate",
  );
});

// ---------------------------------------------------------------------------
// 3. The negative claims — what this must never become
// ---------------------------------------------------------------------------

test("no account can be created through this path", () => {
  /*
   * `signInWithPassword` authenticates an account that exists and cannot make
   * one. A `signUp` call here would let anybody create an account with no email
   * round-trip, which is a real hole and is not what a reviewer needs.
   */
  /*
   * A call, not a mention. The prose above explains why there is no sign-up
   * here, so matching the bare word would fail on its own documentation --
   * which is how a check ends up being loosened until it checks nothing.
   */
  assert.ok(!/\.signUp\s*\(/.test(source), "no sign-up call may exist here");
  assert.ok(!/\.signUp\s*\(/.test(screen), "nor on the screen");
  assert.ok(/supabase\.auth\.signInWithPassword\(/.test(source));
});

test("no service-role key, no admin client, no minted session", () => {
  for (const forbidden of [
    "service_role",
    "SERVICE_ROLE",
    "serviceRole",
    "createAdminClient",
    "admin.auth",
    "setSession",
    "signInWithIdToken",
  ]) {
    assert.ok(
      !source.includes(forbidden),
      `${forbidden} must not appear in a client credential path`,
    );
  }
});

test("no password is hardcoded, and no address is privileged in the client", () => {
  /*
   * Two separate claims.
   *
   * No credential in the bundle: a password here would ship to every install
   * and be extractable from the APK.
   *
   * And no email allowlist. A client-side check that only one address may use
   * this form would read as a security boundary and be none -- it is in a
   * bundle anybody can read and is skipped entirely by calling the auth
   * endpoint directly. The real restriction is that no other account has a
   * password, which is a fact about the server. Writing the address here would
   * also leak which account to attack.
   */
  assert.ok(
    !/tech@eraya\.app/.test(source),
    "the reviewer address must not be in the client",
  );
  assert.ok(
    !/tech@eraya\.app/.test(screen),
    "the reviewer address must not be in the screen",
  );
  assert.ok(
    !/password\s*===\s*["'`]/.test(source),
    "no literal password comparison",
  );
});

test("the password is never recorded", () => {
  /*
   * The address is masked and sent as an analytics identifier; the password
   * must not travel with it. Checked by asserting the recorded payload shape
   * mentions only `identifier` and `reason`.
   */
  const events = source.match(/recordAuthEvent\([^)]*\)/gs) ?? [];
  assert.ok(events.length > 0, "the outcome should be recorded at all");
  for (const call of events) {
    assert.ok(
      !/password/.test(call.replace(/reason:\s*"password"/g, "")),
      `a recorded event must not carry the password: ${call}`,
    );
  }
});

test("the password is not trimmed or length-checked into something else", () => {
  // Trimming silently changes the credential; a client-side minimum would
  // reject a valid password if the server's rule ever differed.
  assert.ok(
    !/password\.trim\(\)/.test(source),
    "trimming would alter the credential",
  );
  assert.ok(
    !/password\.length\s*<\s*[1-9]/.test(source),
    "no client-side password length rule",
  );
});

// ---------------------------------------------------------------------------
// 4. The ordinary flows are untouched
// ---------------------------------------------------------------------------

test("the OTP and OAuth paths are still on the screen", () => {
  for (const kept of [
    "sendEmailSignIn",
    "signInWithProvider",
    "availableProviders",
    'routes.checkEmail',
  ]) {
    assert.ok(screen.includes(kept), `${kept} must survive`);
  }
});

test("the password failure is reported on its own field", () => {
  /*
   * The email field renders `error`; the password field renders
   * `passwordError`. Sharing one would print a password failure under the email
   * control near the top of the screen -- off screen on a phone, so it would
   * read as nothing having happened.
   */
  assert.ok(screen.includes("error={passwordError}"));
  assert.ok(screen.includes("setPasswordError("));
});
