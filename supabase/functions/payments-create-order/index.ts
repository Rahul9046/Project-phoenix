import { config, createOrder, isLiveMode } from "../_shared/razorpay.ts";
import { admin, callerId, CORS, json, log } from "../_shared/request.ts";
import { salesOpen } from "../_shared/sales.ts";

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
 *
 * And before any of that, whether Eraya is selling at all. This endpoint is the
 * only place a payment can begin -- every client and every installed build
 * reaches a provider through here and nowhere else -- which makes it the one
 * place a closed till can be enforced for clients that will never be updated.
 * See `_shared/sales.ts`.
 */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ status: "error" }, 405);

  const profile = await callerId(request);
  if (!profile) return json({ status: "unauthenticated" }, 401);

  /*
   * The till, before the provider and before the database.
   *
   * First of the three checks on purpose, and the ordering is load-bearing in
   * two separate ways.
   *
   * It has to precede `config()` because test credentials are configured in
   * production and Razorpay has refused to activate the account -- so a
   * configured provider is not evidence that anything may be sold, and the
   * question "is Eraya selling" must be answered before the question "which
   * account would it sell through".
   *
   * It has to precede `begin_payment` because that call passes `p_live_mode`,
   * which migration 20261125110100 adds and which production does not have
   * yet. With the till shut this line returns before the RPC and the missing
   * parameter is unreachable; the migration is a prerequisite for re-opening
   * sales, not for deploying this. `_shared/sales.ts` has the whole argument.
   *
   * Reported as `unavailable` rather than as an error: it is a deliberate
   * commercial state, and it is the one status both clients already render as
   * "Premium cannot be bought right now" instead of as a fault somebody should
   * retry. An older Android build reaching this gets the same answer as the
   * current website, having created nothing, at no provider, in no mode.
   */
  if (!salesOpen()) {
    log("payment_sales_closed", {});
    return json({ status: "unavailable" });
  }

  const settings = config();
  if (!settings) {
    log("payment_not_configured", {});
    return json({ status: "unavailable" });
  }

  const body = await request.json().catch(() => ({}));
  const planCode = String(body?.planCode ?? "");

  if (!planCode) return json({ status: "unknown_plan" });

  const db = admin();

  const live = isLiveMode(settings.keyId);

  /*
   * The mode is handed to the database, not inferred there.
   *
   * `begin_payment` records it on the row so a payment can only ever be settled
   * by the same Razorpay that created it, and refuses outright when this is a
   * live charge and `payments_live_enabled()` is false. That second check is
   * the one that matters today: configuring a live key, for any reason, must not
   * by itself start selling.
   */
  const { data: started, error: startError } = await db
    .rpc("begin_payment", {
      p_profile: profile,
      p_plan_code: planCode,
      p_live_mode: live,
    })
    .single();

  if (startError || !started) {
    const reason = startError?.message ?? "no_row";

    /*
     * The gate is a deliberate operational state, not a bad request, so it is
     * reported as `unavailable` -- the status both clients already render as
     * "Premium cannot be bought right now" rather than as "no such plan".
     */
    if (/live payments are not enabled/i.test(reason)) {
      log("payment_live_gate_closed", { plan: planCode });
      return json({ status: "unavailable" });
    }

    log("payment_begin_failed", { plan: planCode, reason });
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
    live,
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
    liveMode: live,
  });
});
