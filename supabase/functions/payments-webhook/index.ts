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

/**
 * Which provider's order ids this endpoint speaks about.
 *
 * `payments` is unique on `(provider, provider_order_id)`, and both database
 * functions called below take the provider as their first argument for that
 * reason. Naming it once here is what stops a second provider's webhook
 * inheriting the assumption that an order id is unique on its own.
 */
const PROVIDER = "razorpay" as const;

const CAPTURED = new Set(["payment.captured", "order.paid"]);
const FAILED = new Set(["payment.failed"]);

/*
 * Refunds, which now do something.
 *
 * `refund.processed` is the one that matters: the money has gone back. Acted on
 * rather than acknowledged and ignored, which is what used to happen -- a
 * member could be refunded in full and keep Premium, because nothing in this
 * system could shorten a term.
 *
 * `refund.created` is deliberately not here. A refund that has been initiated
 * is not a refund that has settled, and withdrawing somebody's membership on
 * the strength of an intention that may still fail is the wrong way round.
 *
 * What counts as "in full" is decided against the payment's own amount, below.
 * A partial refund changes no entitlement, because what a partial refund should
 * do to a prepaid term is a product decision nobody has made -- and inventing
 * one here, silently, is how a member loses three months over a ₹50 goodwill
 * adjustment. It is logged so the decision has evidence behind it when somebody
 * makes it. See docs/10-payments.md.
 */
const REFUNDED = new Set(["refund.processed"]);

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

  let orderId = extractOrderId(payload);

  /*
   * A refund that arrives without the payment entity beside it.
   *
   * Razorpay normally sends `payload.payment.entity` alongside the refund, and
   * `extractOrderId` reads the order from there. The refund entity itself
   * carries only `payment_id`, so when the payment entity is absent there is
   * nothing to match on -- and a refund silently dropped as "no order" is a
   * member keeping Premium they were paid back for. One lookup closes that:
   * `payments` is unique on `(provider, provider_payment_id)`.
   */
  if (!orderId && REFUNDED.has(eventType)) {
    const paymentRef = (entity(payload, "refund") ?? {}).payment_id;

    if (typeof paymentRef === "string") {
      const { data: byPayment } = await db
        .from("payments")
        .select("provider_order_id")
        .eq("provider", PROVIDER)
        .eq("provider_payment_id", paymentRef)
        .maybeSingle();

      orderId = typeof byPayment?.provider_order_id === "string"
        ? byPayment.provider_order_id
        : null;
    }
  }

  if (!orderId) {
    log("webhook_no_order", { event: eventType });
    return json({ status: "ignored" });
  }

  if (CAPTURED.has(eventType)) {
    const { data: settled, error } = await db.rpc("settle_payment", {
      p_provider: PROVIDER,
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
      p_provider: PROVIDER,
      p_order_id: orderId,
      p_provider_payment_id: extractPaymentId(payload),
      p_status: "failed",
    });
    log("webhook_failed_payment", { event: eventType });
    return json({ status: "ok" });
  }

  if (REFUNDED.has(eventType)) {
    const refund = entity(payload, "refund") ?? {};
    const refunded = asPaise(refund.amount);
    const reversalId = typeof refund.id === "string" ? refund.id : null;

    /*
     * Compared against what we recorded charging, not against anything in the
     * payload. The amount a client or a provider states is a claim; the
     * `payments` row was written by us before Razorpay was ever called.
     */
    const { data: row } = await db
      .from("payments")
      .select("amount_paise")
      .eq("provider", PROVIDER)
      .eq("provider_order_id", orderId)
      .maybeSingle();

    const charged = typeof row?.amount_paise === "number" ? row.amount_paise : null;
    const full = refunded !== null && charged !== null && refunded >= charged;

    if (!full) {
      /*
       * A partial refund, or an amount we could not establish. Either way this
       * is not the case the policy covers, and guessing in the member's
       * disfavour would take months away over a goodwill adjustment.
       */
      log("webhook_refund_partial", {
        event: eventType,
        refunded,
        charged,
        reason: refunded === null || charged === null ? "amount_unknown" : "partial",
      });
      return json({ status: "ignored" });
    }

    const { data: revoked, error } = await db.rpc("revoke_payment", {
      p_provider: PROVIDER,
      p_order_id: orderId,
      p_kind: "refund",
      p_reason: `razorpay ${eventType}`,
      p_reversal_id: reversalId,
      p_amount_paise: refunded,
      p_status: "refunded",
    });

    if (error) {
      log("webhook_revoke_failed", { event: eventType, reason: error.message });
      // Ours and probably temporary, so ask Razorpay to try again.
      return json({ status: "error" }, 500);
    }

    const result = revoked as { outcome?: string; premium_active?: boolean } | null;
    log("webhook_revoked", {
      event: eventType,
      outcome: String(result?.outcome ?? ""),
      premium_active: result?.premium_active ?? null,
    });
    return json({ status: "ok" });
  }

  /*
   * Everything else is acknowledged and ignored.
   *
   * Recorded as seen so a retry changes nothing, and acted on by nothing,
   * because nothing below has an agreed meaning for a prepaid term. The one
   * that used to sit here and should not have is the refund above.
   */
  log("webhook_ignored", { event: eventType });
  return json({ status: "ignored" });
});

/** Razorpay sends minor units as a number; anything else is not an amount. */
function asPaise(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

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
