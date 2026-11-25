import {
  config,
  configProblem,
  consumePurchase,
  getPurchase,
  type Purchase,
} from "../_shared/google-play.ts";
import { admin, callerId, CORS, json, log } from "../_shared/request.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

/**
 * Confirming a Google Play purchase, and rescuing one that got lost.
 *
 * The Play counterpart of `payments-verify`, with the same two jobs for the
 * same reason: an app can be killed between paying and being told, so this is
 * both the success path and the thing a restore calls.
 *
 * What is never trusted is the token. A `purchaseToken` from a client is a
 * claim, exactly as a Razorpay callback is a claim, and the answer comes from
 * the Android Publisher API rather than from the thing asking. A token is not
 * proof of anything on its own -- it is a lookup key, and what it looks up has
 * to say `PURCHASED`, has to belong to this member, and has to be for the
 * product this member's payment row was written for.
 *
 * Six checks stand between a token and a term, and each one closes a way of
 * paying ₹199 and getting twelve months, or of getting somebody else's purchase
 * applied to your own account:
 *
 *   Google says PURCHASED        not the client, and not PENDING
 *   the purchase names our row   via obfuscatedProfileId, which only this
 *                                server ever set
 *   the row is this member's     profile_id = the authenticated caller
 *   the product matches the row  intro product iff the row charged intro
 *   the intro is still unused    re-checked, not trusted from minutes ago
 *   quantity is exactly one      Eraya sells terms, not units
 *
 * Settlement is `settle_payment` with provider `google_play` -- the same
 * function the Razorpay webhook calls, which is what makes a Play term and a
 * Razorpay term the same thing rather than two things that resemble each other.
 * It is idempotent, it refuses a revoked payment, and it stacks onto time
 * already paid for.
 *
 * Acknowledgement comes after the grant, never before. Google revokes a
 * purchase nobody acknowledged within three days, so the order matters: grant
 * first, then tell the store. If the telling fails, `acknowledged_at` stays
 * null and the next call retries it; if it never succeeds, Play voids the
 * purchase and the void takes the term back, which is the correct end state
 * rather than a silent inconsistency.
 */

const PROVIDER = "google_play" as const;

