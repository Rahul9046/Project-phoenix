/**
 * The shape of Eraya's account state.
 *
 * Nothing here is specific to the mocked implementation. When a real identity
 * provider and database arrive, these types stay and only
 * `mock-auth-provider.ts` is replaced.
 */

/** Identity providers Eraya offers. Instagram is deliberately not one. */
export type SocialProviderId = "google" | "apple" | "facebook";

export type AuthProviderId = SocialProviderId | "email";

/**
 * The five states the application needs to distinguish. They are ordered — a
 * later stage implies every earlier one has been reached.
 */
export type AuthStage =
  | "unauthenticated"
  | "authenticated"
  | "phoneVerified"
  | "onboardingStarted"
  | "onboardingCompleted";

export const AUTH_STAGE_ORDER: readonly AuthStage[] = [
  "unauthenticated",
  "authenticated",
  "phoneVerified",
  "onboardingStarted",
  "onboardingCompleted",
];

/** True when `stage` is at least `required`. */
export function stageAtLeast(stage: AuthStage, required: AuthStage): boolean {
  return (
    AUTH_STAGE_ORDER.indexOf(stage) >= AUTH_STAGE_ORDER.indexOf(required)
  );
}

/**
 * The life chapters Eraya is built around. "Single" is intentionally absent —
 * this is not a general-purpose dating product.
 */
export type RelationshipStatus = "divorced" | "separated" | "widowed";

export type AuthUser = {
  id: string;
  provider: AuthProviderId;
  email: string | null;
  displayName: string | null;
  createdAt: string;
};

export type PhoneNumber = {
  /** Dialling code including the plus, e.g. "+91". */
  countryCode: string;
  /** Digits only, no spaces. */
  nationalNumber: string;
};

export type OnboardingProfile = {
  firstName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  city: string | null;
  /** Free text, only set when `city` is the "Another city" option. */
  otherCity: string | null;
  relationshipStatus: RelationshipStatus | null;
  languages: string[];
};

/** Whether the person arrived through "log in" or "create an account". */
export type AuthIntent = "login" | "signup";

export type AuthSession = {
  stage: AuthStage;
  intent: AuthIntent;
  user: AuthUser | null;
  phone: PhoneNumber | null;
  profile: OnboardingProfile;
};

export const emptyProfile: OnboardingProfile = {
  firstName: null,
  dateOfBirth: null,
  gender: null,
  city: null,
  otherCity: null,
  relationshipStatus: null,
  languages: [],
};

export const anonymousSession: AuthSession = {
  stage: "unauthenticated",
  intent: "login",
  user: null,
  phone: null,
  profile: emptyProfile,
};

/**
 * Failures the UI knows how to render. The mock never raises these, but every
 * call site handles them so a real provider can start throwing them without a
 * single component changing.
 */
export type AuthErrorKind =
  | "network"
  | "invalid_code"
  | "rate_limited"
  | "generic";

export class AuthError extends Error {
  readonly kind: AuthErrorKind;

  constructor(kind: AuthErrorKind, message: string) {
    super(message);
    this.name = "AuthError";
    this.kind = kind;
  }
}

/**
 * The seam between Eraya's UI and whoever actually verifies identity.
 *
 * Swap the implementation in `lib/auth/AuthSessionProvider.tsx` for a real one
 * (OAuth redirects, an SMS gateway) and the screens keep working.
 */
export interface AuthClient {
  signInWithSocial(provider: SocialProviderId): Promise<AuthUser>;
  signInWithEmail(email: string): Promise<AuthUser>;
  sendVerificationCode(phone: PhoneNumber): Promise<void>;
  verifyCode(phone: PhoneNumber, code: string): Promise<void>;
}

export function formatPhone(phone: PhoneNumber): string {
  const digits = phone.nationalNumber;
  if (digits.length === 10) {
    return `${phone.countryCode} ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return `${phone.countryCode} ${digits}`;
}

/** Masks all but the last two digits, for the "we sent a code to…" line. */
export function maskPhone(phone: PhoneNumber): string {
  const digits = phone.nationalNumber;
  if (digits.length < 3) return formatPhone(phone);
  const visible = digits.slice(-2);
  const hidden = "•".repeat(Math.max(digits.length - 2, 0));
  const masked = `${hidden}${visible}`;
  if (masked.length === 10) {
    return `${phone.countryCode} ${masked.slice(0, 5)} ${masked.slice(5)}`;
  }
  return `${phone.countryCode} ${masked}`;
}
