import type { Href } from "expo-router";

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
  seeking: "/onboarding/seeking",
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

/**
 * Typed against the router's own route union.
 *
 * `typedRoutes` is on, so expo-router generates a literal type of every route in
 * `app/`. Returning a bare `string` from here would compile and then fail at the
 * call site, so this is the type that keeps a typo in a path a build error
 * rather than a blank screen.
 */
export type AppRoute = Href;

/**
 * Where a signed-in person belongs.
 *
 * Only ever called with a profile. A null one used to fall through to the
 * sign-in route, which meant a signed-in person whose profile had not yet
 * arrived was redirected to sign-in, which redirected them here, which sent them
 * back -- an infinite loop that rendered as a blank screen. Callers now wait for
 * `loading` to clear instead, and the phone step is the first thing this can
 * return.
 */
export function nextRouteFor(profile: ProfileSnapshot | null): Href {
  // Defensive only. A caller that reaches this has not waited for `loading`,
  // and the first onboarding step is a far better answer than a redirect back
  // to a screen that will bounce them here again.
  if (!profile) return routes.phone;

  // Phone comes first because the stage machine gates on it, and because asking
  // for it later would mean interrupting someone who thought they had finished.
  if (!profile.phoneVerifiedAt) return routes.phone;

  if (!profile.firstName) return routes.name;
  if (!profile.dateOfBirth) return routes.birthday;
  if (!profile.gender) return routes.gender;
  if (profile.seeking.length === 0) return routes.seeking;
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
