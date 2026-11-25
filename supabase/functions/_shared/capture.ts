/**
 * Deciding whether Razorpay's record proves a capture, for what we asked.
 *
 * Pure on purpose, and in its own file for the same reason `failure-reason.ts`
 * is: everything around it needs Deno, a network and a live Razorpay account,
 * and none of that can run on the build machine -- there is no Deno here and no
 * staging anywhere. The part that decides whether somebody gets a paid
 * membership is a function over an array, so it can simply be asked. See
 * `capture.test.ts`.
 *
 * What it is protecting against, in order of how expensive each would be:
 *
 *   A payment that was authorized and never captured. The signature on a
 *   checkout callback proves Razorpay issued that payment id for that order
 *   and that nobody forged it. It proves nothing about the money. Auto-capture
 *   can be off at the account and some methods settle late, and until
 *   2026-11-25 a valid signature alone was enough to grant the term.
 *
 *   A captured amount that is not the amount we recorded intending to charge.
 *   Razorpay enforces the order amount, so this should be unreachable -- but
 *   that is the provider's invariant to keep, not ours, and the cost of
 *   checking it is one comparison.
 *
 *   The wrong payment on a busy order. An order can carry several attempts. The
 *   question is about the attempt whose signature was just verified, not about
 *   whether any attempt against the order ever succeeded.
 */

export type CaptureDecision =
  | { outcome: "captured"; paymentId: string }
  | { outcome: "mismatch"; amountPaise: number | null; currency: string | null }
  | { outcome: "not_captured"; state: string | null };

/** Razorpay sends minor units as a number; anything else is not an amount. */
export function amountOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

/**
 * The attempt named by `paymentId`, judged against what we meant to charge.
 *
 * Note what is *not* here: any notion of "some payment on this order was
 * captured, so this is fine". Each decision is about one payment id.
 */
export function confirmCapture(
  payments: readonly Record<string, unknown>[],
  paymentId: string,
  expected: { amountPaise: number; currency: string },
): CaptureDecision {
  const mine = payments.find((p) => String(p.id ?? "") === paymentId);

  // Razorpay has no such payment against this order. Not an answer about
  // money, so it is not treated as a decline.
  if (!mine) return { outcome: "not_captured", state: null };

  const state = typeof mine.status === "string" ? mine.status : null;
  if (state !== "captured") return { outcome: "not_captured", state };

  const amountPaise = amountOf(mine.amount);
  const currency = typeof mine.currency === "string" ? mine.currency : null;

  /*
   * A missing currency is read as the expected one, because Razorpay always
   * sends it and the account is INR-only -- but a currency that is present and
   * different is a mismatch, never a pass.
   */
  if (
    amountPaise !== expected.amountPaise ||
    (currency ?? expected.currency) !== expected.currency
  ) {
    return { outcome: "mismatch", amountPaise, currency };
  }

  return { outcome: "captured", paymentId };
}

/**
 * The same judgement for the reconciliation path, which has no payment id.
 *
 * A client that comes back with only an order id -- an app closed mid-payment,
 * a lost callback -- is asking "did any of this get paid". So this one does
 * scan, but it still refuses a capture whose amount or currency is not ours,
 * and it reports that separately from "nothing captured yet". Collapsing those
 * two would turn a payment that needs a human into a spinner.
 */
export function confirmAnyCapture(
  payments: readonly Record<string, unknown>[],
  expected: { amountPaise: number; currency: string },
):
  | { outcome: "captured"; paymentId: string }
  | { outcome: "mismatch"; amountPaise: number | null; currency: string | null }
  | { outcome: "declined"; paymentId: string | null }
  | { outcome: "pending" } {
  const captured = payments.filter((p) => p.status === "captured");

  for (const p of captured) {
    const decision = confirmCapture(payments, String(p.id ?? ""), expected);
    if (decision.outcome === "captured") return decision;
  }

  // Captured, but not for our amount. Worth its own outcome.
  if (captured.length > 0) {
    const first = captured[0];
    return {
      outcome: "mismatch",
      amountPaise: amountOf(first.amount),
      currency: typeof first.currency === "string" ? first.currency : null,
    };
  }

  const declined = payments.find((p) => p.status === "failed");
  if (declined) {
    return {
      outcome: "declined",
      paymentId: declined.id ? String(declined.id) : null,
    };
  }

  return { outcome: "pending" };
}