/** The payment row this server is willing to act on. */
type PaymentRow = {
  id: string;
  plan_id: string;
  profile_id: string;
  status: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  intro_offer_applied: boolean;
  acknowledged_at: string | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ status: "error" }, 405);

  const profile = await callerId(request);
  if (!profile) return json({ status: "unauthenticated" }, 401);

  // Nothing can be verified without credentials, and nothing unverified may be
  // granted. Fails closed.
  if (!config()) {
    log("play_not_configured", { reason: configProblem() });
    return json({ status: "unavailable" });
  }

  const body = await request.json().catch(() => ({}));
  const token = String(body?.purchaseToken ?? "");

  if (!token) return json({ status: "invalid_purchase" });

  const db = admin();

  // ---------------------------------------------------------------------
  // What Google says about this token
  // ---------------------------------------------------------------------

  const found = await getPurchase(token);

  if (!found.ok) {
    switch (found.reason) {
      /*
       * No such purchase for this application.
       *
       * The request named Eraya's package, so a token minted in another app --
       * or invented -- is not found. This is the application-identity check,
       * and it is the request rather than a comparison afterwards.
       */
      case "not_found":
        log("play_purchase_not_found", { status: found.status });
        return json({ status: "invalid_purchase" });

      case "rejected":
        return json({ status: "invalid_purchase" });

      /*
       * Ours, not theirs. A credential problem must not be reported as a
       * failed payment: the money may well have moved, and telling somebody
       * their purchase was invalid because our service account is misconfigured
       * is both wrong and unrecoverable from their side.
       */
      case "not_configured":
      case "unauthorised":
        log("play_verify_unauthorised", { status: found.status });
        return json({ status: "unavailable" });

      // A lost reply says nothing about the purchase. Still moving.
      case "unavailable":
        log("play_verify_unavailable", { status: found.status });
        return json({ status: "pending" });
    }
  }

  const purchase = found.purchase;

  /*
   * One product, one unit.
   *
   * Eraya sells a term, and a term is not a quantity. A multi-quantity or
   * multi-item purchase would grant exactly one period for however many units
   * were bought, so it is refused rather than under-delivered. Play only allows
   * multi-quantity when it is turned on for a product, so this should be
   * unreachable -- which is the reason to assert it rather than assume it.
   */
  if (purchase.productIds.length !== 1 || purchase.quantity !== 1) {
    log("play_unsupported_shape", {
      products: purchase.productIds.length,
      quantity: purchase.quantity,
    });
    return json({ status: "unsupported_purchase" });
  }

  const purchasedProduct = purchase.productIds[0];

  // ---------------------------------------------------------------------
  // Which payment row this purchase belongs to
  // ---------------------------------------------------------------------
  //
  // `obfuscatedProfileId` is the payment id `payments-play-begin` wrote, and it
  // is the only thing tying a token to an intention. Read from Google's record
  // rather than from the request, so a client cannot nominate a row.
  //
  // The fallback covers a purchase that has already been settled once: after
  // settlement the token is on the row as `provider_payment_id`, which lets a
  // restore find it even if the obfuscated id were somehow absent.

  const columns =
    "id, plan_id, profile_id, status, provider_order_id, provider_payment_id, " +
    "intro_offer_applied, acknowledged_at";

  let row: PaymentRow | null = null;

  if (purchase.obfuscatedProfileId) {
    const { data } = await db
      .from("payments")
      .select(columns)
      .eq("provider", PROVIDER)
      .eq("provider_order_id", purchase.obfuscatedProfileId)
      .eq("profile_id", profile)
      .maybeSingle();
    row = (data as PaymentRow | null) ?? null;
  }

  if (!row) {
    const { data } = await db
      .from("payments")
      .select(columns)
      .eq("provider", PROVIDER)
      .eq("provider_payment_id", token)
      .eq("profile_id", profile)
      .maybeSingle();
    row = (data as PaymentRow | null) ?? null;
  }

  /*
   * No payment of this member's matches.
   *
   * Either the purchase was begun by somebody else, or it was never begun here
   * at all. Both are refused identically and neither is told which: that a
   * given purchase exists and belongs to another account is not something this
   * endpoint discloses.
   */
  if (!row) {
    log("play_foreign_or_unknown_purchase", {
      had_profile_id: purchase.obfuscatedProfileId !== null,
    });
    return json({ status: "unknown_order" });
  }

  /*
   * A row with no order id cannot be settled, and must not be guessed at.
   *
   * `provider_order_id` is nullable on `payments` -- it exists from creation for
   * Razorpay and is written here by `payments-play-begin` -- and every
   * settlement path looks a payment up by provider and order id together. A
   * null would reach `settle_payment` as a lookup that cannot match, which
   * would report `unknown_order` and read as a foreign purchase rather than as
   * the half-written row it actually is.
   *
   * Unreachable through either lookup above, which is the reason to say so
   * rather than leave the type widened and the case unnamed.
   */
  if (!row.provider_order_id) {
    log("play_row_without_order_id", { payment: row.id });
    return json({ status: "unconfirmed" });
  }

  // ---------------------------------------------------------------------
  // Already dealt with
  // ---------------------------------------------------------------------
  //
  // Settled by an earlier call or by a restore. Nothing to grant again -- but
  // acknowledgement is still chased, because the case this exists for is
  // exactly the one where the grant succeeded and the acknowledgement did not.
  // Returning early without this is how a paid member gets auto-refunded on day
  // three while every log says the purchase worked.

  if (row.status === "paid") {
    await ensureAcknowledged(db, row, purchasedProduct, token, purchase);
    const { data: membership } = await db.rpc("my_membership_for", { p_profile: profile });
    return json({ status: "paid", membership });
  }

  /*
   * Withdrawn. Said here rather than discovered at the bottom.
   *
   * Google goes on reporting a voided purchase's token, so without this the
   * settlement path below would read it as proof and ask to settle.
   * `settle_payment` refuses a revoked payment outright, so the term is safe
   * either way -- this makes it a stated outcome instead of a near miss.
   */
  if (row.status === "refunded" || row.status === "partially_refunded") {
    log("play_verify_refunded", { status: row.status });
    const { data: membership } = await db.rpc("my_membership_for", { p_profile: profile });
    return json({ status: row.status, membership });
  }

  // ---------------------------------------------------------------------
  // What state the purchase is in
  // ---------------------------------------------------------------------

  if (purchase.purchaseState === "PENDING") {
    /*
     * A deferred payment -- cash, or a slow instrument. Real, not yet paid.
     *
     * Nothing is settled and nothing is marked failed: the purchase may
     * complete hours later, and writing a terminal status now would mean the
     * completion had nowhere to land.
     */
    log("play_purchase_pending", { product: purchasedProduct });
    return json({ status: "pending" });
  }

  if (purchase.purchaseState === "CANCELLED") {
    await db.rpc("settle_payment", {
      p_provider: PROVIDER,
      p_order_id: row.provider_order_id,
      p_provider_payment_id: token,
      p_status: "cancelled",
    });
    log("play_purchase_cancelled", { product: purchasedProduct });
    return json({ status: "cancelled" });
  }

  if (purchase.purchaseState !== "PURCHASED") {
    // `PURCHASE_STATE_UNSPECIFIED`, or a state a newer API has added. Never
    // read as purchased, and never settled in either direction.
    log("play_purchase_state_unknown", { product: purchasedProduct });
    return json({ status: "unconfirmed" });
  }

  // ---------------------------------------------------------------------
  // Is this the product this row was written for?
  // ---------------------------------------------------------------------
  //
  // The check that stops the introductory product buying a standard term, and
  // the standard product being settled as an introductory one. The row records
  // what the server decided to charge; the purchase records what Google
  // actually took. They have to name the same product.

  const { data: plan } = await db
    .from("membership_plans")
    .select("code, play_product_id, play_intro_product_id")
    .eq("id", row.plan_id)
    .maybeSingle();

  const expected = row.intro_offer_applied
    ? plan?.play_intro_product_id
    : plan?.play_product_id;

  if (!expected || expected !== purchasedProduct) {
    /*
     * Logged loudly and settled in neither direction.
     *
     * Not marked failed: the purchase is real and the member's money has gone,
     * so closing the row would destroy the only record linking them. Not
     * granted either, because the term this row would hand out is not the term
     * that was bought. A person has to look at this one, which is what
     * `unconfirmed` means to the client.
     */
    log("play_product_mismatch", {
      plan: plan?.code ?? null,
      intro: row.intro_offer_applied,
      expected: expected ?? null,
      purchased: purchasedProduct,
    });
    return json({ status: "unconfirmed" });
  }

  // ---------------------------------------------------------------------
  // Is the introductory price still this member's to use?
  // ---------------------------------------------------------------------
  //
  // Re-checked at settlement rather than trusted from whenever the purchase
  // began. Between the two, the same member may have completed an introductory
  // purchase on the website -- `intro_offer_used` is profile-wide and provider-
  // blind on purpose -- and two introductory terms is the one pricing mistake
  // this product can make twice.
  //
  // This row is not yet `paid`, so it does not count towards the answer: the
  // rule is "a paid payment of this member carries the flag", which is what
  // makes the check exclude the purchase being settled without saying so.

  if (row.intro_offer_applied) {
    const { data: used, error: usedError } = await db.rpc("intro_offer_used", {
      p_profile: profile,
    });

    if (usedError) {
      log("play_intro_check_failed", { reason: usedError.message });
      return json({ status: "pending" });
    }

    if (used === true) {
      log("play_intro_already_used", { plan: plan?.code ?? null });
      return json({ status: "unconfirmed" });
    }
  }

  // ---------------------------------------------------------------------
  // Money becomes time
  // ---------------------------------------------------------------------
  //
  // The same function, the same stacking, the same idempotency as the web. The
  // token is recorded as the provider payment id, which `payments` is unique on
  // per provider -- so one token can never settle two rows.

  const { data: settled, error: settleError } = await db.rpc("settle_payment", {
    p_provider: PROVIDER,
    p_order_id: row.provider_order_id,
    p_provider_payment_id: token,
    p_status: "paid",
  });

  if (settleError) {
    log("play_settle_failed", { reason: settleError.message });
    return json({ status: "pending" });
  }

  const outcome = (settled as { outcome?: string } | null)?.outcome ?? "pending";

  log("play_settled", {
    outcome,
    product: purchasedProduct,
    intro: row.intro_offer_applied,
    order: purchase.orderId,
    region: purchase.regionCode,
    // A licence tester's purchase grants real premium. The only control over
    // who can make one is the tester list in Play Console, so it is recorded
    // rather than hidden.
    test_purchase: purchase.isTestPurchase,
  });

  if (outcome === "revoked") {
    // Withdrawn time is not re-grantable, whatever Google still reports.
    return json({ status: "revoked" });
  }

  if (outcome !== "paid" && outcome !== "already_paid") {
    return json({ status: outcome });
  }

  /*
   * Granted. Now tell the store -- and only now.
   *
   * A failure here leaves `acknowledged_at` null, which is the retry signal. It
   * does not undo the term and is not reported to the member: they have what
   * they paid for, and the consequence of a permanent failure is Play voiding
   * the purchase, which arrives as a void and takes the term back properly.
   */
  await ensureAcknowledged(db, { ...row, status: "paid" }, purchasedProduct, token, purchase);

  const { data: membership } = await db.rpc("my_membership_for", { p_profile: profile });

  return json({ status: "paid", membership });
});

