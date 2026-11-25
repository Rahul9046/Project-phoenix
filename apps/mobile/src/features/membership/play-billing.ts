import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isUserCancelledError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type ExpoPurchaseError,
  type Purchase,
} from "expo-iap";

import { paymentProvider } from "@/features/membership/purchasing";
import { supabase } from "@/lib/supabase/client";
import {
  asMembership,
  invoke,
  type PurchaseOutcome,
} from "@/features/membership/contract";

/**
 * Buying Premium through Google Play.
 *
 * One of the two routes `payments.ts` dispatches to, and the one used by the
 * build uploaded to Google Play. Play's rules are not a preference: an app
 * *distributed through the Play Store* must sell digital goods through Play
 * Billing, so in that build the website's Razorpay checkout is never opened.
 *
 * The scope of "that build" is the thing worth being precise about, because
 * getting it wrong breaks a shipped app. Play's Payments policy binds apps
 * distributed on Play; it does not reach the APK people download from
 * eraya.app, which is sideloaded and keeps Razorpay. iOS sells nothing at all.
 * So this file is reached by exactly one artifact, and `usesPlayBilling` below
 * is what decides that -- not the platform, which cannot tell the two Android
 * artifacts apart. The web app is Razorpay only and never loads any of this.
 *
 * What this file does not do is decide anything about money. It cannot name a
 * price, cannot decide whether the introductory offer applies, and above all
 * cannot conclude that somebody is premium. Google reporting a purchase is a
 * claim about a store, not a grant of a term -- the grant happens in
 * `payments-play-verify`, which asks the Android Publisher API rather than the
 * phone, and the only thing this file believes is what that function answers.
 *
 * The shape of a purchase:
 *
 *   ask the server to begin        (it prices the plan and picks the product)
 *   check Play knows the product   (so an unconfigured plan fails before the sheet)
 *   launch the Play sheet          (carrying the payment id as obfuscatedProfileId)
 *   hand the token to the server   (it verifies against Google, then grants)
 *   read the membership it reports (never a local assumption)
 *
 * Two things are worth not re-deriving.
 *
 * `obfuscatedProfileId` is the whole correlation mechanism. `payments-play-begin`
 * writes a payment row and returns its uuid; Play carries that uuid on the
 * purchase and the Publisher API returns it verbatim, which is how the server
 * ties a token nobody has seen before back to the payment this member intended.
 * It is passed straight through here and never invented, chosen or edited.
 *
 * And a purchase can arrive when nobody is waiting for it. The app can be killed
 * between the Play sheet closing and verification, and Play will keep handing
 * the purchase back until it is consumed -- so the listener below is registered
 * for the life of the process rather than for the life of a screen, and
 * `recoverPlayPurchases` exists to sweep up anything that was left unverified.
 * Google refunds an unacknowledged purchase after three days, which makes that
 * sweep a matter of money rather than tidiness.
 */

/**
 * Is this the build that buys through Play?
 *
 * Every entry point in this file is guarded by it, so a build that is not
 * distributed through Play never opens a Billing connection, never registers
 * the purchase listeners and never queries a product -- the module is inert
 * rather than merely unused.
 *
 * Note what this is not: `Platform.OS === "android"`. Both Android artifacts
 * report `android`, and the one that must not come through here is the APK
 * published on eraya.app, which Play has never distributed and whose installs
 * no Play account is entitled to. `paymentProvider` is settled from build
 * configuration before the app runs -- see `distribution.ts`.
 */
export function usesPlayBilling(): boolean {
  return paymentProvider === "play";
}

/**
 * How long to wait for the Play sheet before saying we do not know.
 *
 * The listener resolves a purchase the moment Play reports one, so this only
 * fires when no event arrives at all -- a sheet left open, or a store that went
 * quiet. It resolves to `processing` rather than to a failure, because a silent
 * Play sheet says nothing about whether money moved, and the recovery sweep
 * will settle it properly on the next visit.
 */
const SHEET_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * One purchase at a time, and the thing waiting for it.
 *
 * The membership screen disables its button while a purchase is in flight, so
 * there is never a second one to track. Holding a single record rather than a
 * map is what makes "did this event belong to the purchase somebody is watching"
 * a comparison rather than a guess.
 */
type Pending = {
  paymentId: string;
  productId: string;
  settle: (outcome: PurchaseOutcome) => void;
};

let pending: Pending | null = null;

