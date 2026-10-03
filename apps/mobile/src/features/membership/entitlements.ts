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
 * offers; what the database decides is what actually happens. `revert_last_pass`
 * and `reverts_remaining` count the allowance in SQL, against `has_active_premium`
 * -- so an app that lied to itself about being premium would get a prettier
 * screen and exactly the same data.
 *
 * `subscriptions` has no insert, update or delete policy for anyone, so a client
 * cannot grant itself a tier in the first place.
 */

export type Entitlements = {
  tier: "free" | "premium";
  canBrowseProfiles: boolean;
  canUseDiscoveryFilters: boolean;
  /**
   * The only capability that differs by tier, and the only one enforced.
   *
   * `canUseIncognito` and `canUsePriorityVisibility` were here, seeded,
   * advertised on the membership screen, and implemented nowhere. They were
   * withdrawn on 2026-10-03 rather than left on sale. Either can return the
   * way any capability arrives -- two `entitlements` rows and the feature that
   * reads them -- and removing the keys as well as the rows is what stops one
   * coming back as a row alone.
   */
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
  canBrowseProfiles: true,
  canUseDiscoveryFilters: true,
  revertLimit: 3,
};

/**
 * The tier, asked of the server rather than worked out from a row.
 *
 * This used to query `subscriptions` and filter on `status` alone. Nothing in
 * the project ever writes `expired`, so a term that had run out stayed at
 * `active` and this returned `premium` for ever.
 *
 * The fix is not to add a date comparison here. A date compared on a phone is
 * compared against the phone's clock, which the person holding it can set to
 * whatever they like -- so the honest version of that check is the one that
 * runs in Postgres. `my_membership()` applies `current_period_end > now()`
 * there and is already what the membership screen reads, so the app now has one
 * answer instead of two that could disagree.
 */
async function readTier(): Promise<"free" | "premium"> {
  const { data, error } = await supabase.rpc("my_membership");
  if (error || !data) return "free";

  const row = data as Record<string, unknown>;

  // Both halves, for the same reason the web asks for both: `active` is the
  // date test and `tier` is what was bought. Anything else is free.
  return row.active === true && row.tier === "premium" ? "premium" : "free";
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
