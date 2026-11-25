import {
  config,
  fetchOrderPayments,
  isLiveMode,
  verifyCheckoutSignature,
} from "../_shared/razorpay.ts";
import { confirmAnyCapture, confirmCapture } from "../_shared/capture.ts";
import { admin, callerId, CORS, json, log } from "../_shared/request.ts";

/**
 * Which provider's order ids this endpoint speaks about.
 *
 * `payments` is unique on `(provider, provider_order_id)`, so every lookup here
 * carries both. This file only ever handles Razorpay -- a store purchase is
 * verified against the store, not against an order id a client hands over --
 * and naming the provider once is what stops a second one inheriting the
 * assumption that an order id is unique on its own.
 */
const PROVIDER = "razorpay" as const;

/**
 * Confirming a purchase, and rescuing one that got lost.
 *
 * Two jobs, one endpoint, because they answer the same question: is this order
 * actually paid?
 *
 * The first is the checkout callback. Razorpay hands the client a payment id
 * and a signature; the signature is checked here against the key secret, and a
 * client saying "it worked" without one proves nothing. Nothing about that
 * claim is trusted -- not the amount, not the status, not even that the order
 * belongs to whoever is asking.
 *
 * The second is reconciliation. Apps close mid-payment, callbacks are lost, and
 * networks disappear between the bank and the phone. When a client comes back
 * with only an order id, Razorpay's own record is fetched and believed instead.
 * Somebody whose money left their account must not need a support conversation
 * to get what they paid for.
 *
 * Both paths end at `settle_payment`, which is idempotent: whichever of the
 * callback, the webhook or a reconciliation arrives first grants the time, and
 * the rest return what it did.
 */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ status: "error" }, 405);

  const profile = await callerId(request);
  if (!profile) return json({ status: "unauthenticated" }, 401);

  const body = await request.json().catch(() => ({}));
  const orderId = String(body?.orderId ?? "");
  const paymentId = body?.paymentId ? String(body.paymentId) : null;
  const signature = body?.signature ? String(body.signature) : null;

  if (!orderId) return json({ status: "unknown_order" });

  const db = admin();

  /*
   * The order must be this member's.
   *
   * Without this, anybody could hand over somebody else's order id and have
   * the resulting term applied to their own account -- or simply learn that an
   * order exists. The lookup is by order id and profile together.
   */
  const { data: owned } = await db
    .from("payments")
    .select("id, status, profile_id, amount_paise, currency")
    .eq("provider", PROVIDER)
    .eq("provider_order_id", orderId)
    .eq("profile_id", profile)
    .maybeSingle();

  if (!owned) {
    log("payment_verify_foreign_order", {});
    return json({ status: "unknown_order" });
  }

  /*
   * What we recorded intending to charge, and which Razorpay we are talking to.
   *
   * Both are read from our side -- the `payments` row written before Razorpay
   * was ever called, and this function's own key -- never from the request.
   */
  const expectedPaise = Number(owned.amount_paise);
  const expectedCurrency = String(owned.currency);
  const settings = config();
  const live = settings ? isLiveMode(settings.keyId) : false;

  // Settled already, by the webhook or an earlier call. Nothing to redo.
  if (owned.status === "paid") {
    const { data: membership } = await db.rpc("my_membership_for", { p_profile: profile });
    return json({ status: "paid", membership });
  }

  /*
   * Refunded, and said so here rather than discovered at the bottom.
   *
   * Razorpay goes on reporting a refunded payment as `captured` -- the capture
   * happened, and the refund is a separate entity against it. So the
   * reconciliation path below would fetch that record, read it as proof, and
   * ask to settle. `settle_payment` refuses, because a revoked payment can
   * never buy time again, and answering the question up here makes that a
   * stated outcome instead of a near miss. The member's own history shows the
   * status through `my_payments()`.
   */
  if (owned.status === "refunded" || owned.status === "partially_refunded") {
    log("payment_verify_refunded", { status: owned.status });
    const { data: membership } = await db.rpc("my_membership_for", { p_profile: profile });
    return json({ status: owned.status, membership });
  }

  let confirmedPaymentId: string | null = null;

  if (paymentId && signature) {
    const valid = await verifyCheckoutSignature({ orderId, paymentId, signature });

    if (!valid) {
      log("payment_signature_invalid", {});
      await db.rpc("settle_payment", {
        p_provider: PROVIDER,
        p_order_id: orderId,
        p_provider_payment_id: null,
        p_status: "failed",
        p_live_mode: live,
      });
      return json({ status: "invalid_signature" });
    }

    /*
     * A valid signature is proof of authenticity, not proof of capture.
     *
     * It says Razorpay issued this payment id against this order and nobody
     * forged it. It says nothing about whether the money arrived. A payment can
     * be `authorized` and never captured -- auto-capture can be off at the
     * account, and some methods settle late -- and until 2026-11-25 this branch
     * treated the signature alone as sufficient and granted the term.
     *
     * So the signature is checked first, because it rejects a forgery without
     * spending a round trip, and then Razorpay's own record is read for the
     * same reason the reconciliation path below reads it: capture is a fact
     * about the provider's ledger, and the provider's ledger is where it lives.
     */
    const found = await fetchOrderPayments(orderId);

    const confirmed = found.ok
      ? confirmCapture(found.payments, paymentId, {
          amountPaise: expectedPaise,
          currency: expectedCurrency,
        })
      : ({ outcome: "unavailable" } as const);

    if (confirmed.outcome === "unavailable") {
      /*
       * We cannot establish capture right now. Deliberately `pending` rather
       * than granting on the strength of the signature: the webhook settles
       * this independently of the client being here, so nothing is lost but a
       * little time, and nothing is granted that was not paid for.
       */
      log("payment_capture_unconfirmed", {});
      return json({ status: "pending" });
    }

    if (confirmed.outcome === "not_captured") {
      log("payment_not_captured", { state: confirmed.state });
      return json({ status: "pending" });
    }

    if (confirmed.outcome === "mismatch") {
      /*
       * The captured amount or currency is not what we recorded intending to
       * charge. Never settle this: it is either a provider-side configuration
       * fault or an attempt to pay ₹1 for a year, and both want a human.
       */
      log("payment_amount_mismatch", {
        expected_paise: expectedPaise,
        expected_currency: expectedCurrency,
        captured_paise: confirmed.amountPaise,
        captured_currency: confirmed.currency,
      });
      return json({ status: "amount_mismatch" });
    }

    confirmedPaymentId = confirmed.paymentId;
  } else {
    /*
     * No signature, so ask the provider directly.
     *
     * This is the reconciliation path. Razorpay's record of the order is the
     * authority; a captured payment against it is proof regardless of what
     * reached the client, and its absence means there is nothing to grant yet
     * rather than that something failed.
     */
    const found = await fetchOrderPayments(orderId);

    if (!found.ok) {
      log("payment_reconcile_unavailable", {});
      return json({ status: "pending" });
    }

    const decision = confirmAnyCapture(found.payments, {
      amountPaise: expectedPaise,
      currency: expectedCurrency,
    });

    if (decision.outcome === "mismatch") {
      /*
       * Captured, but not for the amount or currency we recorded. Never
       * settled: it is either a provider-side configuration fault or an attempt
       * to pay a rupee for a year, and both want a human rather than a grant.
       */
      log("payment_amount_mismatch", {
        expected_paise: expectedPaise,
        expected_currency: expectedCurrency,
        captured_paise: decision.amountPaise,
        captured_currency: decision.currency,
      });
      return json({ status: "amount_mismatch" });
    }

    if (decision.outcome === "pending") return json({ status: "pending" });

    if (decision.outcome === "declined") {
      /*
       * Record the decline rather than only reporting it. This branch used to
       * return `failed` and stop, which left the row at `created` for ever.
       *
       * `settle_payment` refuses to touch a row that is already `paid`, so a
       * webhook landing between the fetch above and this call still wins.
       */
      await db.rpc("settle_payment", {
        p_provider: PROVIDER,
        p_order_id: orderId,
        p_provider_payment_id: decision.paymentId,
        p_status: "failed",
        p_live_mode: live,
      });

      /*
       * The provider's reason, in the log and nowhere else. What the member
       * reads is decided in the client and deliberately does not quote
       * Razorpay -- a bank's wording is not ours to put in somebody's mouth.
       * These fields describe the transaction, not the person.
       */
      const declined = found.payments.find(
        (p) => String(p.id ?? "") === decision.paymentId,
      ) ?? {};

      log("payment_declined", {
        payment_id: decision.paymentId,
        error_code: declined.error_code ? String(declined.error_code) : null,
        error_step: declined.error_step ? String(declined.error_step) : null,
        error_reason: declined.error_reason ? String(declined.error_reason) : null,
        error_description: declined.error_description
          ? String(declined.error_description)
          : null,
      });

      return json({ status: "failed" });
    }

    confirmedPaymentId = decision.paymentId;
  }

  const { data: settled, error } = await db.rpc("settle_payment", {
    p_provider: PROVIDER,
    p_order_id: orderId,
    p_provider_payment_id: confirmedPaymentId,
    p_status: "paid",
    p_live_mode: live,
  });

  if (error) {
    log("payment_settle_failed", { reason: error.message });
    return json({ status: "pending" });
  }

  const outcome = (settled as { outcome?: string })?.outcome ?? "pending";
  log("payment_settled", { outcome });

  /*
   * A payment created against the other Razorpay. Reported as its own status
   * rather than folded into `pending`, because `pending` invites the client to
   * keep asking and this will never change on its own. It should be unreachable
   * in normal operation -- the API would have to have answered for an order
   * from the other environment -- and that is exactly why it is worth saying
   * out loud if it ever happens.
   */
  if (outcome === "mode_mismatch") {
    return json({ status: "mode_mismatch" });
  }

  const { data: membership } = await db.rpc("my_membership_for", { p_profile: profile });

  return json({
    status: outcome === "paid" || outcome === "already_paid" ? "paid" : outcome,
    membership,
  });
});
