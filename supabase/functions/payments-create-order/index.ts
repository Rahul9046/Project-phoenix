import { config, createOrder, isLiveMode } from "../_shared/razorpay.ts";
import { admin, callerId, CORS, json, log } from "../_shared/request.ts";

/**
 * Starting a purchase.
 *
 * The client sends a plan code. That is the whole of its input, and it is the
 * reason this endpoint exists at all: an amount chosen by a client is an amount
 * anybody can choose, and ₹1 for twelve months is a single edited request away.
 *
 * The order of operations is the security here. Identify the caller from their
 * token, ask the database for the price and the introductory eligibility, write
 * the intended payment down, and only then create the order at Razorpay. What
 * was meant is recorded before the provider knows anything, so the two can be
 * compared afterwards.
 */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ status: "error" }, 405);

  const profile = await callerId(request);
  if (!profile) return json({ status: "unauthenticated" }, 401);

  const settings = config();
  if (!settings) {
    log("payment_not_configured", {});
    return json({ status: "unavailable" });
  }

  const body = await request.json().catch(() => ({}));
  const planCode = String(body?.planCode ?? "");

  if (!planCode) return json({ status: "unknown_plan" });

  const db = admin();

  const { data: started, error: startError } = await db
    .rpc("begin_payment", { p_profile: profile, p_plan_code: planCode })
    .single();

  if (startError || !started) {
    log("payment_begin_failed", { plan: planCode, reason: startError?.message ?? "no_row" });
    return json({ status: "unknown_plan" });
  }

  const intent = started as {
    payment_id: string;
    amount_paise: number;
    currency: string;
    intro_applies: boolean;
    plan_name: string;
    period_months: number;
  };

  const order = await createOrder({
    amountPaise: intent.amount_paise,
    currency: intent.currency,
    // Our own id, so a Razorpay row can be traced back here without exposing
    // anything about the person.
    receipt: intent.payment_id,
    notes: { profile_id: profile, plan_code: planCode, payment_id: intent.payment_id },
  });

  if (!order.ok) {
    log("payment_order_failed", { plan: planCode, reason: order.reason });
    // The row was written before the provider was called, so it has to be
    // closed here or it sits as 'created' for ever and shows up as a pending
    // payment nobody ever made.
    await db
      .from("payments")
      .update({ status: "failed", failed_at: new Date().toISOString() })
      .eq("id", intent.payment_id);

    return json({ status: "unavailable" });
  }

  await db.rpc("attach_provider_order", {
    p_payment: intent.payment_id,
    p_order_id: order.orderId,
  });

  log("payment_order_created", {
    plan: planCode,
    amount: intent.amount_paise,
    intro: intent.intro_applies,
    live: isLiveMode(settings.keyId),
  });

  /*
   * What goes back is what checkout needs and nothing more. The key id is
   * public by design -- Razorpay's SDK identifies the merchant with it -- and
   * is served from here rather than configured in two apps, so test and live
   * cannot drift apart between clients.
   */
  return json({
    status: "created",
    orderId: order.orderId,
    paymentId: intent.payment_id,
    amountPaise: intent.amount_paise,
    currency: intent.currency,
    introApplies: intent.intro_applies,
    planName: intent.plan_name,
    periodMonths: intent.period_months,
    keyId: settings.keyId,
    liveMode: isLiveMode(settings.keyId),
  });
});