/**
 * Verifications in flight, keyed by purchase token.
 *
 * Play can deliver the same purchase twice -- a duplicate listener callback, an
 * event that also appears in `getAvailablePurchases` -- and both deliveries must
 * not become two verifications. The server is idempotent, so a double call would
 * be harmless rather than wrong; this exists so the second caller waits for the
 * first answer instead of racing it, which is what stops a duplicate from
 * consuming a purchase the first call is still verifying.
 *
 * Entries are removed when they settle. Keeping them would cache an outcome, and
 * a `PENDING` purchase that completes hours later has to be verifiable again.
 */
const verifying = new Map<string, Promise<PurchaseOutcome>>();

/**
 * Tokens this process has already seen granted, and what they granted.
 *
 * `verifying` only covers deliveries that overlap. This covers the ones that do
 * not: Play handing the same purchase back a second time, or a sweep finding a
 * purchase a listener has already settled. Asking again would be answered
 * `paid` and consumed as "already consumed", so the result would be the same --
 * this makes it the same without the round trip, and removes any chance of a
 * delivery and a consume taking turns.
 *
 * Only `paid` is remembered, and that is the point. A `pending` purchase can
 * still complete and a refused one can still be retried, so caching either
 * would freeze an answer that is supposed to change. A consumed, granted term
 * is the one outcome that is genuinely final.
 */
const granted = new Map<string, PurchaseOutcome>();

/** Told when a purchase settles with nobody waiting for it. */
type RecoveryListener = (outcome: PurchaseOutcome) => void;
const recoveryListeners = new Set<RecoveryListener>();

/**
 * Hear about purchases that settle on their own.
 *
 * The case this exists for: somebody paid, the app died, and the purchase is
 * verified by the sweep or by a late Play callback while the membership screen
 * happens to be open. The screen refreshes from the server rather than being
 * told what to display.
 */
export function onPlayPurchaseRecovered(listener: RecoveryListener): () => void {
  recoveryListeners.add(listener);
  return () => recoveryListeners.delete(listener);
}

function announce(outcome: PurchaseOutcome): void {
  for (const listener of recoveryListeners) listener(outcome);
}

// ---------------------------------------------------------------------------
// The store connection
// ---------------------------------------------------------------------------

let connection: Promise<boolean> | null = null;
let listening = false;

/**
 * Connecting to Play, once, and retrying when it did not work.
 *
 * Memoised so every caller shares one connection, but a failed attempt is
 * forgotten rather than cached: the Play Store can simply not be ready yet when
 * the first screen mounts, and a permanently remembered `false` would mean the
 * app never sells anything again until it is restarted.
 */
async function connect(): Promise<boolean> {
  if (!usesPlayBilling()) return false;

  if (!connection) {
    connection = initConnection().catch(() => false);
  }

  const ready = await connection;

  if (!ready) {
    connection = null;
    return false;
  }

  listen();
  return true;
}

/**
 * The listeners, registered for the life of the process.
 *
 * Deliberately never removed. A purchase that arrives after the membership
 * screen has been closed still has to be verified -- that is the purchase
 * somebody has already paid for -- so tying these to a component's lifetime
 * would drop exactly the events that cost money.
 */
function listen(): void {
  if (listening) return;
  listening = true;

  purchaseUpdatedListener((purchase) => {
    void received(purchase);
  });

  purchaseErrorListener((error) => {
    void failed(error);
  });
}

// ---------------------------------------------------------------------------
// What arrives from Play
// ---------------------------------------------------------------------------

