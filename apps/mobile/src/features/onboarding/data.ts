import { LEGAL_VERSION } from "@eraya/legal";
import type { TranslationKey } from "@eraya/i18n";

import { supabase } from "@/lib/supabase/client";
import {
  stageAtLeast,
  type Gender,
  type OnboardingStage,
  type Religion,
  type RelationshipStatus,
} from "@/features/auth/types";

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

export type SaveResult = { ok: true } | { ok: false; messageKey: TranslationKey };

const GENERIC: TranslationKey = "failures.saveFailed";

function describe(error: { code?: string; message: string }): TranslationKey {
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "23514" && message.includes("date_of_birth_adult")) {
    return "failures.underage";
  }
  if (code === "23514" && message.includes("about_length")) {
    return "failures.tooLong";
  }
  if (code === "22P02") {
    return "failures.unrecognisedAnswer";
  }
  if (code === "PGRST301" || code === "42501") {
    return "failures.sessionExpired";
  }
  return GENERIC;
}

async function patch(
  values: Record<string, unknown>,
): Promise<SaveResult> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;

  if (!id) {
    return { ok: false, messageKey: "failures.sessionExpired" };
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
    return { ok: false, messageKey: describe(error) };
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

/**
 * What the member said about their religion, and only that.
 *
 * `prefer_not_to_say` is written like any other value. It is an answer, and
 * storing it is what lets the product tell somebody who declined from somebody
 * who has not been asked -- which is null, and which every account that existed
 * before this question still holds.
 *
 * Nothing here derives a value from a name, a city or a language, and there is
 * no path that could: the only argument is the one the member chose.
 */
export function saveReligion(religion: Religion): Promise<SaveResult> {
  return patch({ religion });
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
    return { ok: false, messageKey: "failures.sessionExpired" };
  }

  const { error: clearError } = await supabase
    .from("profile_languages")
    .delete()
    .eq("profile_id", id);

  if (clearError) return { ok: false, messageKey: describe(clearError) };

  if (!undisclosed && languageIds.length > 0) {
    const { error: insertError } = await supabase
      .from("profile_languages")
      .insert(
        languageIds.map((languageId) => ({
          profile_id: id,
          language_id: languageId,
        })),
      );

    if (insertError) return { ok: false, messageKey: describe(insertError) };
  }

  return patch({ languages_undisclosed: undisclosed });
}

/*
 * There is no `completePhoneStep` any more, deliberately.
 *
 * It used to write `phone_verified_at` from the app, which was honest while the
 * column meant "number added" and became a hole the moment it started meaning
 * "somebody answered an SMS on this number". The verify edge function writes it
 * now, holding the service role, and a trigger on `profiles` refuses that column
 * to every client -- so this cannot be reintroduced by accident.
 */

/**
 * Recording that the phone step is behind them.
 *
 * Written from both answers: by the code screen once a number is verified, and
 * by "Skip for now" when it is declined. That is the point -- what this records
 * is that the question was asked and answered, which is equally true either
 * way, and it is the only thing the routing needs in order to stop asking.
 *
 * It writes the stage and nothing else. No number, no timestamp, no status: a
 * member who declines leaves with exactly the verification state they arrived
 * with, and the trigger on `profiles` would refuse this client any of those
 * columns even if somebody added them here by mistake.
 *
 * The stage's own value is `phone_verified`, which predates the step being
 * optional and has always meant position rather than proof -- see the comment
 * on `stageOrder` and the 2026-09-22 migration.
 */
export function recordPhoneStepComplete(
  /**
   * Where they are now, so this can never move somebody backwards.
   *
   * `patch` upserts whatever it is handed, and both entry points are reachable
   * from the account area by a member who finished onboarding long ago -- so
   * writing unconditionally would demote `onboarding_completed` to
   * `phone_verified` and drop them back into the questions. The web's
   * `advanceStage` refuses the same thing by reading the row first; this takes
   * the stage it already has rather than paying for a round trip to learn it.
   */
  current: OnboardingStage,
): Promise<SaveResult> {
  if (stageAtLeast(current, "phone_verified")) return Promise.resolve({ ok: true });
  return patch({ onboarding_stage: "phone_verified" });
}

/**
 * Marks onboarding finished, once every question has an answer.
 *
 * The legal version goes with it, for the same reason and at the same point as
 * on the website. Agreement happened on the sign-in screen, under the form,
 * where the notice and both links are; this is the first moment afterwards at
 * which somebody has definitely gone on to make an account. Writing it here
 * rather than at the notice means the record covers people who joined, not
 * people who read the line and left.
 */
export function completeOnboarding(): Promise<SaveResult> {
  return patch({
    onboarding_stage: "onboarding_completed",
    legal_version_accepted: LEGAL_VERSION,
    legal_accepted_at: new Date().toISOString(),
  });
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
