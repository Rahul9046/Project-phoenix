import { verifyWebhookSignature } from "../_shared/razorpay.ts";
import { admin, json, log } from "../_shared/request.ts";

/**
 * What Razorpay says happened, which is the only account that matters.
 *
 * A client callback is a hint. It arrives if the app is still open, if the
 * browser did not close, if the network held up between the bank and the phone
 * -- and money moves whether or not any of that is true. This endpoint is the
 * path that does not depend on the person still being there.
 *
 * Three properties make it safe to expose publicly:
 *
 *   Nothing unsigned is believed. The body is verified byte for byte against
 *   the webhook secret before it is parsed as anything meaningful. An
 *   unsigned request cannot grant a membership, and neither can one signed
 *   with the wrong secret.
 *
 *   Nothing is acted on twice. Razorpay retries deliveries by design, and
 *   `claim_payment_event` takes the delivery id in a single statement -- so of
 *   two copies arriving together, exactly one proceeds.
 *
 *   Nothing here decides a price. It settles an order that was created and
 *   priced by us, matched on Razorpay's own order id.
 *
 * There is no JWT on this route: Razorpay has no Supabase session and never
 * will. The signature is the authentication, which is why it is checked first
 * and why the function must be deployed with verification disabled --
 * documented in docs/10-payments.md.
 */

const CAPTURED = new Set(["payment.captured", "order.paid"]);
const FAILED = new Set(["payment.failed"]);

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ status: "error" }, 405);

  /*
   * The raw text, not the parsed object.
   *
   * The signature covers the exact bytes Razorpay sent. Parsing and
   * re-serialising changes key order and whitespace, and the signature of a
   * re-serialised body never matches -- which looks like an attack and is
   * really just JSON.
   */
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!signature || !(await verifyWebhookSignature(raw, signature))) {
    log("webhook_signature_invalid", {});
    // Deliberately terse. An endpoint that explains why a signature failed is
    // an endpoint that helps somebody produce a better forgery.
    return json({ status: "rejected" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ status: "rejected" }, 400);
  }

  const eventType = String(payload.event ?? "");
  // Razorpay's own delivery id. The header is present in current deliveries;
  // the fallback keeps a delivery without one from being dropped, while still
  // collapsing genuine duplicates of the same payment event.
  const eventId =
    request.headers.get("x-razorpay-event-id") ??
    `${eventType}:${extractOrderId(payload) ?? crypto.randomUUID()}`;

  const db = admin();

  const { data: claimed } = await db.rpc("claim_payment_event", {
    p_event_id: eventId,
    p_event_type: eventType,
  });

  if (!claimed) {
    // A retry of something already handled. Answering 200 is the point: a
    // non-2xx makes Razorpay retry again, for ever, over work already done.
    log("webhook_duplicate", { event: eventType });
    return json({ status: "duplicate" });
  }

  const orderId = extractOrderId(payload);

  if (!orderId) {
    log("webhook_no_order", { event: eventType });
    return json({ status: "ignored" });
  }

  if (CAPTURED.has(eventType)) {
    const { data: settled, error } = await db.rpc("settle_payment", {
      p_order_id: orderId,
      p_provider_payment_id: extractPaymentId(payload),
      p_status: "paid",
    });

    if (error) {
      log("webhook_settle_failed", { event: eventType, reason: error.message });
      // A 5xx asks Razorpay to try again, which is right when the failure is
      // ours and probably temporary.
      return json({ status: "error" }, 500);
    }

    log("webhook_settled", {
      event: eventType,
      outcome: String((settled as { outcome?: string })?.outcome ?? ""),
    });
    return json({ status: "ok" });
  }

  if (FAILED.has(eventType)) {
    await db.rpc("settle_payment", {
      p_order_id: orderId,
      p_provider_payment_id: extractPaymentId(payload),
      p_status: "failed",
    });
    log("webhook_failed_payment", { event: eventType });
    return json({ status: "ok" });
  }

  /*
   * Everything else is acknowledged and ignored.
   *
   * Refunds in particular: Razorpay will send them, and what a refund should do
   * to a membership is a product decision nobody has made. Silently removing
   * access is the wrong half to guess at, so the event is recorded as seen and
   * the entitlement is left alone. See docs/10-payments.md.
   */
  log("webhook_ignored", { event: eventType });
  return json({ status: "ignored" });
});

function entity(payload: Record<string, unknown>, name: string): Record<string, unknown> | null {
  const container = payload.payload as Record<string, unknown> | undefined;
  const wrapper = container?.[name] as Record<string, unknown> | undefined;
  return (wrapper?.entity as Record<string, unknown>) ?? null;
}

/** Both shapes carry it: `payment.entity.order_id`, or `order.entity.id`. */
function extractOrderId(payload: Record<string, unknown>): string | null {
  const payment = entity(payload, "payment");
  if (payment && typeof payment.order_id === "string") return payment.order_id;

  const order = entity(payload, "order");
  if (order && typeof order.id === "string") return order.id;

  return null;
}

function extractPaymentId(payload: Record<string, unknown>): string | null {
  const payment = entity(payload, "payment");
  return payment && typeof payment.id === "string" ? payment.id : null;
}
