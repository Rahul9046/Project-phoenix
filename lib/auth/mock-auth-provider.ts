import {
  type AuthClient,
  type AuthUser,
  type SocialProviderId,
} from "@/lib/auth/types";

/**
 * A stand-in identity provider for the prototype.
 *
 * There is no backend, no OAuth client and no SMS gateway yet, so every call
 * here resolves successfully after a short, believable pause. Nothing leaves
 * the browser.
 *
 * ---------------------------------------------------------------------------
 * Replacing this with the real thing
 * ---------------------------------------------------------------------------
 * Write a new object satisfying `AuthClient` — redirecting to Google/Apple/
 * Facebook, calling your SMS provider, checking codes server-side — and pass it
 * to `<AuthSessionProvider client={...}>`. No screen or component imports this
 * file directly, so nothing else has to change.
 *
 * Deliberately permissive while mocked: any email, any phone number and any
 * six-digit code are accepted. Rejecting people because the database does not
 * exist yet would be testing the prototype, not the product.
 */

const NETWORK_PAUSE_MS = 750;
const CODE_SEND_PAUSE_MS = 900;
const CODE_VERIFY_PAUSE_MS = 850;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mock-${Date.now().toString(36)}`;
}

/** Plausible display names so the mocked social accounts feel real enough. */
const socialIdentities: Record<
  SocialProviderId,
  { displayName: string; email: string }
> = {
  google: { displayName: "Google member", email: "member@gmail.com" },
  apple: { displayName: "Apple member", email: "member@icloud.com" },
  facebook: { displayName: "Facebook member", email: "member@facebook.com" },
};

export const mockAuthClient: AuthClient = {
  async signInWithSocial(provider) {
    await pause(NETWORK_PAUSE_MS);
    const identity = socialIdentities[provider];
    const user: AuthUser = {
      id: createId(),
      provider,
      email: identity.email,
      displayName: identity.displayName,
      createdAt: new Date().toISOString(),
    };
    return user;
  },

  async signInWithEmail(email) {
    await pause(NETWORK_PAUSE_MS);
    // No account lookup: an unknown address is simply a new account.
    const user: AuthUser = {
      id: createId(),
      provider: "email",
      email: email.trim(),
      displayName: null,
      createdAt: new Date().toISOString(),
    };
    return user;
  },

  // The phone number and code are ignored on purpose — the parameters are
  // omitted rather than named-and-unused so the intent is unmistakable. The
  // `AuthClient` signature still applies to callers.
  async sendVerificationCode() {
    await pause(CODE_SEND_PAUSE_MS);
    // A real implementation sends an SMS here.
  },

  async verifyCode() {
    await pause(CODE_VERIFY_PAUSE_MS);
    // A real implementation checks the code server-side and may throw
    // `new AuthError("invalid_code", …)`. Any six-digit code passes for now.
  },
};
