import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/lib/supabase/client";

/**
 * Buying Premium.
 *
 * The app knows a plan code and nothing else about money. It cannot name an
 * amount, cannot decide whether the introductory price applies, and cannot
 * conclude that a payment succeeded -- every one of those is answered by the
 * server, because every one of them is worth lying about.
 *
 * The shape of a purchase:
 *
 *   ask the server to create an order   (it picks the price)
 *   open the website's /checkout page   (in the browser, not in a screen we drew)
 *   hand what comes back to the server  (it checks the signature)
 *   read the membership the server now reports
 *
 * Card details never touch this app. Checkout runs in the system browser, the
 * same way sign-in already opens Google, so the only thing crossing back is an
 * order id and a signature that is useless without the key secret.
 *
 * There is no native Razorpay module here on purpose. One would mean a new
 * build of every client before anybody could pay, a config plugin to keep
 * working, and a second integration drifting away from the website's. If the
 * app stores later require their own billing, this file is the seam that
 * changes -- see docs/10-payments.md.
 */

export type Plan = {
  code: string;
  name: string;
  description: string | null;
  periodMonths: number;
  /** What this member pays now, in paise. The server decided it. */
  pricePaise: number;
  /** The ordinary price, so the monthly plan can say what it becomes. */
  standardPricePaise: number;
  introApplies: boolean;
  currency: string;
};

export type Membership = {
  tier: "free" | "premium";
  active: boolean;
  expiresAt: string | null;
  planName: string | null;
  periodMonths: number | null;
  introOfferUsed: boolean;
};

export type PaymentRecord = {
  id: string;
  planName: string;
  periodMonths: number;
  amountPaise: number;
  status: string;
  introOfferApplied: boolean;
  createdAt: string;
  paidAt: string | null;
};

/**
 * What happened, in words the product can use.
 *
 * `processing` is the important one and the reason this is not a boolean. Money
 * can have left somebody's account while the confirmation has not arrived, and
 * the honest thing to say then is that we are still checking -- not "failed",
 * which is wrong, and not "you have not been charged", which we do not know.
 */
export type PurchaseOutcome =
  | { status: "paid"; membership: Membership }
  | { status: "processing" }
  | { status: "cancelled" }
  | { status: "failed" }
  /**
   * We could not work out what happened, and the reason is ours rather than
   * the bank's -- an order the server does not recognise, a signature that did
   * not check out, a status this build has never heard of. Distinct from
   * `failed` because calling it a decline invents a reason, and distinct from
   * `unavailable` because the network was fine and money may well have moved.
   */
  | { status: "unconfirmed" }
  | { status: "unavailable" };

const rupeesFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Paise are what everything is stored and charged in; rupees are for reading. */
export function formatPaise(paise: number): string {
  return rupeesFormatter.format(paise / 100);
}

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.rpc("membership_catalogue");
  if (error || !data) return [];

  return data.map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description,
    periodMonths: row.period_months,
    pricePaise: row.price_paise,
    standardPricePaise: row.standard_price_paise,
    introApplies: row.intro_applies,
    currency: row.currency,
  }));
}

export async function getMembership(): Promise<Membership | null> {
  const { data, error } = await supabase.rpc("my_membership");
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  return {
    tier: row.tier === "premium" ? "premium" : "free",
    active: row.active === true,
    expiresAt: (row.expires_at as string) ?? null,
    planName: (row.plan_name as string) ?? null,
    periodMonths: (row.period_months as number) ?? null,
    introOfferUsed: row.intro_offer_used === true,
  };
}

export async function getPayments(): Promise<PaymentRecord[]> {
  const { data, error } = await supabase.rpc("my_payments");
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    planName: row.plan_name,
    periodMonths: row.period_months,
    amountPaise: row.amount_paise,
    status: row.status,
    introOfferApplied: row.intro_offer_applied,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  }));
}

type OrderReply = {
  status?: string;
  orderId?: string;
  keyId?: string;
  planName?: string;
};

/**
 * The whole purchase, start to finish.
 *
 * Every branch that could end in "we think you paid" instead asks the server
 * again. The client's view of a payment is a hint; the answer comes from a
 * signature check or from Razorpay's own record of the order.
 */
