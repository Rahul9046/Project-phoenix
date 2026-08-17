import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Cities and languages, read from the database rather than a constant.
 *
 * Both are public reference data — the RLS policies allow `anon` to read the
 * active rows — so this works before anyone has signed in, which the signup
 * form needs.
 */

export type CityOption = {
  id: string;
  name: string;
  isLaunchCity: boolean;
};

export type LanguageOption = {
  id: string;
  name: string;
};

export async function getActiveCities(): Promise<CityOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cities")
    .select("id, name, is_launch_city")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    // Signup cannot proceed without cities, and an empty list would look like
    // a deliberate product decision rather than a fault.
    throw new Error(`Could not load cities: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    isLaunchCity: row.is_launch_city,
  }));
}

export async function getActiveLanguages(): Promise<LanguageOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("languages")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Could not load languages: ${error.message}`);
  }

  return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
}
