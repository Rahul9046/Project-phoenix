import type { ProfileSnapshot } from "@/features/auth/types";

/**
 * Where a person belongs right now.
 *
 * Every redirect in the app comes from this one function, computed from the
 * stored profile. Scattering "if no city, go to the city screen" through the
 * screens themselves is how you end up with two of them disagreeing and someone
 * bouncing between them -- which the web app hit, and which is much worse on a
 * phone where the loop is the whole screen.
 *
 * The order matches the onboarding sequence exactly, and each step asks only
 * whether the thing it collects is present.
 */

export const routes = {
  entry: "/",
  signIn: "/sign-in",
  checkEmail: "/check-email",

  name: "/onboarding/name",
  birthday: "/onboarding/birthday",
  gender: "/onboarding/gender",
  city: "/onboarding/city",
  relationship: "/onboarding/relationship",
  languages: "/onboarding/languages",
  phone: "/onboarding/phone",
  confirmPhone: "/onboarding/confirm-phone",
  welcome: "/onboarding/welcome",

  home: "/(tabs)/home",
  discover: "/(tabs)/discover",
  connections: "/(tabs)/connections",
  messages: "/(tabs)/messages",
  you: "/(tabs)/you",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];

export function nextRouteFor(profile: ProfileSnapshot | null): string {
  if (!profile) return routes.signIn;

  // Phone comes first because the stage machine gates on it, and because asking
  // for it later would mean interrupting someone who thought they had finished.
  if (!profile.phoneVerifiedAt) return routes.phone;

  if (!profile.firstName) return routes.name;
  if (!profile.dateOfBirth) return routes.birthday;
  if (!profile.gender) return routes.gender;
  if (!profile.cityId && !profile.otherCity) return routes.city;
  if (!profile.relationshipStatus) return routes.relationship;

  // Languages are answerable with "I would rather not say", so an empty list is
  // only unfinished if that flag has not been set.
  if (profile.languageIds.length === 0 && !profile.languagesUndisclosed) {
    return routes.languages;
  }

  // Everything is answered. The stage catches up on the server; until it does,
  // the person still belongs in the app rather than back at the last question.
  if (profile.stage !== "onboarding_completed") return routes.welcome;

  return routes.home;
}

/** True once someone has answered everything and may use the product. */
export function isOnboarded(profile: ProfileSnapshot | null): boolean {
  return profile !== null && nextRouteFor(profile) === routes.home;
}
