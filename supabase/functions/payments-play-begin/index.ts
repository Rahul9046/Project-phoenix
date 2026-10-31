import { PACKAGE_NAME, config, configProblem } from "../_shared/google-play.ts";
import { admin, callerId, CORS, json, log } from "../_shared/request.ts";

/**
 * Starting a Google Play purchase.
 *
 * The Play counterpart of `payments-create-order`, and deliberately the same
 * shape: the client sends a plan code and nothing else, the server decides the
 * price and the introductory eligibility, and the intended payment is written
 * down before the store knows anything.
 *
 * There is no order to create. Razorpay mints an order id server-side before
 * the member sees a payment screen; Play has no such step and hands over a
 * purchase token only once money has moved. So this endpoint writes the payment
 * row and then puts the row's own id where Play will carry it:
 * `obfuscatedProfileId`, which the Android Publisher API returns verbatim on
 * the purchase. That is what lets `payments-play-verify` tie a token nobody has
 * seen before back to the payment this member intended, and it is why
 * `provider_order_id` on a Play row is Eraya's own uuid rather than a store
 * reference.
 *
 * The alternative -- letting the client say which payment a token belongs to --
 * is the attack this avoids. A member could hand over somebody else's payment
 * id, or their own cheaper one, and have an expensive term settled against it.
 *
 * Nothing is granted here. This endpoint cannot make anybody premium; it writes
 * a row with status `created` and returns the product to buy.
 */

/** Every row this endpoint writes. Named once, so nothing inherits a default. */
const PROVIDER = "google_play" as const;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ status: "error" }, 405);

  const profile = await callerId(request);
  if (!profile) return json({ status: "unauthenticated" }, 401);

  /*
   * Refused before a row is written, not after.
   *
   * Without Google credentials this server cannot verify a purchase, and a
   * purchase it cannot verify must never be started -- the member would pay
   * Google and have nothing that could grant them a term. Fails closed, and
   * the reason goes to the log rather than to the client.
   */
  if (!config()) {
    log("play_not_configured", { reason: configProblem() });
    return json({ status: "unavailable" });
  }

  const body = await request.json().catch(() => ({}));
  const planCode = String(body?.planCode ?? "");

  if (!planCode) return json({ status: "unknown_plan" });

  const db = admin();

  /*
   * The server picks the amount and the introductory eligibility.
   *
   * `begin_payment` is the authority on both, and it is the authority for the
   * same reason it is on the web: an amount a client can name is an amount
   * anybody can name, and introductory eligibility depends on a member's whole
   * payment history rather than on anything a phone knows. The provider is
   * passed explicitly -- the parameter exists so this call cannot inherit
   * Razorpay by default.
   */
  const { data: started, error: startError } = await db
    .rpc("begin_payment", {
      p_profile: profile,
      p_plan_code: planCode,
      p_provider: PROVIDER,
    })
    .single();

  if (startError || !started) {
    log("play_begin_failed", {
      plan: planCode,
      reason: startError?.message ?? "no_row",
    });
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

  /*
   * Which Play product this member may buy.
   *
   * Read after `begin_payment` rather than before, because which of the two
   * columns is needed depends on `intro_applies` -- and that is decided in
   * Postgres against the member's history, not here. Reading the plan first and
   * guessing the column would be a second implementation of the introductory
   * rule, which is the kind of duplication that eventually disagrees with
   * itself.
   */
  const { data: plan, error: planError } = await db
    .from("membership_plans")
    .select("play_product_id, play_intro_product_id")
    .eq("code", planCode)
    .maybeSingle();

  const productId = intent.intro_applies
    ? plan?.play_intro_product_id
    : plan?.play_product_id;

  if (planError || !productId) {
    /*
     * The mapping is not configured yet, so there is nothing to buy.
     *
     * The row written a moment ago is closed rather than left behind. This is
     * the same correction `payments-create-order` makes when Razorpay rejects
     * an order: a `created` row that no store will ever settle sits in the
     * member's own payment history for ever as an attempt they never made.
     *
     * Said plainly in the log, because the fix is a Play Console decision and
     * a NULL column rather than anything wrong with this request.
     */
    await db
      .from("payments")
      .update({ status: "failed", failed_at: new Date().toISOString() })
      .eq("id", intent.payment_id);

    log("play_product_not_configured", {
      plan: planCode,
      intro: intent.intro_applies,
      reason: planError?.message ?? "product_id_null",
    });

    return json({ status: "product_not_configured" });
  }

  /*
   * The payment's own id becomes its provider order id.
   *
   * `payments` is unique on `(provider, provider_order_id)`, so this is what
   * makes a Play row addressable by the same `settle_payment` and
   * `revoke_payment` Razorpay uses -- with no new settlement path and no change
   * to either function. A uuid is 36 characters, comfortably inside the 64 Play
   * allows for an obfuscated identifier.
   */
  const { error: attachError } = await db.rpc("attach_provider_order", {
    p_payment: intent.payment_id,
    p_order_id: intent.payment_id,
  });

  if (attachError) {
    await db
      .from("payments")
      .update({ status: "failed", failed_at: new Date().toISOString() })
      .eq("id", intent.payment_id);

    log("play_attach_failed", { plan: planCode, reason: attachError.message });
    return json({ status: "unavailable" });
  }

  log("play_purchase_begun", {
    plan: planCode,
    amount: intent.amount_paise,
    intro: intent.intro_applies,
    product: productId,
  });

  /*
   * What goes back is what launching a Play purchase needs, and nothing more.
   *
   * `obfuscatedProfileId` is the payment id again, named as Play names it, so
   * the client passes it through rather than deciding anything.
   *
   * No account-level identifier is sent. Play also accepts an
   * `obfuscatedAccountId`, which would give Google a stable per-member key
   * across every purchase; the per-purchase id is sufficient to bind a token to
   * a member here, so the stable one is deliberately not provided.
   *
   * `amountPaise` is returned for the client's own logging and correlation. It
   * is not what the member is shown: Play charges the Play Console price with
   * its own tax handling, so the price on the Android screen comes from
   * `queryProductDetailsAsync` and this number is never rendered.
   */
  return json({
    status: "created",
    paymentId: intent.payment_id,
    productId,
    obfuscatedProfileId: intent.payment_id,
    packageName: PACKAGE_NAME,
    planCode,
    planName: intent.plan_name,
    periodMonths: intent.period_months,
    introApplies: intent.intro_applies,
    amountPaise: intent.amount_paise,
    currency: intent.currency,
  });
});
