import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  ENTITLING_STATUSES,
  type Entitlements,
  type Membership,
  type MembershipTier,
  type Subscription,
} from "@/features/membership/types";

/**
 * The one place that decides what a member may do.
 *
 * Two rules make this worth having rather than sprinkling `tier === 'premium'`
 * through the UI:
 *
 * 1. Capabilities are data. They come from the `entitlements` table, so adding
 *    a premium feature later is an insert, not a refactor of every component
 *    that has an opinion about tiers.
 * 2. This runs on the server. A browser cannot be trusted to report what it has
 *    paid for, and `subscriptions` has no client write policy precisely so that
 *    it cannot try.
 *
 * Anything user-visible may read these booleans. Nothing user-visible should
 * read the tier itself except to display the word "Premium".
 */

/**
 * What a member gets when nothing else is known.
 *
 * Deliberately the free tier, and deliberately hardcoded: if the entitlements
 * table is unreachable, the safe failure is to withhold paid features, never to
 * hand them out. These values mirror the seeded `free` rows.
 */
const FREE_FALLBACK: Entitlements = {
  tier: "free",
  canBrowseProfiles: true,
  canUseDiscoveryFilters: true,
  canExpressInterest: true,
  canMessageConnections: true,
  revertLimit: 3,
};

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Reads the current member's membership: tier, entitlements and live
 * subscription. Returns the free tier for signed-out visitors.
 */
export async function loadMembership(): Promise<Membership> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { tier: "free", entitlements: FREE_FALLBACK, subscription: null };
  }

  /*
   * The tier comes from the database, not from a status this code interprets.
   *
   * It used to be read off the subscription row's plan, filtered on `status`
   * alone -- and since nothing in the project ever writes `expired`, a term
   * that had run out sat at `active` and this function went on reporting
   * premium for ever. `my_membership()` applies the real rule,
   * `current_period_end > now()`, in Postgres, against Postgres's own clock.
   * That matters beyond tidiness: a date compared here would be compared
   * against this server's clock, which is a second source of truth for the one
   * fact the whole paywall turns on.
   *
   * The `gt` below is a narrowing of the same rule so an expired row is not
   * fetched and rendered as a live term. It is not what decides the tier.
   */
  const nowIso = new Date().toISOString();

  // RLS limits this to the caller's own rows, so no profile filter is needed
  // for correctness -- but the partial unique index allows only one live row
  // anyway, and asking for it explicitly documents the intent.
  const [{ data: reported }, { data: subscriptionRows }, { data: entitlementRows }] =
    await Promise.all([
      supabase.rpc("my_membership"),
      supabase
        .from("subscriptions")
        .select(
          "id, status, provider, current_period_end, cancel_at, is_introductory, membership_plans(code, name, tier, period_months)",
        )
        .in("status", [...ENTITLING_STATUSES])
        .gt("current_period_end", nowIso)
        .order("current_period_end", { ascending: false })
        .limit(1),
      supabase.from("entitlements").select("tier, key, value"),
    ]);

  const row = subscriptionRows?.[0] ?? null;

  // The embedded plan can arrive as an object or a single-element array
  // depending on how the relation is inferred; tolerate both rather than
  // trusting one shape.
  const rawPlan = row?.membership_plans as unknown;
  const plan = (
    Array.isArray(rawPlan) ? rawPlan[0] : rawPlan
  ) as
    | { code: string; name: string; tier: MembershipTier; period_months: number }
    | null
    | undefined;

  /*
   * Premium requires both halves of the database's answer.
   *
   * `active` is the date test and `tier` is what was bought. Reading only the
   * first would trust a row whose plan is unknown to this build; reading only
   * the second is the bug this replaces. Anything else at all is free, which is
   * the safe direction to be wrong in.
   */
  const answer = (reported ?? null) as
    | { tier?: string | null; active?: boolean | null }
    | null;

  const tier: MembershipTier =
    answer?.active === true && answer.tier === "premium" ? "premium" : "free";

  const subscription: Subscription | null =
    tier === "premium" && row && plan
      ? {
          id: row.id,
          status: row.status,
          provider: row.provider,
          planCode: plan.code,
          planName: plan.name,
          periodMonths: plan.period_months,
          currentPeriodEnd: row.current_period_end,
          cancelAt: row.cancel_at,
          isIntroductory: row.is_introductory,
        }
      : null;

  const forTier = (entitlementRows ?? []).filter((e) => e.tier === tier);
  const valueOf = (key: string): unknown =>
    forTier.find((e) => e.key === key)?.value;

  const entitlements: Entitlements = {
    tier,
    canBrowseProfiles: asBoolean(
      valueOf("canBrowseProfiles"),
      FREE_FALLBACK.canBrowseProfiles,
    ),
    canUseDiscoveryFilters: asBoolean(
      valueOf("canUseDiscoveryFilters"),
      FREE_FALLBACK.canUseDiscoveryFilters,
    ),
    canExpressInterest: asBoolean(
      valueOf("canExpressInterest"),
      FREE_FALLBACK.canExpressInterest,
    ),
    canMessageConnections: asBoolean(
      valueOf("canMessageConnections"),
      FREE_FALLBACK.canMessageConnections,
    ),
    revertLimit: asNumber(valueOf("revertLimit"), FREE_FALLBACK.revertLimit),
  };

  return { tier, entitlements, subscription };
}