function tokenOf(purchase: Purchase): string | null {
  const token = purchase.purchaseToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function profileIdOf(purchase: Purchase): string | null {
  if (!("obfuscatedProfileIdAndroid" in purchase)) return null;
  const id = purchase.obfuscatedProfileIdAndroid;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Is this the purchase somebody is waiting for?
 *
 * By `obfuscatedProfileId` first, because that is the payment id this server
 * set and nothing else can carry it. The product id is a fallback for a store
 * that did not return the obfuscated id, and it is only safe because one
 * purchase is in flight at a time -- see `Pending`.
 */
function matches(purchase: Purchase, target: Pending): boolean {
  const profileId = profileIdOf(purchase);
  if (profileId) return profileId === target.paymentId;
  return purchase.productId === target.productId;
}

async function received(purchase: Purchase): Promise<void> {
  // Captured before verifying, because verifying takes a round trip and the
  // thing waiting may have given up by the time it returns.
  const target = pending && matches(purchase, pending) ? pending : null;

  const outcome = await settle(purchase);

  if (target) target.settle(outcome);
  else announce(outcome);
}

/**
 * Play refused, or the member walked away.
 *
 * None of these is a decline. Play does not report a failed card here -- a card
 * that fails is handled inside the sheet and either completes later or never
 * arrives -- so the only honest readings are "they cancelled" and "this did not
 * happen". Reporting a store error as `failed` would tell somebody their bank
 * said no on Eraya's behalf.
 */
async function failed(error: ExpoPurchaseError): Promise<void> {
  const target = pending;
  if (!target) return;

  if (isUserCancelledError(error)) {
    target.settle({ status: "cancelled" });
    return;
  }

  /*
   * They already own an unconsumed purchase of this product.
   *
   * Which means a previous attempt was paid for and never verified, so the
   * right answer is not an error at all -- it is to go and find that purchase
   * and settle it. This is the ordinary shape of "the app died right after I
   * paid", seen from the next attempt.
   */
  if (error.code === ErrorCode.AlreadyOwned) {
    const recovered = await recoverPlayPurchases();
    target.settle(recovered ?? { status: "unconfirmed" });
    return;
  }

  // A deferred instrument -- cash, a slow bank. Real, and not yet paid.
  if (error.code === ErrorCode.DeferredPayment) {
    target.settle({ status: "processing" });
    return;
  }

  target.settle({ status: "unavailable" });
}

// ---------------------------------------------------------------------------
// Verification, which is the only thing that grants anything
// ---------------------------------------------------------------------------

type VerifyReply = { status?: string; membership?: unknown };

/**
 * Hand a purchase to the server and do what it says.
 *
 * Every path through this function either asks `payments-play-verify` or
 * refuses to decide. There is no branch in which a term is granted because
 * Google said `purchased` -- that is the one thing a client must never be
 * allowed to conclude, because a client is the thing being attacked.
 */
function settle(purchase: Purchase): Promise<PurchaseOutcome> {
  const token = tokenOf(purchase);

  // A purchase with no token cannot be looked up, and a lookup key is all a
  // token is. Nothing to verify and nothing to consume.
  if (!token) return Promise.resolve({ status: "unconfirmed" });

  const settled = granted.get(token);
  if (settled) return Promise.resolve(settled);

  const already = verifying.get(token);
  if (already) return already;

  const run = verify(purchase, token)
    .then((outcome) => {
      if (outcome.status === "paid") granted.set(token, outcome);
      return outcome;
    })
    .finally(() => {
      verifying.delete(token);
    });

  verifying.set(token, run);
  return run;
}

async function verify(
  purchase: Purchase,
  token: string,
): Promise<PurchaseOutcome> {
  const reply = await invoke<VerifyReply>("payments-play-verify", {
    purchaseToken: token,
  });

  /*
   * No reply is not a refusal.
   *
   * The purchase is real as far as Play is concerned and the member may well
   * have been charged. Nothing is consumed, so Play keeps handing it back and
   * the next sweep tries again -- which is the behaviour that turns a lost
   * network into a delay instead of a lost term.
   */
  if (!reply) return { status: "processing" };

  switch (reply.status) {
    /*
     * Granted by the server. Now, and only now, tell Play we are done with it.
     *
     * Consuming before verification would destroy the only thing that can prove
     * the purchase, and consuming a purchase the server refused would quietly
     * throw away a member's money.
     */
    case "paid":
      await consume(purchase);
      return { status: "paid", membership: asMembership(reply.membership) };

    // Deferred payment. Not settled in either direction, and deliberately not
    // consumed: the completion has to have somewhere to land.
    case "pending":
      return { status: "processing" };

    case "cancelled":
      return { status: "cancelled" };

    /*
     * Real, and withdrawn. Refunded, partially refunded, or settled against a
     * payment whose term was revoked.
     *
     * Not `failed`, because nothing was declined, and not `paid`, because the
     * time is gone. There is no member-facing sentence that makes this better
     * than "we could not confirm this", and inventing one would mean inventing
     * a reason.
     */
    case "refunded":
    case "partially_refunded":
    case "revoked":
      return { status: "unconfirmed" };

    /*
     * Ours or Google's, not the member's.
     *
     * `unknown_order` is a purchase with no payment row of this member's,
     * `invalid_purchase` is a token Google does not recognise,
     * `unsupported_purchase` is a shape Eraya does not sell, and `unavailable`
     * means our own credentials are not working. None is a decline, and none is
     * consumed -- an unconsumed purchase is a recoverable one.
     */
    case "unknown_order":
    case "invalid_purchase":
    case "unsupported_purchase":
    case "unavailable":
    case "unconfirmed":
      return { status: "unconfirmed" };

    // A status this build has never heard of, or a settlement outcome passed
    // straight through. Guessing in either direction invents a fact.
    default:
      return { status: "unconfirmed" };
  }
}

/**
 * Telling Play the purchase is finished with.
 *
 * `isConsumable` is true because Eraya sells one-time consumable products: a
 * term has to be buyable again, and a non-consumable can be owned only once
 * ever. Consuming is also what acknowledges, which is the thing Google requires
 * within three days.
 *
 * A failure here is tolerated on purpose. The server has already consumed the
 * purchase through the Publisher API -- that is the authoritative
 * acknowledgement and it is what `payments.acknowledged_at` records -- so this
 * call is usually refused as "already consumed", and that refusal means the job
 * is done rather than that something went wrong. It is still made, because it
 * is what clears the purchase out of the local Billing queue, and because it is
 * the backstop if the server's own consume failed.
 */
async function consume(purchase: Purchase): Promise<void> {
  try {
    await finishTransaction({ purchase, isConsumable: true });
  } catch {
    // Nothing to do and nothing to tell anybody. See above.
  }
}

// ---------------------------------------------------------------------------
// Starting a purchase
// ---------------------------------------------------------------------------

type BeginReply = {
  status?: string;
  paymentId?: string;
  productId?: string;
  obfuscatedProfileId?: string;
  planName?: string;
  periodMonths?: number;
  introApplies?: boolean;
  amountPaise?: number;
  currency?: string;
};

export async function purchaseOnPlay(planCode: string): Promise<PurchaseOutcome> {
  if (!usesPlayBilling()) return { status: "unavailable" };

  // No connection means no sheet, which means nothing was charged.
  if (!(await connect())) return { status: "unavailable" };

  /*
   * The server prices the plan, decides the introductory eligibility, writes
   * the payment row and names the product to buy. The client sends a plan code
   * and nothing else, for the same reason it does on the web: an amount a
   * client can name is an amount anybody can name.
   */
  const begun = await invoke<BeginReply>("payments-play-begin", { planCode });

  if (!begun) return { status: "unavailable" };

  // The plan has no Play product yet, or the one it names does not exist. Said
  // as its own outcome because it is not something retrying will fix.
  if (begun.status === "product_not_configured") return { status: "unconfigured" };

  if (begun.status !== "created" || !begun.productId || !begun.paymentId) {
    return { status: "unavailable" };
  }

  /*
   * Does Play actually know this product?
   *
   * Checked before the sheet rather than discovered inside it. `requestPurchase`
   * on an unknown sku throws, and the row the server has just written would sit
   * in somebody's payment history as an attempt they never made. Asking first
   * also means a product id configured in the database but not yet created in
   * Play Console reads as "not configured yet", which is what it is.
   */
  const price = await playPrice(begun.productId);
  if (price === null) return { status: "unconfigured" };

  return await launch(
    begun.paymentId,
    begun.productId,
    begun.obfuscatedProfileId ?? begun.paymentId,
  );
}

function launch(
  paymentId: string,
  productId: string,
  obfuscatedProfileId: string,
): Promise<PurchaseOutcome> {
  return new Promise<PurchaseOutcome>((resolve) => {
    let settled = false;

    const once = (outcome: PurchaseOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (pending && pending.paymentId === paymentId) pending = null;
      resolve(outcome);
    };

    const timer = setTimeout(() => once({ status: "processing" }), SHEET_TIMEOUT_MS);

    pending = { paymentId, productId, settle: once };

    /*
     * The result does not come back from this call.
     *
     * `requestPurchase` dispatches the flow and resolves with whatever the store
     * handed over synchronously; the outcome arrives on the listeners. What is
     * caught here is the store refusing to start at all.
     */
    void requestPurchase({
      type: "in-app",
      request: {
        google: {
          skus: [productId],
          // The payment's own id, straight from the server. Play returns it
          // verbatim on the purchase, which is what binds an unseen token to
          // this member's intended payment.
          obfuscatedProfileId,
        },
      },
    }).catch((error: unknown) => {
      if (isUserCancelledError(error)) {
        once({ status: "cancelled" });
        return;
      }
      void failed(error as ExpoPurchaseError);
    });
  });
}

// ---------------------------------------------------------------------------
// Recovering what was left behind
// ---------------------------------------------------------------------------

/**
 * Verify every purchase Play is still holding.
 *
 * Play reports a purchase until it is consumed, so this is what rescues the one
 * that was paid for while the app was being killed. It is also the answer to
 * `already-owned`, and the reason a member who paid and saw nothing gets their
 * term by opening the screen again rather than by writing to us.
 *
 * Returns the best outcome it found, so a caller can say something true without
 * knowing how many purchases there were: a `paid` if anything was granted,
 * otherwise whatever the first unresolved purchase reported, otherwise null for
 * "there was nothing to do".
 */
export async function recoverPlayPurchases(): Promise<PurchaseOutcome | null> {
  if (!usesPlayBilling()) return null;
  if (!(await connect())) return null;

  let held: Purchase[];
  try {
    held = await getAvailablePurchases();
  } catch {
    return null;
  }

  let best: PurchaseOutcome | null = null;

  for (const purchase of held) {
    // Nothing has been paid yet, so there is nothing to verify and nothing to
    // consume. It arrives as its own event if it ever completes.
    if (purchase.purchaseState === "pending") continue;

    const outcome = await settle(purchase);

    if (outcome.status === "paid") best = outcome;
    else if (!best) best = outcome;
  }

  return best;
}

// ---------------------------------------------------------------------------
// What the store is willing to sell, and for how much
// ---------------------------------------------------------------------------

/** Enough of a plan to find its Play product. The catalogue rows satisfy it. */
type PlanForPlay = { code: string; introApplies: boolean };

export type PlayStore = {
  /** False when Play is unreachable or no plan has a product to sell. */
  purchasable: boolean;
  /** Plan codes Play can sell right now. */
  buyable: string[];
  /**
   * Google's own localised price string per plan code -- "₹199.00", or whatever
   * the member's Play account is billed in. Display only: what a member is
   * charged is set in Play Console and what grants a term is decided by the
   * server, so this never reaches either decision.
   */
  prices: Record<string, string>;
};

const nothingToSell: PlayStore = { purchasable: false, buyable: [], prices: {} };

/**
 * Which plans Play can sell, and what it would charge.
 *
 * The product mapping is read straight from `membership_plans`, which is
 * reference data readable by any signed-in member under a policy that predates
 * this work. Which of the two columns applies is decided by `intro_applies` from
 * the catalogue -- the server's answer, reused rather than recomputed, because
 * introductory eligibility depends on a member's whole payment history and a
 * second implementation of that rule would eventually disagree with the first.
 *
 * The product id chosen here is for display. The purchase uses the id
 * `payments-play-begin` returns, which is decided again at purchase time against
 * the same rule.
 */
export async function loadPlayStore(plans: PlanForPlay[]): Promise<PlayStore> {
  if (!usesPlayBilling() || plans.length === 0) return nothingToSell;
  if (!(await connect())) return nothingToSell;

  const { data, error } = await supabase
    .from("membership_plans")
    .select("code, play_product_id, play_intro_product_id")
    .eq("is_active", true);

  if (error || !data) return nothingToSell;

  const mapping = new Map(data.map((row) => [row.code, row]));

  /** Plan code by product id, so a fetched product can find its plan again. */
  const byProduct = new Map<string, string>();

  for (const plan of plans) {
    const row = mapping.get(plan.code);
    if (!row) continue;

    const productId = plan.introApplies
      ? row.play_intro_product_id
      : row.play_product_id;

    // Still NULL. The column is the mechanism; the value is a Play Console
    // decision that has not been made yet.
    if (!productId) continue;

    byProduct.set(productId, plan.code);
  }

  if (byProduct.size === 0) return nothingToSell;

  const prices = await playPrices([...byProduct.keys()]);
  const buyable: string[] = [];
  const byPlan: Record<string, string> = {};

  for (const [productId, planCode] of byProduct) {
    const price = prices.get(productId);
    // Absent means Play does not have this product, whatever the database says.
    // Not buyable, and deliberately not reported as a price of zero.
    if (price === undefined) continue;
    buyable.push(planCode);
    if (price) byPlan[planCode] = price;
  }

  return { purchasable: buyable.length > 0, buyable, prices: byPlan };
}

/** Localised prices for products Play recognises. Absent key means unknown sku. */
async function playPrices(skus: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();

  if (skus.length === 0) return found;

  let fetched;
  try {
    fetched = await fetchProducts({ skus, type: "in-app" });
  } catch {
    // The query itself failed, which says nothing about any one product. Every
    // sku stays unknown, so nothing is offered rather than offered blind.
    return found;
  }

  for (const product of fetched ?? []) {
    if (!product || typeof product.id !== "string") continue;
    found.set(product.id, product.displayPrice ?? "");
  }

  return found;
}

/**
 * One product's localised price, or null when Play has never heard of it.
 *
 * The null is the load-bearing half: it is how an unconfigured product is
 * refused before a sheet is launched.
 */
async function playPrice(sku: string): Promise<string | null> {
  const prices = await playPrices([sku]);
  const price = prices.get(sku);
  return price === undefined ? null : price;
}
