import {
  stageAtLeast,
  type AuthSession,
  type AuthStage,
} from "@/lib/auth/types";

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
  city: "/onboarding/city",
  relationship: "/onboarding/relationship",
  languages: "/onboarding/languages",
  complete: "/onboarding/complete",
} as const;

export type AuthRoute = (typeof authRoutes)[keyof typeof authRoutes];

/** The four onboarding screens shown in the progress indicator. */
export const onboardingSteps = [
  { route: authRoutes.basics, label: "About you" },
  { route: authRoutes.city, label: "City" },
  { route: authRoutes.relationship, label: "Chapter" },
  { route: authRoutes.languages, label: "Languages" },
] as const;

export function onboardingStepIndex(route: string): number {
  return onboardingSteps.findIndex((step) => step.route === route);
}

/** Whether each onboarding screen has the answers it collects. */
function hasBasics(session: AuthSession): boolean {
  return Boolean(session.profile.firstName);
}

function hasCity(session: AuthSession): boolean {
  return Boolean(session.profile.city);
}

function hasRelationship(session: AuthSession): boolean {
  return Boolean(session.profile.relationshipStatus);
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
  if (route === authRoutes.city) return hasBasics(session) ? null : authRoutes.basics;
  if (route === authRoutes.relationship) {
    if (!hasBasics(session)) return authRoutes.basics;
    return hasCity(session) ? null : authRoutes.city;
  }
  if (route === authRoutes.languages) {
    if (!hasBasics(session)) return authRoutes.basics;
    if (!hasCity(session)) return authRoutes.city;
    return hasRelationship(session) ? null : authRoutes.relationship;
  }
  if (route === authRoutes.complete) {
    return session.stage === "onboardingCompleted" ? null : nextRoute(session);
  }

  return null;
}

/** The next screen this person should see, given how far they have come. */
export function nextRoute(session: AuthSession): AuthRoute {
  if (!stageAtLeast(session.stage, "authenticated")) return authRoutes.login;
  if (!stageAtLeast(session.stage, "phoneVerified")) return authRoutes.phone;
  if (session.stage === "onboardingCompleted") return authRoutes.complete;
  if (!hasBasics(session)) return authRoutes.basics;
  if (!hasCity(session)) return authRoutes.city;
  if (!hasRelationship(session)) return authRoutes.relationship;
  return authRoutes.languages;
}

/** Used by the mocked provider callbacks to advance the stage sensibly. */
export function advanceStage(
  current: AuthStage,
  target: AuthStage,
): AuthStage {
  return stageAtLeast(current, target) ? current : target;
}
