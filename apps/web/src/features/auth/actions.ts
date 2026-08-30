"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { stageToDatabase } from "@/features/auth/types";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Writing onboarding answers.
 *
 * Server actions rather than client-side inserts, so the browser never decides
 * which row it is writing — the id comes from the verified session. Row Level
 * Security enforces the same rule underneath; this is belt and braces on the
 * part that is easy to get wrong.
 */

export type ActionResult = { ok: true } | { ok: false; message: string };

const GENERIC_FAILURE =
  "We couldn't save that just now. Please try again in a moment.";

type Gender = Database["public"]["Enums"]["gender"];
type RelationshipStatus = Database["public"]["Enums"]["relationship_status"];

/** The signed-in member's id, or null. Never trust one from the client. */
async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * The onboarding stage only ever moves forward. Someone revisiting an earlier
 * screen to change an answer must not be demoted to that step.
 */
const STAGE_RANK = {
  authenticated: 0,
  phone_verified: 1,
  onboarding_started: 2,
  onboarding_completed: 3,
} as const;

type StageValue = keyof typeof STAGE_RANK;

async function advanceStage(
  userId: string,
  target: StageValue,
): Promise<StageValue> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_stage")
    .eq("id", userId)
    .maybeSingle();

  const current = (data?.onboarding_stage ?? "authenticated") as StageValue;
  return STAGE_RANK[current] >= STAGE_RANK[target] ? current : target;
}

export async function saveBasics(input: {
  firstName: string;
  dateOfBirth: string;
  gender: Gender;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Please sign in again." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: input.firstName.trim(),
      date_of_birth: input.dateOfBirth,
      // No cast. `input.gender` is typed as Gender by the caller, so a value the
      // enum does not accept is now a build error rather than a runtime 22P02.
      gender: input.gender,
      onboarding_stage: await advanceStage(userId, "onboarding_started"),
    })
    .eq("id", userId);

  if (error) return { ok: false, message: GENERIC_FAILURE };

  revalidatePath("/onboarding", "layout");
  return { ok: true };
}

/**
 * Records where someone lives.
 *
 * A city outside the launch list is stored as free text and is never a reason
 * to stop: `city_id` is simply null and `other_city` carries the name. Naming
 * it is optional too.
 */
export async function saveCity(input: {
  cityId: string | null;
  otherCity: string | null;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Please sign in again." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      city_id: input.cityId,
      other_city: input.cityId ? null : (input.otherCity?.trim() || null),
      onboarding_stage: await advanceStage(userId, "onboarding_started"),
    })
    .eq("id", userId);

  if (error) return { ok: false, message: GENERIC_FAILURE };

  revalidatePath("/onboarding", "layout");
  return { ok: true };
}

export async function saveRelationshipStatus(
  status: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Please sign in again." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      relationship_status: status as RelationshipStatus,
      onboarding_stage: await advanceStage(userId, "onboarding_started"),
    })
    .eq("id", userId);

  if (error) return { ok: false, message: GENERIC_FAILURE };

  revalidatePath("/onboarding", "layout");
  return { ok: true };
}

/**
 * Replaces the member's languages, and finishes onboarding.
 *
 * `undisclosed` is stored as a flag rather than a language row, so declining to
 * answer can never be mistaken for speaking something.
 */
export async function saveLanguages(input: {
  languageIds: string[];
  undisclosed: boolean;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Please sign in again." };

  const supabase = await createClient();

  // Replace rather than merge: the screen presents the full set every time, so
  // an unchecked language means removed.
  const { error: clearError } = await supabase
    .from("profile_languages")
    .delete()
    .eq("profile_id", userId);

  if (clearError) return { ok: false, message: GENERIC_FAILURE };

  if (!input.undisclosed && input.languageIds.length > 0) {
    const { error: insertError } = await supabase
      .from("profile_languages")
      .insert(
        input.languageIds.map((languageId) => ({
          profile_id: userId,
          language_id: languageId,
        })),
      );

    if (insertError) return { ok: false, message: GENERIC_FAILURE };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      languages_undisclosed: input.undisclosed,
      onboarding_stage: stageToDatabase("onboardingCompleted"),
    })
    .eq("id", userId);

  if (error) return { ok: false, message: GENERIC_FAILURE };

  revalidatePath("/onboarding", "layout");
  return { ok: true };
}

/**
 * Marks the phone as verified.
 *
 * Temporary. Once Supabase phone auth is live it sets
 * `auth.users.phone_confirmed_at` and the `on_auth_user_phone_confirmed`
 * trigger mirrors it here — at which point this action is deleted rather than
 * rewritten. See lib/auth/phone-verification.ts.
 */
export async function markPhoneVerified(): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Please sign in again." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      phone_verified_at: new Date().toISOString(),
      onboarding_stage: await advanceStage(userId, "phone_verified"),
    })
    .eq("id", userId);

  if (error) return { ok: false, message: GENERIC_FAILURE };

  revalidatePath("/", "layout");
  return { ok: true };
}
