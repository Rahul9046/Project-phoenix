import type { Database } from "@/lib/supabase/database.types";

/**
 * The shapes the auth flow works in.
 *
 * Enums come from the generated database types rather than being restated. A
 * hand-written union drifts from the database silently -- the web app shipped a
 * bug for exactly that reason, where `"non-binary"` was written in TypeScript
 * and `non_binary` existed in Postgres, and a cast hid the mismatch until a real
 * person hit it during signup.
 */

export type Gender = Database["public"]["Enums"]["gender"];
export type RelationshipStatus =
  Database["public"]["Enums"]["relationship_status"];
export type OnboardingStage =
  Database["public"]["Enums"]["onboarding_stage"];

/**
 * What the app knows about the signed-in person.
 *
 * `stage` is read from the profile row, never from local state. It is the single
 * thing that decides which screen someone belongs on, and keeping it server-side
 * means closing the app halfway through onboarding and reopening it on another
 * device resumes in the right place.
 */
export type ProfileSnapshot = {
  id: string;
  email: string | null;
  firstName: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  cityId: string | null;
  otherCity: string | null;
  relationshipStatus: RelationshipStatus | null;
  languagesUndisclosed: boolean;
  languageIds: string[];
  phoneVerifiedAt: string | null;
  emailVerified: boolean;
  stage: OnboardingStage;
};

/** The ordered stages, so "at least this far" is a comparison rather than a switch. */
export const stageOrder: readonly OnboardingStage[] = [
  "authenticated",
  "phone_verified",
  "onboarding_started",
  "onboarding_completed",
] as const;

export function stageAtLeast(
  stage: OnboardingStage,
  target: OnboardingStage,
): boolean {
  return stageOrder.indexOf(stage) >= stageOrder.indexOf(target);
}

/** The label another member would read, for each stored value. */
export const genderLabels: Record<Gender, string> = {
  woman: "Woman",
  man: "Man",
  non_binary: "Non-binary",
  prefer_not_to_say: "Prefer not to say",
};

/**
 * The three chapters Eraya is for.
 *
 * There is no "single", here or in the database. Eraya is for one particular
 * point in a life, and adding a fourth option turns it into a general dating
 * app -- which is the one thing the product must not become.
 */
export const relationshipOptions: readonly {
  value: RelationshipStatus;
  label: string;
  description: string;
}[] = [
  {
    value: "divorced",
    label: "Divorced",
    description: "My marriage has legally ended.",
  },
  {
    value: "separated",
    label: "Separated",
    description: "I am living apart from my spouse.",
  },
  {
    value: "widowed",
    label: "Widowed",
    description: "I lost my spouse.",
  },
];

export const genderOptions: readonly { value: Gender; label: string }[] = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const relationshipLabels: Record<RelationshipStatus, string> = {
  divorced: "Divorced",
  separated: "Separated",
  widowed: "Widowed",
};
