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

/**
 * Taken from the database, for the same reason `Gender` is.
 *
 * Includes `prefer_not_to_say`, which is a choice a member makes rather than
 * the absence of one -- that is `null`, and it is what every account created
 * before this question existed still holds.
 */
export type Religion = Database["public"]["Enums"]["religion"];
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
  /**
   * What they said, including having said they would rather not.
   *
   * Null means the question has not been answered -- true of every account that
   * existed before it was asked, and what lets the routing tell "not yet" from
   * "declined". What another member may see is decided in SQL, not here.
   */
  religion: Religion | null;
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

/**
 * Religion, as the member states it.
 *
 * The order is the order on the screen, and `prefer_not_to_say` is last because
 * it is the way past the question rather than one of its answers -- though it
 * is stored exactly as the others are, and a member who chooses it has answered.
 *
 * Nothing infers a value from anywhere else: not a name, not a city, not a
 * language. There is no caste, community, sub-caste or denomination here and
 * none is coming -- that absence is what keeps this a profile question rather
 * than a biodata form.
 */
export const religionOptions: readonly {
  value: Religion;
  labelKey: TranslationKey;
}[] = [
  { value: "hindu", labelKey: "onboarding.religion.hindu" },
  { value: "muslim", labelKey: "onboarding.religion.muslim" },
  { value: "christian", labelKey: "onboarding.religion.christian" },
  { value: "sikh", labelKey: "onboarding.religion.sikh" },
  { value: "buddhist", labelKey: "onboarding.religion.buddhist" },
  { value: "jain", labelKey: "onboarding.religion.jain" },
  { value: "other", labelKey: "onboarding.religion.other" },
  { value: "prefer_not_to_say", labelKey: "onboarding.religion.preferNotToSay" },
];

/**
 * The ones a member can be filtered by.
 *
 * `prefer_not_to_say` is deliberately absent, for the same reason it is absent
 * from `seekingOptions`: a reasonable answer about yourself, an unusable one as
 * a preference. Offering it would turn a filter into a way of finding precisely
 * the members who asked not to be found this way -- and the database refuses it
 * independently, matching on the disclosed value only.
 */
export const religionFilterOptions = religionOptions.filter(
  (option) => option.value !== "prefer_not_to_say",
);

/** For showing a stored value back, the way `relationshipLabelKeys` does. */
export const religionLabelKeys: Record<Religion, TranslationKey> = {
  hindu: "onboarding.religion.hindu",
  muslim: "onboarding.religion.muslim",
  christian: "onboarding.religion.christian",
  sikh: "onboarding.religion.sikh",
  buddhist: "onboarding.religion.buddhist",
  jain: "onboarding.religion.jain",
  other: "onboarding.religion.other",
  prefer_not_to_say: "onboarding.religion.preferNotToSay",
};

export const relationshipLabelKeys: Record<RelationshipStatus, TranslationKey> =
  {
    divorced: "onboarding.relationship.divorced",
    separated: "onboarding.relationship.separated",
    widowed: "onboarding.relationship.widowed",
  };