/** The plans on sale, cheapest commitment first. */
export async function loadPlans() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("membership_plans")
    .select(
      "id, code, name, description, tier, period_months, price_paise, intro_price_paise, intro_period_months, is_recurring",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    tier: p.tier,
    periodMonths: p.period_months,
    pricePaise: p.price_paise,
    introPricePaise: p.intro_price_paise,
    introPeriodMonths: p.intro_period_months,
    isRecurring: p.is_recurring,
  }));
}

export type TierCapability = {
  key: string;
  /** Human label, straight from the table so the page and the data agree. */
  description: string;
  kind: "boolean" | "number";
  free: boolean | number;
  premium: boolean | number;
  /** True when premium gives more than free — a flag turned on, or a bigger number. */
  isUpgrade: boolean;
};

/**
 * Both tiers side by side, for the public pricing page.
 *
 * No session required: `entitlements` and `membership_plans` are both readable
 * by `anon` on purpose. Someone deciding whether to join has to be able to see
 * what they would get, and hiding that behind a login is hostile.
 *
 * The comparison is computed from the values rather than written out again, so
 * the pricing page cannot drift from what the application actually enforces.
 * Changing what premium includes is a row edit, and this page follows.
 */
export async function loadTierComparison(): Promise<TierCapability[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("entitlements")
    .select("tier, key, kind, value, description");

  const rows = data ?? [];
  const keys = [...new Set(rows.map((row) => row.key))];

  return keys
    .map((key) => {
      const free = rows.find((r) => r.key === key && r.tier === "free");
      const premium = rows.find((r) => r.key === key && r.tier === "premium");
      if (!free || !premium) return null;

      const freeValue = free.value as boolean | number;
      const premiumValue = premium.value as boolean | number;

      const isUpgrade =
        typeof premiumValue === "number" && typeof freeValue === "number"
          ? premiumValue > freeValue
          : premiumValue === true && freeValue === false;

      return {
        key,
        description: premium.description ?? key,
        kind: premium.kind,
        free: freeValue,
        premium: premiumValue,
        isUpgrade,
      } satisfies TierCapability;
    })
    .filter((row): row is TierCapability => row !== null)
    // Shared capabilities first, then what premium adds — the order someone
    // reads it in: "here is what you get anyway, here is what more costs".
    .sort((a, b) => Number(a.isUpgrade) - Number(b.isUpgrade));
}
