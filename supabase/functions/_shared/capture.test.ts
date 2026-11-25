import assert from "node:assert/strict";
import { test } from "node:test";

import { amountOf, confirmAnyCapture, confirmCapture } from "./capture.ts";

/**
 * Whether Razorpay's record proves a capture, for what we asked.
 *
 *   npm test
 *
 * This is the function that decides whether somebody gets a paid membership,
 * and it is the only part of the payment path on this machine that can be
 * executed at all: there is no Deno here, so the edge functions cannot even be
 * type-checked, and no Docker, so the SQL cannot be run. Everything else about
 * payments is reasoned, reviewed, or proved by a probe that writes to
 * production. This can simply be asked, so it is.
 *
 * `payments:probe` covers the live flow end to end and is **not** run by
 * `npm test`, because it creates a throwaway auth user and real payment rows in
 * the one production project.
 */

const EXPECTED = { amountPaise: 19_900, currency: "INR" } as const;

/** A Razorpay payment entity, reduced to the fields this logic reads. */
const payment = (over: Record<string, unknown> = {}) => ({
  id: "pay_LIVE000000001",
  status: "captured",
  amount: 19_900,
  currency: "INR",
  ...over,
});

// ---------------------------------------------------------------------------
// confirmCapture -- the checkout-callback path, about one named payment
// ---------------------------------------------------------------------------

test("a captured payment for the recorded amount is proof", () => {
  const decision = confirmCapture([payment()], "pay_LIVE000000001", EXPECTED);
  assert.deepEqual(decision, { outcome: "captured", paymentId: "pay_LIVE000000001" });
});

test("authorized but not captured is not proof", () => {
  /*
   * The defect this exists for. A valid checkout signature proves Razorpay
   * issued the payment id for the order; it says nothing about the money.
   * Auto-capture can be off at the account and some methods settle late, and
   * before 2026-11-25 the signature alone granted the term.
   */
  const decision = confirmCapture(
    [payment({ status: "authorized" })],
    "pay_LIVE000000001",
    EXPECTED,
  );
  assert.deepEqual(decision, { outcome: "not_captured", state: "authorized" });
});

test("every non-captured state is refused, not just authorized", () => {
  for (const status of ["created", "authorized", "refunded", "failed", "pending"]) {
    const decision = confirmCapture(
      [payment({ status })],
      "pay_LIVE000000001",
      EXPECTED,
    );
    assert.equal(decision.outcome, "not_captured", `status ${status} must not pass`);
  }
});

test("an unknown payment id is not an answer about money", () => {
  // Absence is not a decline: nothing should be recorded as failed on this.
  const decision = confirmCapture([payment()], "pay_SOMETHINGELSE", EXPECTED);
  assert.deepEqual(decision, { outcome: "not_captured", state: null });
});

test("the wrong amount is a mismatch, in either direction", () => {
  const under = confirmCapture(
    [payment({ amount: 100 })],
    "pay_LIVE000000001",
    EXPECTED,
  );
  assert.equal(under.outcome, "mismatch");

  const over = confirmCapture(
    [payment({ amount: 1_000_000 })],
    "pay_LIVE000000001",
    EXPECTED,
  );
  assert.equal(over.outcome, "mismatch");

  // One paisa short is still short.
  const nearly = confirmCapture(
    [payment({ amount: 19_899 })],
    "pay_LIVE000000001",
    EXPECTED,
  );
  assert.equal(nearly.outcome, "mismatch");
});

test("the wrong currency is a mismatch", () => {
  const decision = confirmCapture(
    [payment({ currency: "USD" })],
    "pay_LIVE000000001",
    EXPECTED,
  );
  assert.equal(decision.outcome, "mismatch");
  if (decision.outcome === "mismatch") assert.equal(decision.currency, "USD");
});

test("a missing amount is a mismatch, never a pass", () => {
  for (const amount of [undefined, null, "19900", NaN, Infinity, {}]) {
    const decision = confirmCapture(
      [payment({ amount })],
      "pay_LIVE000000001",
      EXPECTED,
    );
    assert.equal(
      decision.outcome,
      "mismatch",
      `amount ${String(amount)} must not pass`,
    );
  }
});