export async function purchase(planCode: string): Promise<PurchaseOutcome> {
  const created = await invoke<OrderReply>("payments-create-order", {
    planCode,
  });

  if (!created || created.status !== "created" || !created.orderId || !created.keyId) {
    return { status: "unavailable" };
  }

  const url =
    `${siteUrl()}/checkout` +
    `?order_id=${encodeURIComponent(created.orderId)}` +
    `&key_id=${encodeURIComponent(created.keyId)}` +
    `&plan=${encodeURIComponent(created.planName ?? "Eraya Premium")}`;

  let returned: WebBrowser.WebBrowserAuthSessionResult;
  try {
    returned = await WebBrowser.openAuthSessionAsync(url, "eraya://payment");
  } catch {
    // The browser would not open at all. Nothing was charged, because nothing
    // was shown.
    return { status: "unavailable" };
  }

  /*
   * Closing the browser is not proof of anything.
   *
   * Somebody may dismiss it after paying, or lose the network on the way back.
   * A dismissal is treated as a reason to ask the server rather than as a
   * cancellation, and the server asks Razorpay.
   */
  if (returned.type !== "success") {
    return reconcile(created.orderId, { assumeCancelled: true });
  }

  const params = new URL(returned.url).searchParams;
  const status = params.get("status");

  if (status === "paid") {
    const verified = await invoke<{ status?: string; membership?: unknown }>(
      "payments-verify",
      {
        orderId: created.orderId,
        paymentId: params.get("payment_id"),
        signature: params.get("signature"),
      },
    );

    if (verified?.status === "paid") {
      return { status: "paid", membership: asMembership(verified.membership) };
    }

    // The signature did not check out, or the call did not get through. Either
    // way this is not a success, and it is not necessarily a failure either.
    return reconcile(created.orderId, { assumeCancelled: false });
  }

  if (status === "cancelled") return reconcile(created.orderId, { assumeCancelled: true });

  return reconcile(created.orderId, { assumeCancelled: false });
}

/**
 * Asking the server what really happened to an order.
 *
 * Used when the browser closed without a clear answer, and again from the
 * screen when somebody returns to a purchase that never resolved. This is what
 * stops a lost callback from costing somebody the thing they paid for.
 */
export async function reconcile(
  orderId: string,
  options: { assumeCancelled: boolean } = { assumeCancelled: false },
): Promise<PurchaseOutcome> {
  const checked = await invoke<{ status?: string; membership?: unknown }>(
    "payments-verify",
    { orderId },
  );

  if (!checked) return { status: "processing" };

  switch (checked.status) {
    case "paid":
      return { status: "paid", membership: asMembership(checked.membership) };

    // Razorpay has a declined payment against this order and no captured one.
    case "failed":
      return { status: "failed" };

    case "cancelled":
      return { status: "cancelled" };

    // Nothing captured against the order yet. If the person closed the sheet
    // themselves, that is a cancellation; otherwise it is still moving.
    case "pending":
      return options.assumeCancelled
        ? { status: "cancelled" }
        : { status: "processing" };

    /*
     * Our fault, not the bank's.
     *
     * `unknown_order` means the server has no such order for this member;
     * `invalid_signature` means what came back did not check out. Both arrive
     * as HTTP 200, so both used to fall through to `failed` below -- which told
     * somebody their bank had declined a payment their bank may well have
     * taken, and told them nothing was charged when we did not know that.
     */
    case "unknown_order":
    case "invalid_signature":
      return { status: "unconfirmed" };

    /*
     * A status this build does not know -- a newer server, or one of
     * `settle_payment`'s own outcomes passed straight through. Guessing
     * "declined" would invent a reason and guessing "cancelled" would invent a
     * fact, so it says neither.
     */
    default:
      return { status: "unconfirmed" };
  }
}

function asMembership(value: unknown): Membership {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    tier: row.tier === "premium" ? "premium" : "free",
    active: row.active === true,
    expiresAt: (row.expires_at as string) ?? null,
    planName: (row.plan_name as string) ?? null,
    periodMonths: (row.period_months as number) ?? null,
    introOfferUsed: row.intro_offer_used === true,
  };
}

/**
 * Where the checkout page lives.
 *
 * The website, not an edge function. Supabase serves HTML returned from a
 * function on the shared `*.supabase.co` domain as `text/plain` under a
 * `sandbox` CSP, so a checkout page hosted there arrives as source text and
 * never runs -- the hardening is the platform's, and no header this end can
 * undo it. The web app has a domain that may serve HTML, and serves this page
 * at `/checkout`.
 *
 * Read as a whole expression, never as `process.env[name]`: Expo inlines these
 * by matching the literal text during the build, and a computed lookup yields
 * undefined in a release build while working perfectly in development.
 */
function siteUrl(): string {
  return process.env.EXPO_PUBLIC_SITE_URL ?? "";
}

async function invoke<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke<T>(name, { body });
    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}
