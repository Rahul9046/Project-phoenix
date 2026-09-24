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
  /** Where an emailed sign-in link lands. See app/auth.tsx. */
  authReturn: "/auth",

  name: "/onboarding/name",
  birthday: "/onboarding/birthday",
  gender: "/onboarding/gender",
  seeking: "/onboarding/seeking",
  city: "/onboarding/city",
  relationship: "/onboarding/relationship",
  religion: "/onboarding/religion",
  languages: "/onboarding/languages",
  photo: "/onboarding/photo",
  /*
   * Kept, and reached by nothing, for the length of the private Android beta.
   *
   * The screens behind these two work and are left where they are: the app
   * cannot send an SMS while Eraya holds no DLT registration, and a question
   * asked in order to fail is worse than a question not asked. Restoring them
   * is a navigation, not a rebuild. The website is untouched and still verifies
   * through MSG91's widget.
   */
  phone: "/onboarding/phone",
  confirmPhone: "/onboarding/confirm-phone",
  welcome: "/onboarding/welcome",

  home: "/(tabs)/home",
  discover: "/(tabs)/discover",
  connections: "/(tabs)/connections",
  messages: "/(tabs)/messages",
  you: "/(tabs)/you",

  membership: "/you/membership",
  /** Where Razorpay checkout hands back. See app/payment.tsx. */
  paymentReturn: "/payment",
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
 * `loading` to clear instead, and the name step is the first thing this can
 * return.
 */
export function nextRouteFor(profile: ProfileSnapshot | null): Href {
  // Defensive only. A caller that reaches this has not waited for `loading`,
  // and the first onboarding step is a far better answer than a redirect back
  // to a screen that will bounce them here again.
  if (!profile) return routes.name;

  /*
   * The phone step used to come first, and is not asked at all in the private
   * Android beta.
   *
   * The app has no way to send an SMS: Eraya holds no DLT registration, so the
   * OTP API has no template of its own to send through. What stood here asked
   * whether the step was behind them -- `onboarding_stage` at `phone_verified`,
   * or a `phoneVerifiedAt` from before that stage write existed -- and sent
   * anybody else to the question. With nothing able to answer it, that was a
   * step whose only outcome was "Skip for now".
   *
   * Nothing is written in its place. `onboarding_completed` already sorts above
   * `phone_verified`, so a member who finishes here is past this point on both
   * clients without a stage being recorded on their behalf -- and recording one
   * would be this app claiming a question had been put to somebody when it had
   * not.
   *
   * None of this touches what "phone verified" means. That is `phoneVerified`,
   * which requires `phone_verified_via = 'msg91'`, is written only by an edge
   * function holding the service role, and is still shown wherever it was --
   * including for a member who verified on the website, which works today.
   */

  if (!profile.firstName) return routes.name;
  if (!profile.dateOfBirth) return routes.birthday;
  if (!profile.gender) return routes.gender;
  if (profile.seeking.length === 0) return routes.seeking;
  if (!profile.cityId && !profile.otherCity) return routes.city;
  if (!profile.relationshipStatus) return routes.relationship;

  /*
   * Religion, and only for somebody still being onboarded.
   *
   * The stage check is not belt and braces. Every account that existed before
   * this question was added has `religion` null and `onboarding_stage`
   * `onboarding_completed`, and without the second half of this condition all
   * of them would be pulled out of the product and back into the questions the
   * next time they opened the app. Null means "never asked", which is exactly
   * true of them, and the right thing to do about it is nothing.
   *
   * They can still set it whenever they like, from Edit profile.
   */
  if (
    !profile.religion &&
    profile.stage !== "onboarding_completed"
  ) {
    return routes.religion;
  }

  // Languages are answerable with "I would rather not say", so an empty list is
  // only unfinished if that flag has not been set.
  if (profile.languageIds.length === 0 && !profile.languagesUndisclosed) {
    return routes.languages;
  }

  /*
   * The photo step is deliberately absent from this function.
   *
   * Every other step is derived from what is missing, which works because each
   * one is required. A photograph is not: a profile without one is complete, so
   * "has no photo" can never mean "unfinished" -- deciding otherwise here would
   * be an onboarding nobody who declines a photo could ever leave.
   *
   * It is reached by the languages step navigating to it, once, and it hands
   * back here afterwards. Somebody who closes the app on that screen and returns
   * lands past it, which is the right outcome for an optional question that has
   * already been asked.
   */

  // Everything is answered. The stage catches up on the server; until it does,
  // the person still belongs in the app rather than back at the last question.
  if (profile.stage !== "onboarding_completed") return routes.welcome;

  return routes.home;
}

/** True once someone has answered everything and may use the product. */
export function isOnboarded(profile: ProfileSnapshot | null): boolean {
  return profile !== null && nextRouteFor(profile) === routes.home;
}
