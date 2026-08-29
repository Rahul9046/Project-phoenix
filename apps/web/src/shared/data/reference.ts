import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Reference data read on the server.
 *
 * Cities are public — the RLS policies let `anon` read the active rows — so this
 * works before anyone has signed in, which the landing page form needs.
 *
 * There is deliberately no "fetch every city" function any more. There are 493
 * of them; anything that used to render the whole list now either searches
 * (`shared/data/cities.ts`, from the browser) or asks for the focus cities.
 */

export type CityOption = {
  id: string;
  name: string;
  state: string | null;
  /** Marketing metadata. Never gates registration. */
  isFocusCity: boolean;
};

export type LanguageOption = {
  id: string;
  name: string;
};

/**
 * The cities Eraya is concentrating on first, for the landing page.
 *
 * This is where the community is densest, not where registration is permitted —
 * anyone in India can join from anywhere, and the marketing copy says so.
 */
export async function getFocusCities(): Promise<CityOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cities")
    .select("id, name, state, is_launch_city")
    .eq("is_active", true)
    .eq("is_launch_city", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Could not load cities: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    state: row.state,
    isFocusCity: row.is_launch_city,
  }));
}

/**
 * One city by id, for rendering a stored `profiles.city_id` as a name.
 *
 * A single lookup rather than fetching the list and filtering it: the profile
 * already holds the id, and 492 of the rows would be discarded.
 */
export async function getCityById(id: string): Promise<CityOption | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cities")
    .select("id, name, state, is_launch_city")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    state: data.state,
    isFocusCity: data.is_launch_city,
  };
}

/** Confirms a city id exists and is selectable. Used when validating a form. */
export async function cityExists(id: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cities")
    .select("id")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  return Boolean(data);
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
