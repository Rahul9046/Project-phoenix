import type { Database } from "@/lib/supabase/database.types";

export type MembershipTier = Database["public"]["Enums"]["membership_tier"];
export type SubscriptionStatus =
  Database["public"]["Enums"]["subscription_status"];
export type PaymentProvider = Database["public"]["Enums"]["payment_provider"];

/**
 * Every capability the product gates on, in one place.
 *
 * Adding one here and in the `entitlements` table is the whole cost of a new
 * premium feature. Nothing else in the application should ever compare a tier
 * directly -- see `entitlements.ts` for why.
 */
export type EntitlementKey =
  | "canSeeInteresters"
  | "canUseIncognito"
  | "canUsePriorityVisibility"
  | "canBrowseProfiles"
  | "canUseDiscoveryFilters"
  | "canExpressInterest"
  | "canMessageConnections"
  | "revertLimit";

export type Entitlements = {
  readonly tier: MembershipTier;
  readonly canSeeInteresters: boolean;
  readonly canUseIncognito: boolean;
  readonly canUsePriorityVisibility: boolean;
  readonly canBrowseProfiles: boolean;
  readonly canUseDiscoveryFilters: boolean;
  readonly canExpressInterest: boolean;
  readonly canMessageConnections: boolean;
  readonly revertLimit: number;
};

export type MembershipPlan = {
  id: string;
  code: string;
  name: string;
  /** One line on who the term suits. */
  description: string | null;
  tier: MembershipTier;
  periodMonths: number;
  pricePaise: number;
  introPricePaise: number | null;
  introPeriodMonths: number | null;
  isRecurring: boolean;
};

export type Subscription = {
  id: string;
  status: SubscriptionStatus;
  provider: PaymentProvider;
  planCode: string;
  planName: string;
  periodMonths: number;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  isIntroductory: boolean;
};

export type Membership = {
  tier: MembershipTier;
  entitlements: Entitlements;
  /** The live subscription, if there is one. Free members have none. */
  subscription: Subscription | null;
};

/**
 * Statuses that entitle someone to the tier they paid for.
 *
 * 'cancelled' is included on purpose: cancelling stops the renewal, it does not
 * refund the current term. Revoking access the moment someone cancels would
 * take away time they have already paid for.
 *
 * 'pending' is NOT included. No payment provider is configured, so a pending
 * row records intent and nothing more -- honouring it would be granting premium
 * for free.
 */
export const ENTITLING_STATUSES: readonly SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "cancelled",
];
