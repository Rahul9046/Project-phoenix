import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";

/**
 * What this member is allowed to do.
 *
 * Read from the `entitlements` table, keyed by tier, never inferred from a
 * `tier === "premium"` comparison in a component. Two reasons, and the second
 * matters more:
 *
 * A named capability survives a change of mind. If reverts move from premium to
 * free, that is an update to one row, not a hunt through the app for every place
 * that compared a tier.
 *
 * And the client is not the authority. What is fetched here decides what the UI
 * offers; what the database decides is what actually happens. `interests_received`
 * checks the subscription in SQL and returns nothing without it, and
 * `revert_last_pass` counts the allowance in SQL -- so an app that lied to itself
 * about being premium would get a prettier screen and exactly the same data.
 *
 * `subscriptions` has no insert, update or delete policy for anyone, so a client
 * cannot grant itself a tier in the first place.
 */

export type Entitlements = {
  tier: "free" | "premium";
  canSeeInteresters: boolean;
  canUseIncognito: boolean;
  canUsePriorityVisibility: boolean;
  canBrowseProfiles: boolean;
  canUseDiscoveryFilters: boolean;
  revertLimit: number;
};

/**
 * What someone gets before the table has been read.
 *
 * The free tier, deliberately. Assuming premium and correcting downwards would
 * flash a capability someone does not have; assuming free and correcting upwards
 * shows a paid feature arriving, which is the harmless direction to be wrong in.
 */
export const freeDefaults: Entitlements = {
  tier: "free",
  canSeeInteresters: false,
  canUseIncognito: false,
  canUsePriorityVisibility: false,
  canBrowseProfiles: true,
  canUseDiscoveryFilters: true,
  revertLimit: 3,
};

async function readTier(): Promise<"free" | "premium"> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return "free";

  const { data } = await supabase
    .from("subscriptions")
    .select("status, membership_plans!inner(tier)")
    .eq("profile_id", me)
    .in("status", ["trialing", "active", "past_due", "cancelled"])
    .limit(1);

  const row = data?.[0];
  const plan = row?.membership_plans as { tier?: string } | undefined;

  return plan?.tier === "premium" ? "premium" : "free";
}

export async function getEntitlements(): Promise<Entitlements> {
  const tier = await readTier();

  const { data, error } = await supabase
    .from("entitlements")
    .select("key, kind, value")
    .eq("tier", tier);

  if (error || !data) return { ...freeDefaults, tier };

  const byKey = new Map(data.map((row) => [row.key, row]));

  /*
   * `value` is jsonb, so it arrives as a Json union rather than a string --
   * `true` and `"true"` are both possible depending on how a row was written.
   * Both are read here rather than assuming one, because a seed that changes
   * shape should not silently downgrade everyone to the free tier.
   */
  function boolean(key: string, fallback: boolean): boolean {
    const row = byKey.get(key);
    if (!row) return fallback;
    if (typeof row.value === "boolean") return row.value;
    return String(row.value) === "true";
  }

  function number(key: string, fallback: number): number {
    const row = byKey.get(key);
    if (!row) return fallback;
    if (typeof row.value === "number") return row.value;
    const parsed = Number.parseInt(String(row.value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return {
    tier,
    canSeeInteresters: boolean("canSeeInteresters", false),
    canUseIncognito: boolean("canUseIncognito", false),
    canUsePriorityVisibility: boolean("canUsePriorityVisibility", false),
    canBrowseProfiles: boolean("canBrowseProfiles", true),
    canUseDiscoveryFilters: boolean("canUseDiscoveryFilters", true),
    revertLimit: number("revertLimit", 3),
  };
}

export function useEntitlements() {
  const [entitlements, setEntitlements] = useState<Entitlements>(freeDefaults);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const next = await getEntitlements();
    setEntitlements(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void getEntitlements().then((next) => {
      if (!active) return;
      setEntitlements(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { entitlements, loading, reload: load };
}
