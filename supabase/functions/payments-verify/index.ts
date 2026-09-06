import { fetchOrderPayments, verifyCheckoutSignature } from "../_shared/razorpay.ts";
import { admin, callerId, CORS, json, log } from "../_shared/request.ts";

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
    .select("id, status, profile_id")
    .eq("provider_order_id", orderId)
    .eq("profile_id", profile)
    .maybeSingle();

  if (!owned) {
    log("payment_verify_foreign_order", {});
    return json({ status: "unknown_order" });
  }

  // Settled already, by the webhook or an earlier call. Nothing to redo.
  if (owned.status === "paid") {
    const { data: membership } = await db.rpc("my_membership_for", { p_profile: profile });
    return json({ status: "paid", membership });
  }

  let confirmedPaymentId: string | null = null;

  if (paymentId && signature) {
    const valid = await verifyCheckoutSignature({ orderId, paymentId, signature });

    if (!valid) {
      log("payment_signature_invalid", {});
      await db.rpc("settle_payment", {
        p_order_id: orderId,
        p_provider_payment_id: null,
        p_status: "failed",
      });
      return json({ status: "invalid_signature" });
    }

    confirmedPaymentId = paymentId;
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

    const captured = found.payments.find((p) => p.status === "captured");

    if (!captured) {
      const failed = found.payments.some((p) => p.status === "failed");
      return json({ status: failed ? "failed" : "pending" });
    }

    confirmedPaymentId = String(captured.id ?? "");
  }

  const { data: settled, error } = await db.rpc("settle_payment", {
    p_order_id: orderId,
    p_provider_payment_id: confirmedPaymentId,
    p_status: "paid",
  });

  if (error) {
    log("payment_settle_failed", { reason: error.message });
    return json({ status: "pending" });
  }

  const outcome = (settled as { outcome?: string })?.outcome ?? "pending";
  log("payment_settled", { outcome });

  const { data: membership } = await db.rpc("my_membership_for", { p_profile: profile });

  return json({
    status: outcome === "paid" || outcome === "already_paid" ? "paid" : outcome,
    membership,
  });
});