test("the right payment is judged on a busy order", () => {
  /*
   * An order can carry several attempts. The question is about the one whose
   * signature was just verified -- not whether anything against the order ever
   * succeeded, which is how a failed retry after a successful capture could
   * otherwise be read as a success, or worse, the reverse.
   */
  const payments = [
    payment({ id: "pay_FAILED", status: "failed" }),
    payment({ id: "pay_SMALL", amount: 100 }),
    payment({ id: "pay_GOOD" }),
  ];

  assert.equal(confirmCapture(payments, "pay_GOOD", EXPECTED).outcome, "captured");
  assert.equal(confirmCapture(payments, "pay_SMALL", EXPECTED).outcome, "mismatch");
  assert.equal(confirmCapture(payments, "pay_FAILED", EXPECTED).outcome, "not_captured");
});

test("an empty record grants nothing", () => {
  assert.equal(confirmCapture([], "pay_LIVE000000001", EXPECTED).outcome, "not_captured");
});

// ---------------------------------------------------------------------------
// confirmAnyCapture -- the reconciliation path, with no payment id to go on
// ---------------------------------------------------------------------------

test("reconciliation finds a matching capture among several attempts", () => {
  const decision = confirmAnyCapture(
    [
      payment({ id: "pay_FAILED", status: "failed" }),
      payment({ id: "pay_GOOD" }),
    ],
    EXPECTED,
  );
  assert.deepEqual(decision, { outcome: "captured", paymentId: "pay_GOOD" });
});

test("reconciliation reports a wrong-amount capture rather than settling it", () => {
  const decision = confirmAnyCapture([payment({ amount: 100 })], EXPECTED);
  assert.equal(decision.outcome, "mismatch");
});

test("reconciliation separates a decline from an order still moving", () => {
  assert.deepEqual(
    confirmAnyCapture([payment({ id: "pay_NO", status: "failed" })], EXPECTED),
    { outcome: "declined", paymentId: "pay_NO" },
  );

  // Nothing captured and nothing declined: still in flight. Must not be read
  // as a decline, or somebody is told their bank refused a payment it is still
  // processing.
  assert.deepEqual(
    confirmAnyCapture([payment({ status: "created" })], EXPECTED),
    { outcome: "pending" },
  );

  assert.deepEqual(confirmAnyCapture([], EXPECTED), { outcome: "pending" });
});

test("a capture beats a decline on the same order", () => {
  /*
   * Somebody whose first attempt failed and second succeeded has paid. Order of
   * the array must not decide the answer.
   */
  for (const payments of [
    [payment({ id: "pay_NO", status: "failed" }), payment({ id: "pay_YES" })],
    [payment({ id: "pay_YES" }), payment({ id: "pay_NO", status: "failed" })],
  ]) {
    const decision = confirmAnyCapture(payments, EXPECTED);
    assert.equal(decision.outcome, "captured");
    if (decision.outcome === "captured") assert.equal(decision.paymentId, "pay_YES");
  }
});

test("a refunded payment is not a capture to settle again", () => {
  /*
   * Razorpay goes on reporting a refunded payment as `captured` -- the capture
   * happened and the refund is a separate entity. That case is caught earlier,
   * by the row's own `refunded` status and by `settle_payment` refusing a
   * revoked payment. Here only the literal `refunded` state is asserted, so
   * nobody later reads this file as a claim that it handles refunds.
   */
  assert.equal(
    confirmAnyCapture([payment({ status: "refunded" })], EXPECTED).outcome,
    "pending",
  );
});

// ---------------------------------------------------------------------------
// amountOf
// ---------------------------------------------------------------------------

test("amountOf accepts only finite numbers", () => {
  assert.equal(amountOf(19_900), 19_900);
  assert.equal(amountOf(0), 0);
  assert.equal(amountOf(19_900.4), 19_900);
  assert.equal(amountOf("19900"), null);
  assert.equal(amountOf(null), null);
  assert.equal(amountOf(undefined), null);
  assert.equal(amountOf(NaN), null);
  assert.equal(amountOf(Infinity), null);
});
