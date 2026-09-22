import type { TranslationKey } from "@eraya/i18n";

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
  /** Genders this member hopes to meet. Empty means the question is unanswered. */
  seeking: Gender[];
  cityId: string | null;
  otherCity: string | null;
  relationshipStatus: RelationshipStatus | null;
  languagesUndisclosed: boolean;
  languageIds: string[];
  phoneVerifiedAt: string | null;
  /**
   * Whether an SMS was genuinely answered on this member's number.
   *
   * Not `phoneVerifiedAt !== null`. That timestamp is set for every account the
   * pre-launch stand-in marked, and `phone_verified_via` is the only column
   * that separates those from a real message. A mark shown to another member
   * may be built on this and on nothing else.
   */
  phoneVerified: boolean;
  emailVerified: boolean;
  stage: OnboardingStage;
};

/**
 * The ordered stages, so "at least this far" is a comparison rather than a
 * switch.
 *
 * `phone_verified` is a position in the questions and not a claim about
 * anybody: it means the phone step is behind them, whether they verified or
 * declined. `phoneVerified` above is the claim. The two were the same thing
 * while the step was compulsory, and keeping them apart is what stops a skipped
 * step from being read later as a checked number.
 */
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

/**
 * The label another member would read, for each stored value.
 *
 * Keys rather than sentences. These tables are read by member cards, profiles
 * and conversations as well as by onboarding, so a string here is a word that
 * stays English on the screen of somebody who chose Tamil.
 */
export const genderLabelKeys: Record<Gender, TranslationKey> = {
  woman: "onboarding.gender.woman",
  man: "onboarding.gender.man",
  non_binary: "onboarding.gender.nonBinary",
  prefer_not_to_say: "onboarding.gender.preferNotToSay",
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
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
}[] = [
  {
    value: "divorced",
    labelKey: "onboarding.relationship.divorced",
    descriptionKey: "onboarding.relationship.divorcedBody",
  },
  {
    value: "separated",
    labelKey: "onboarding.relationship.separated",
    descriptionKey: "onboarding.relationship.separatedBody",
  },
  {
    value: "widowed",
    labelKey: "onboarding.relationship.widowed",
    descriptionKey: "onboarding.relationship.widowedBody",
  },
];

export const genderOptions: readonly {
  value: Gender;
  labelKey: TranslationKey;
}[] = [
  { value: "woman", labelKey: "onboarding.gender.woman" },
  { value: "man", labelKey: "onboarding.gender.man" },
  { value: "non_binary", labelKey: "onboarding.gender.nonBinary" },
  { value: "prefer_not_to_say", labelKey: "onboarding.gender.preferNotToSay" },
];

/**
 * Who someone is hoping to meet.
 *
 * `prefer_not_to_say` is absent on purpose. It is a real answer to "what are
 * you", and a meaningless one to "who do you want to meet" -- nobody is looking
 * for people who declined to say. Members with that gender are matched by the
 * permissive rule in `genders_are_compatible` instead, so they are never made
 * invisible by anyone else's preference.
 */
export const seekingOptions: readonly {
  value: Gender;
  labelKey: TranslationKey;
}[] = [
  { value: "woman", labelKey: "onboarding.seeking.women" },
  { value: "man", labelKey: "onboarding.seeking.men" },
  { value: "non_binary", labelKey: "onboarding.seeking.nonBinaryPeople" },
];

export const relationshipLabelKeys: Record<RelationshipStatus, TranslationKey> =
  {
    divorced: "onboarding.relationship.divorced",
    separated: "onboarding.relationship.separated",
    widowed: "onboarding.relationship.widowed",
  };
