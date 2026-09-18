import {
  stageAtLeast,
  type AuthSession,
  type AuthStage,
} from "@/features/auth/types";

/**
 * The order of the sign-up journey, and the rules that keep it from breaking
 * when someone uses the browser's back button or types a URL directly.
 */

export const authRoutes = {
  login: "/login",
  signup: "/signup",
  logout: "/logout",
  email: "/auth/email",
  phone: "/auth/phone",
  otp: "/auth/otp",
  basics: "/onboarding/basics",
  seeking: "/onboarding/seeking",
  city: "/onboarding/city",
  relationship: "/onboarding/relationship",
  languages: "/onboarding/languages",
  photo: "/onboarding/photo",
  complete: "/onboarding/complete",
} as const;

export type AuthRoute = (typeof authRoutes)[keyof typeof authRoutes];

/** The onboarding screens shown in the progress indicator. */
export const onboardingSteps = [
  { route: authRoutes.basics, label: "About you" },
  { route: authRoutes.seeking, label: "Who you'd like to meet" },
  { route: authRoutes.city, label: "City" },
  { route: authRoutes.relationship, label: "Chapter" },
  { route: authRoutes.languages, label: "Languages" },
  { route: authRoutes.photo, label: "Photo" },
] as const;

export function onboardingStepIndex(route: string): number {
  return onboardingSteps.findIndex((step) => step.route === route);
}

/** Whether each onboarding screen has the answers it collects. */
function hasBasics(session: AuthSession): boolean {
  return Boolean(session.profile.firstName);
}

/*
 * An empty list, not a null check. The column is an array, and an empty one is
 * indistinguishable to the matcher from never having been asked -- so a member
 * who somehow got past this screen without choosing has not answered it.
 */
function hasSeeking(session: AuthSession): boolean {
  return session.profile.seeking.length > 0;
}

function hasCity(session: AuthSession): boolean {
  return Boolean(session.profile.city);
}

function hasRelationship(session: AuthSession): boolean {
  return Boolean(session.profile.relationshipStatus);
}

/*
 * Declining to answer is an answer. An empty list on its own only means the
 * question has not been reached -- the flag is what separates the two, exactly
 * as it does in the app's own routing.
 */
function hasLanguages(session: AuthSession): boolean {
  return session.profile.languages.length > 0 || session.profile.languagesUndisclosed;
}

/**
 * Where someone should be sent if they land on `route` without having earned
 * it yet. `null` means the route is theirs to see.
 *
 * The rule is "send them to the earliest thing they still need", never to a
 * dead end — no screen in this flow can reject a person outright.
 */
export function resolveRedirect(
  session: AuthSession,
  route: string,
): AuthRoute | null {
  // Signing out is always allowed, whoever you are.
  if (route === authRoutes.logout) return null;

  const isAuthenticated = stageAtLeast(session.stage, "authenticated");
  const isPhoneVerified = stageAtLeast(session.stage, "phoneVerified");

  // The two entry screens. Someone already part-way through should resume
  // rather than start again.
  if (route === authRoutes.login || route === authRoutes.signup) {
    return isAuthenticated ? nextRoute(session) : null;
  }

  if (route === authRoutes.email) {
    return isAuthenticated ? nextRoute(session) : null;
  }

  if (route === authRoutes.phone) {
    if (!isAuthenticated) return authRoutes.login;
    // Already verified — going back here should move them forward instead.
    return isPhoneVerified ? nextRoute(session) : null;
  }

  if (route === authRoutes.otp) {
    if (!isAuthenticated) return authRoutes.login;
    if (isPhoneVerified) return nextRoute(session);
    // No number entered yet, so there is nothing to confirm.
    return session.phone ? null : authRoutes.phone;
  }

  // Everything below is onboarding and needs a verified phone.
  if (!isAuthenticated) return authRoutes.login;
  if (!isPhoneVerified) return authRoutes.phone;

  if (route === authRoutes.basics) return null;
  if (route === authRoutes.seeking) return hasBasics(session) ? null : authRoutes.basics;
  if (route === authRoutes.city) {
    if (!hasBasics(session)) return authRoutes.basics;
    return hasSeeking(session) ? null : authRoutes.seeking;
  }
  if (route === authRoutes.relationship) {
    if (!hasBasics(session)) return authRoutes.basics;
    if (!hasSeeking(session)) return authRoutes.seeking;
    return hasCity(session) ? null : authRoutes.city;
  }
  if (route === authRoutes.languages) {
    if (!hasBasics(session)) return authRoutes.basics;
    if (!hasSeeking(session)) return authRoutes.seeking;
    if (!hasCity(session)) return authRoutes.city;
    return hasRelationship(session) ? null : authRoutes.relationship;
  }
  /*
   * The photo step, and the screen after it.
   *
   * Both need every question answered and neither needs the stage to say so,
   * because the stage is written on arrival at `complete` -- gating `complete`
   * on `onboardingCompleted` would mean bouncing away from the screen that sets
   * it, forever.
   */
  if (route === authRoutes.photo || route === authRoutes.complete) {
    if (!hasBasics(session)) return authRoutes.basics;
    if (!hasSeeking(session)) return authRoutes.seeking;
    if (!hasCity(session)) return authRoutes.city;
    if (!hasRelationship(session)) return authRoutes.relationship;
    return hasLanguages(session) ? null : authRoutes.languages;
  }

  return null;
}

/** The next screen this person should see, given how far they have come. */
export function nextRoute(session: AuthSession): AuthRoute {
  if (!stageAtLeast(session.stage, "authenticated")) return authRoutes.login;
  if (!stageAtLeast(session.stage, "phoneVerified")) return authRoutes.phone;
  if (session.stage === "onboardingCompleted") return authRoutes.complete;
  if (!hasBasics(session)) return authRoutes.basics;
  if (!hasSeeking(session)) return authRoutes.seeking;
  if (!hasCity(session)) return authRoutes.city;
  if (!hasRelationship(session)) return authRoutes.relationship;
  if (!hasLanguages(session)) return authRoutes.languages;

  /*
   * The photo step is deliberately absent from here.
   *
   * Every other step is derived from what is missing, which works because each
   * one is required. A photograph is not: a profile without one is complete, so
   * "has no photo" can never mean "unfinished" -- deciding otherwise would be an
   * onboarding that nobody declining a photo could ever leave.
   *
   * It is reached by the languages step navigating to it, once, and it hands
   * back here afterwards. Somebody who closes the tab on that screen and returns
   * lands past it, which is the right outcome for an optional question that has
   * already been asked. The app routes it the same way.
   */
  return authRoutes.complete;
}

/** Used by the mocked provider callbacks to advance the stage sensibly. */
export function advanceStage(
  current: AuthStage,
  target: AuthStage,
): AuthStage {
  return stageAtLeast(current, target) ? current : target;
}
