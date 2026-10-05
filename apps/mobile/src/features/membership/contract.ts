import { supabase } from "@/lib/supabase/client";

/**
 * What a purchase can end as, and how to ask the server anything.
 *
 * Extracted from `payments.ts` on 2026-10-04, when Google Play became a second
 * way to pay. Both providers need the same vocabulary for an outcome and the
 * same way of calling an edge function, and neither should import the other --
 * `payments.ts` dispatches to `play-billing.ts`, so anything they share has to
 * live beside them rather than in one of them.
 *
 * Nothing here is provider-specific. The types are deliberately about what
 * happened to a member rather than about what a store reported, which is why
 * the Play client can reuse them without translating Google's vocabulary into
 * Razorpay's.
 */

export type Membership = {
  tier: "free" | "premium";
  active: boolean;
  expiresAt: string | null;
  planName: string | null;
  periodMonths: number | null;
  introOfferUsed: boolean;
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
  | { status: "unavailable" }
  /**
   * There is nothing to sell yet, and nobody has been charged.
   *
   * Only reachable on Google Play, and it means the store side of a plan is
   * incomplete: `membership_plans.play_product_id` is still NULL, or it names a
   * product that does not exist in Play Console. Separate from `unavailable`
   * because that one is "try again" and this one is "this cannot work until
   * somebody finishes configuring it" -- a different sentence to a member and a
   * different job for us.
   */
  | { status: "unconfigured" };

/** The server's membership row, read defensively because it crosses a wire. */
export function asMembership(value: unknown): Membership {
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
 * Calling an edge function, where a failure is an absent answer.
 *
 * `null` means "we did not get a reply", which is never the same as a reply
 * saying no. Every caller has to decide what an unanswered call means for the
 * money involved, and flattening a network error into a negative status is how
 * a paid member gets told their payment failed.
 */
export async function invoke<T>(
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
