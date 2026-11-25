import assert from "node:assert/strict";
import { test } from "node:test";

import { salesOpenFrom } from "./sales.ts";

/**
 * Whether Eraya is selling anything.
 *
 *   npm test
 *
 * One function over one string, which is the only reason any of this can be
 * tested on this machine: there is no Deno here, so the edge functions cannot
 * be run or even type-checked, and no Docker, so the SQL cannot be executed.
 * `capture.ts` is pure for the same reason. What these tests establish is the
 * *decision* -- that an unset or unrecognised value means the till is shut.
 * They do not establish that production refuses an order; only a deployment
 * does that, and `payments-create-order` is where the decision is applied.
 *
 * The cost of getting this wrong is not an error message. Razorpay test
 * credentials are configured in production and Razorpay has refused to
 * activate the account, so an open till means a member is shown a payment
 * sheet for a product that cannot be sold, and a test card buys a real
 * membership term. Default-closed is the whole safety property, so it is
 * asserted first and from several directions.
 */

// ---------------------------------------------------------------------------
// Default closed
// ---------------------------------------------------------------------------

test("an unset variable means the till is shut", () => {
  // The production state on launch day. Nothing is set, nothing is going to be
  // set, and deploying the function is therefore the entire change.
  assert.equal(salesOpenFrom(undefined), false);
});

test("an absent value means the till is shut", () => {
  assert.equal(salesOpenFrom(null), false);
});

test("an empty value means the till is shut", () => {
  // A variable declared and left blank -- the shape a half-finished
  // configuration change leaves behind.
  assert.equal(salesOpenFrom(""), false);
});

// ---------------------------------------------------------------------------
// Only `true` opens it
// ---------------------------------------------------------------------------

test("only the exact string true opens the till", () => {
  assert.equal(salesOpenFrom("true"), true);
});

test("nothing that merely means yes opens the till", () => {
  /*
   * Every one of these is something somebody would plausibly type meaning "on",
   * and every one of them must fail closed. A truthiness check would have
   * accepted most of them, and "1" is what a boolean becomes on its way through
   * a shell. The cost of a lenient parse here is charging people.
   */
  for (const value of ["1", "yes", "y", "on", "enabled", "True", "TRUE", "tRue"]) {
    assert.equal(salesOpenFrom(value), false, `${value} must not open the till`);
  }
});

test("true with whitespace around it does not open the till", () => {
  /*
   * Not trimmed, deliberately. A trailing space in a secret is a mistake, and
   * the safe reading of a mistake in this particular variable is "no". The
   * operator who typed it will find a shut till, which is recoverable; the
   * alternative is a shop nobody meant to open.
   */
  for (const value of [" true", "true ", " true ", "\ttrue", "true\n"]) {
    assert.equal(salesOpenFrom(value), false, `${JSON.stringify(value)} must not open the till`);
  }
});

test("a value that only contains true does not open the till", () => {
  for (const value of ["untrue", "truex", "true,false", "false true"]) {
    assert.equal(salesOpenFrom(value), false, `${value} must not open the till`);
  }
});

test("false is false, said explicitly", () => {
  // The value an operator writes when deliberately shutting the till, rather
  // than removing the variable. It must read the same as absent.
  assert.equal(salesOpenFrom("false"), false);
  assert.equal(salesOpenFrom("0"), false);
});
