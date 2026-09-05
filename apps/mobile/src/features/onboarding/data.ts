import { supabase } from "@/lib/supabase/client";
import type { Gender, RelationshipStatus } from "@/features/auth/types";

/**
 * Writing the answers.
 *
 * Each step writes only the column it asked about. A single "save the whole
 * profile" call would mean an interrupted onboarding loses everything before the
 * point it stopped, and someone resuming on a different device would find blank
 * screens they had already filled in.
 *
 * Nothing here computes an onboarding stage. The database owns that -- there is
 * a trigger on the profile -- and a client that guessed would eventually
 * disagree with it and strand someone on a screen they had finished.
 *
 * Failures are turned into sentences a person can act on. "23514" and
 * "violates check constraint" are true and useless; "please check the year in
 * your date of birth" is what the person actually needs to do next.
 */

export type SaveResult = { ok: true } | { ok: false; message: string };

const GENERIC =
  "We could not save that just now. Please check your connection and try again.";

function describe(error: { code?: string; message: string }): string {
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "23514" && message.includes("date_of_birth_adult")) {
    return "Eraya is for people aged 18 and over. Please check the year in your date of birth.";
  }
  if (code === "23514" && message.includes("about_length")) {
    return "That is a little longer than we can store. Please shorten it slightly.";
  }
  if (code === "22P02") {
    return "One of those answers was not recognised. Please choose it again.";
  }
  if (code === "PGRST301" || code === "42501") {
    return "Your session has expired. Please sign in again.";
  }
  return GENERIC;
}

async function patch(
  values: Record<string, unknown>,
): Promise<SaveResult> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;

  if (!id) {
    return { ok: false, message: "Your session has expired. Please sign in again." };
  }

  /*
   * Upsert rather than update. The profile row is created by a trigger on
   * `auth.users`, and a first sign-in can outrun it -- an update would then
   * report success while writing nothing at all, which is the worst failure
   * shape available.
   */
  const { error } = await supabase
    .from("profiles")
    .upsert({ id, ...values }, { onConflict: "id" });

  if (error) {
    console.warn("[eraya] profile save failed", {
      code: error.code,
      message: error.message,
    });
    return { ok: false, message: describe(error) };
  }

  return { ok: true };
}

export function saveName(firstName: string): Promise<SaveResult> {
  return patch({ first_name: firstName.trim() });
}

export function saveBirthday(isoDate: string): Promise<SaveResult> {
  return patch({ date_of_birth: isoDate });
}

export function saveGender(gender: Gender): Promise<SaveResult> {
  return patch({ gender });
}

/**
 * Who this member hopes to meet.
 *
 * Applied mutually by `discover_members`, so this decides both who someone sees
 * and who sees them. An empty array is never written: the onboarding step
 * requires at least one answer, and "everyone" is expressed by choosing all of
 * them rather than by choosing none.
 */
export function saveSeeking(seeking: Gender[]): Promise<SaveResult> {
  return patch({ seeking });
}

/**
 * A city, whether or not it is in the table.
 *
 * `city_id` for one of the 493, `other_city` for anywhere else. Both are stored
 * and the other is cleared, so changing from a listed city to a typed one does
 * not leave the old value behind to be read later.
 */
export function saveCity(
  city: { id: string } | { name: string },
): Promise<SaveResult> {
  if ("id" in city) {
    return patch({ city_id: city.id, other_city: null });
  }
  return patch({ city_id: null, other_city: city.name.trim() });
}

export function saveRelationship(
  relationshipStatus: RelationshipStatus,
): Promise<SaveResult> {
  return patch({ relationship_status: relationshipStatus });
}

export function saveStory(values: {
  about?: string | null;
  lookingFor?: string | null;
}): Promise<SaveResult> {
  const next: Record<string, unknown> = {};
  if (values.about !== undefined) next.about = values.about?.trim() || null;
  if (values.lookingFor !== undefined) {
    next.looking_for = values.lookingFor?.trim() || null;
  }
  return patch(next);
}

/**
 * Languages, as a replace rather than a merge.
 *
 * Deleting then inserting is the only way to express "these and no others"
 * through PostgREST without a stored procedure, and the two statements are
 * ordered so the worst interruption leaves someone with no languages rather than
 * a mixture of old and new -- recoverable by answering the question again.
 */
export async function saveLanguages(
  languageIds: string[],
  undisclosed: boolean,
): Promise<SaveResult> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;

  if (!id) {
    return { ok: false, message: "Your session has expired. Please sign in again." };
  }

  const { error: clearError } = await supabase
    .from("profile_languages")
    .delete()
    .eq("profile_id", id);

  if (clearError) return { ok: false, message: describe(clearError) };

  if (!undisclosed && languageIds.length > 0) {
    const { error: insertError } = await supabase
      .from("profile_languages")
      .insert(
        languageIds.map((languageId) => ({
          profile_id: id,
          language_id: languageId,
        })),
      );

    if (insertError) return { ok: false, message: describe(insertError) };
  }

  return patch({ languages_undisclosed: undisclosed });
}

/**
 * Recording that the phone step was completed.
 *
 * Named for what it is. Nothing has been verified -- no SMS is sent and any six
 * digits are accepted -- so this writes the timestamp the stage machine needs
 * and claims nothing more. When an SMS provider is connected, Supabase sets
 * `auth.users.phone_confirmed_at` and a trigger mirrors it, and this function
 * goes away rather than being quietly repurposed.
 */
export function completePhoneStep(): Promise<SaveResult> {
  return patch({ phone_verified_at: new Date().toISOString() });
}

/** Marks onboarding finished, once every question has an answer. */
export function completeOnboarding(): Promise<SaveResult> {
  return patch({ onboarding_stage: "onboarding_completed" });
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export type CityResult = {
  id: string;
  name: string;
  state: string | null;
  stateCode: string | null;
};

/**
 * City search, run in the database.
 *
 * Ranking, the misspelling fallback and the tie-break between same-named cities
 * all live in `search_cities`. Sorting in the client would mean fetching a large
 * set in order to sort it, which is the thing worth avoiding on mobile data.
 */
export async function searchCities(
  query: string,
  limit = 8,
): Promise<CityResult[]> {
  const { data, error } = await supabase.rpc("search_cities", {
    query,
    max_results: limit,
  });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    state: row.state,
    stateCode: row.state_code,
  }));
}

export type LanguageOption = { id: string; name: string };

export async function listLanguages(): Promise<LanguageOption[]> {
  const { data, error } = await supabase
    .from("languages")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => ({ id: row.id, name: row.name }));
}
