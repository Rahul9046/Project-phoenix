import type { TranslationKey } from "@eraya/i18n";

import type { Gender, RelationshipStatus } from "@/features/auth/types";

/**
 * What the auth flow needs that is not a translated sentence.
 *
 * The screens' words used to live here. They now live in `@eraya/i18n`, in six
 * languages, and the screens read them with `t()` -- so what is left is the
 * things a translation cannot be: the database's own enum values, the routes the
 * legal links point at, and the error text keyed on what a provider reports.
 *
 * The option tables carry a `labelKey` rather than a label, so the value stored
 * in Postgres and the words shown for it stay separate. That separation is the
 * point: the value is `non_binary` in every language.
 */

/**
 * The values here are the database's enum values, not display slugs.
 *
 * They used to be hyphenated ("non-binary") because this screen was written
 * against a mocked provider that accepted any string. When the real enum arrived
 * it used underscores, and nothing reconciled the two -- so choosing Non-binary
 * or Prefer not to say failed for a fortnight while Woman and Man worked.
 *
 * The `Gender` annotation is the guard: this list can no longer drift from the
 * database without failing the build.
 */
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
 * Who you would like to meet.
 *
 * The mobile app has always asked this and the website never did, so every
 * profile created in a browser was stored with no preference at all. That is
 * not the neutral outcome it looks like: the matching function reads an unset
 * preference as "no constraint", so those members were shown to everyone and
 * their own answer -- which they were never asked for -- was never applied.
 *
 * `prefer_not_to_say` is deliberately absent, exactly as on mobile. It is a
 * reasonable answer to "what is your gender" and an unusable one to "who would
 * you like to meet", because there is nothing to match on.
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
 * What to say when someone arrives back at sign-in after something failed.
 *
 * Keyed on what the provider or Supabase actually reports. These are the
 * outcomes people hit in practice — cancelling a consent screen is the second
 * most common thing that happens after succeeding at it — and returning someone
 * to a blank login page with no explanation is how a working product looks
 * broken.
 */
export const signInProblems: Record<string, string> = {
  access_denied:
    "Sign-in was cancelled, so nothing happened. You can try again, or continue with email.",
  server_error:
    "That sign-in provider had a problem on its end. Please try again, or continue with email.",
  temporarily_unavailable:
    "That sign-in provider is briefly unavailable. Please try again in a moment, or continue with email.",
  invalid_link:
    "That sign-in link is not valid any more. Links work once and expire after an hour — request a new one below.",
  missing_code:
    "The sign-in did not complete. Please try again, or continue with email.",
  provider_not_enabled:
    "That sign-in option is not available yet. Please continue with email.",
} as const;

/** Anything not in the list above. Deliberately vague; it is genuinely unknown. */
export const signInProblemFallback =
  "That sign-in did not complete. Please try again, or continue with email.";

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

export const languageOptions = [
  "English",
  "Hindi",
  "Bengali",
  "Telugu",
  "Tamil",
  "Marathi",
  "Malayalam",
  "Kannada",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Mizo",
  "Odia",
  "Assamese",
] as const;

export const legal = {
  prefix: "By continuing you agree to our",
  terms: { label: "Terms of Service", href: "/terms" },
  and: "and",
  privacy: { label: "Privacy Policy", href: "/privacy" },
} as const;

export const authErrors = {
  network:
    "We couldn't reach Eraya just now. Check your connection and try again.",
  generic: "Something went wrong on our side. Please try again.",
  // Deliberately vague about the wait: the limit is enforced per hour, and
  // promising "a moment" would send someone back to press the button again.
  rate_limited:
    "We've sent a few links to this address already. Please check your inbox, including spam — a new link can only be sent a little later.",
  /*
   * The same sentence as `auth.otp.invalidError` in the translations, written
   * out rather than imported from them. These strings are the one part of the
   * flow still English-only: they are keyed on what Supabase reports, and
   * turning a provider's code into a translated sentence is an error-taxonomy
   * change rather than a copy change. When that happens this whole table goes.
   */
  invalid_code: "That needs to be six digits. Check and try again.",
  // Says what to do next instead of describing our configuration to someone
  // who cannot act on it.
  provider_unavailable:
    "That sign-in option isn't available yet. Please continue with email — it takes a moment.",
} as const;

