import { createClient } from "@/lib/supabase/client";

/**
 * City search, for the onboarding and waitlist selectors.
 *
 * Runs against Supabase from the browser rather than through a server action.
 * Cities are public reference data — `anon` may read them, and `search_cities`
 * is SECURITY INVOKER so the same RLS applies — and a keystroke-driven search
 * should not take a round trip through Next.js on the way. It is one hop.
 *
 * Ranking happens in the database, not here. See the `search_cities` migration:
 * sorting a large result set in the browser would mean fetching a large result
 * set in the first place.
 */

export type CityResult = {
  id: string;
  name: string;
  state: string;
  stateCode: string;
  /** Marketing metadata. Affects result order only, never selectability. */
  isFocusCity: boolean;
};

export const CITY_RESULT_LIMIT = 8;

export async function searchCities(
  query: string,
  limit: number = CITY_RESULT_LIMIT,
): Promise<CityResult[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("search_cities", {
    query,
    max_results: limit,
  });

  // A failed search should leave the field usable rather than throwing under
  // the person typing. The caller renders "no matches", which is honest: we
  // could not find anything, whatever the reason.
  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    state: row.state,
    stateCode: row.state_code,
    isFocusCity: row.is_launch_city,
  }));
}

/**
 * Looks up one city, for rendering a stored `city_id` back as a name.
 *
 * Needed because a profile stores the id, and the account page has to show a
 * city rather than a uuid.
 */
export async function getCityById(id: string): Promise<CityResult | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from("cities")
    .select("id, name, state, state_code, is_launch_city")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    state: data.state ?? "",
    stateCode: data.state_code ?? "",
    isFocusCity: data.is_launch_city,
  };
}
