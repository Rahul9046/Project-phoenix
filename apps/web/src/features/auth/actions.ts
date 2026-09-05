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

/**
 * Says what actually went wrong, on the server.
 *
 * These actions returned a generic sentence and discarded the database error
 * entirely, which is fine for the member and useless for anyone trying to work
 * out why a save failed -- the message is identical whether the cause is an
 * invalid enum, a constraint, an expired session or a dropped connection.
 *
 * The member still sees the generic sentence. Postgres error text is written for
 * developers and can name columns and constraints, which is not something to put
 * in front of someone.
 */
/**
 * Turns a database rejection into something the member can act on.
 *
 * "Please try again in a moment" is the right sentence for a dropped connection
 * and precisely the wrong one for a violated constraint: the value is the
 * problem, so retrying is guaranteed to fail. Someone following that advice
 * retries forever and concludes the product is broken.
 *
 * Only constraints whose cause a member can actually fix are named. Everything
 * else stays generic, because Postgres error text is written for developers.
 */
function describeSaveFailure(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message ?? "";

  if (code === "23514" && message.includes("profiles_date_of_birth_adult")) {
    return "Eraya is for people aged 18 and over. Please check the year in your date of birth.";
  }

  if (code === "22P02") {
    return "One of those answers was not recognised. Please reselect it and try again.";
  }

  return GENERIC_FAILURE;
}

function logFailure(where: string, error: unknown) {
  const detail =
    error && typeof error === "object"
      ? {
          code: (error as { code?: string }).code,
          message: (error as { message?: string }).message,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint,
        }
      : { message: String(error) };

  console.error(`[eraya] ${where} failed:`, detail);
}

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

  if (error) {
    logFailure("profile action", error);
    return { ok: false, message: describeSaveFailure(error) };
  }

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

  if (error) {
    logFailure("profile action", error);
    return { ok: false, message: describeSaveFailure(error) };
  }

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

  if (error) {
    logFailure("saveRelationshipStatus", error);
    return { ok: false, message: describeSaveFailure(error) };
  }

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

  if (error) {
    logFailure("profile action", error);
    return { ok: false, message: describeSaveFailure(error) };
  }

  revalidatePath("/onboarding", "layout");
  return { ok: true };
}

/**
 * Moves the onboarding stage on, once the phone step is behind them.
 *
 * It no longer writes `phone_verified_at`, and could not if it tried: that
 * column is set by the verify edge function holding the service role, and a
 * trigger on `profiles` refuses it to every client. This used to write it
 * itself, which was honest while the column meant "number added" and became a
 * hole the moment it started meaning "somebody answered an SMS on this number".
 *
 * The stage is a different thing — a record of how far through the questions
 * somebody is, not a claim about them — so it stays here.
 */
export async function recordPhoneStepComplete(): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Please sign in again." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_stage: await advanceStage(userId, "phone_verified") })
    .eq("id", userId);

  if (error) {
    logFailure("recordPhoneStepComplete", error);
    return { ok: false, message: describeSaveFailure(error) };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