/**
 * Making sure Google has been told, exactly once.
 *
 * Consuming is the single write Eraya performs on a purchase: Google's guidance
 * for a consumable one-time product is to consume rather than acknowledge, and
 * consuming acknowledges as a side effect. Because it is the only write, an
 * acknowledged purchase is a consumed one, so `acknowledgementState` is enough
 * to decide whether there is anything left to do.
 *
 * `acknowledged_at` is written only after Google confirms. Writing it alongside
 * the grant would record a fact nobody established and would hide the one
 * failure that costs a paying member their term on day three.
 *
 * Returns nothing. Every outcome is either already correct or a retry, and none
 * of them changes what the member is told.
 */
async function ensureAcknowledged(
  db: SupabaseClient,
  row: PaymentRow,
  productId: string,
  token: string,
  purchase: Purchase,
): Promise<void> {
  // Already recorded on our side. Nothing to chase.
  if (row.acknowledged_at) return;

  /*
   * Google already considers it acknowledged, but we never wrote it down.
   *
   * Reconciled rather than consumed again: a second consume on a consumed token
   * is refused, and the state this function exists to reach has been reached.
   * This is the ordinary path for a purchase settled by an earlier call whose
   * acknowledgement succeeded and whose database write did not.
   */
  if (purchase.acknowledgementState === "ACKNOWLEDGED") {
    await stampAcknowledged(db, row.id);
    log("play_acknowledgement_reconciled", { payment: row.id });
    return;
  }

  const consumed = await consumePurchase(productId, token);

  if (!consumed.ok) {
    /*
     * Left null deliberately, so this is findable and retryable.
     *
     * Three days is the whole window. A restore call retries it; if nothing
     * does, Play refunds the member and voids the purchase, and the void is
     * what takes the term back. That is a worse outcome than succeeding and a
     * better one than a term standing on a purchase the store has refunded.
     */
    log("play_consume_failed", {
      payment: row.id,
      reason: consumed.reason,
      status: consumed.status,
    });
    return;
  }

  await stampAcknowledged(db, row.id);
  log("play_consumed", { payment: row.id, already: consumed.already ?? false });
}

async function stampAcknowledged(db: SupabaseClient, paymentId: string): Promise<void> {
  const { error } = await db
    .from("payments")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", paymentId)
    // Never overwrite the first acknowledgement's timestamp.
    .is("acknowledged_at", null);

  if (error) log("play_acknowledge_write_failed", { payment: paymentId, reason: error.message });
}
