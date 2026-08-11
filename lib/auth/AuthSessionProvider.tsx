"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import { advanceStage } from "@/lib/auth/flow";
import { mockAuthClient } from "@/lib/auth/mock-auth-provider";
import {
  getServerSnapshot,
  getSnapshot,
  hydration,
  resetStoredSession,
  setStoredSession,
  subscribe,
} from "@/lib/auth/session-store";
import { anonymousSession } from "@/lib/auth/types";
import type {
  AuthClient,
  AuthIntent,
  AuthSession,
  AuthUser,
  OnboardingProfile,
  PhoneNumber,
  SocialProviderId,
} from "@/lib/auth/types";

/**
 * Decides what survives a sign-in.
 *
 * Signing in as the *same* person resumes where they left off. Signing in as
 * anyone else starts clean — their phone number, profile and progress are
 * theirs, and must never be inherited by the next identity to use this browser.
 *
 * Without a database the only durable handle on "who" is the provider and the
 * address; the mocked user id is regenerated on every call, so it cannot be
 * compared. A real provider gives a stable id and this becomes an id check.
 */
function sessionForIdentity(
  current: AuthSession,
  user: AuthUser,
): AuthSession {
  const previous = current.user;
  const samePerson =
    previous !== null &&
    previous.provider === user.provider &&
    (previous.email ?? "").trim().toLowerCase() ===
      (user.email ?? "").trim().toLowerCase();

  if (samePerson) {
    return {
      ...current,
      user,
      stage: advanceStage(current.stage, "authenticated"),
    };
  }

  // A different person. Keep only how they arrived at the door.
  return {
    ...anonymousSession,
    intent: current.intent,
    user,
    stage: "authenticated",
  };
}

type AuthContextValue = {
  session: AuthSession;
  /**
   * False until the stored session is known. Screens wait for this so they
   * never act on the signed-out placeholder rendered on the server.
   */
  ready: boolean;
  setIntent: (intent: AuthIntent) => void;
  /**
   * The mutating actions resolve with the session as it is *after* the change,
   * so a caller can decide where to navigate without waiting for a re-render.
   */
  signInWithSocial: (provider: SocialProviderId) => Promise<AuthSession>;
  signInWithEmail: (email: string) => Promise<AuthSession>;
  sendVerificationCode: (phone: PhoneNumber) => Promise<AuthSession>;
  resendVerificationCode: () => Promise<void>;
  verifyCode: (code: string) => Promise<AuthSession>;
  updateProfile: (patch: Partial<OnboardingProfile>) => AuthSession;
  completeOnboarding: () => AuthSession;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthSessionProvider({
  children,
  client = mockAuthClient,
}: {
  children: React.ReactNode;
  /** Swap in a real `AuthClient` here when one exists. */
  client?: AuthClient;
}) {
  const session = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const ready = useSyncExternalStore(
    hydration.subscribe,
    hydration.getSnapshot,
    hydration.getServerSnapshot,
  );

  // Actions read the store directly rather than closing over `session`, so two
  // updates in the same tick cannot overwrite one another.
  const setIntent = useCallback((intent: AuthIntent) => {
    setStoredSession({ ...getSnapshot(), intent });
  }, []);

  const signInWithSocial = useCallback(
    async (provider: SocialProviderId) => {
      const user = await client.signInWithSocial(provider);
      return setStoredSession(sessionForIdentity(getSnapshot(), user));
    },
    [client],
  );

  const signInWithEmail = useCallback(
    async (email: string) => {
      const user = await client.signInWithEmail(email);
      return setStoredSession(sessionForIdentity(getSnapshot(), user));
    },
    [client],
  );

  const sendVerificationCode = useCallback(
    async (phone: PhoneNumber) => {
      await client.sendVerificationCode(phone);
      return setStoredSession({ ...getSnapshot(), phone });
    },
    [client],
  );

  const resendVerificationCode = useCallback(async () => {
    const phone = getSnapshot().phone;
    if (!phone) return;
    await client.sendVerificationCode(phone);
  }, [client]);

  const verifyCode = useCallback(
    async (code: string) => {
      const current = getSnapshot();
      if (!current.phone) return current;
      await client.verifyCode(current.phone, code);
      const latest = getSnapshot();
      return setStoredSession({
        ...latest,
        stage: advanceStage(latest.stage, "phoneVerified"),
      });
    },
    [client],
  );

  const updateProfile = useCallback((patch: Partial<OnboardingProfile>) => {
    const current = getSnapshot();
    return setStoredSession({
      ...current,
      stage: advanceStage(current.stage, "onboardingStarted"),
      profile: { ...current.profile, ...patch },
    });
  }, []);

  const completeOnboarding = useCallback(
    () => setStoredSession({ ...getSnapshot(), stage: "onboardingCompleted" }),
    [],
  );

  const signOut = useCallback(() => {
    resetStoredSession();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      ready,
      setIntent,
      signInWithSocial,
      signInWithEmail,
      sendVerificationCode,
      resendVerificationCode,
      verifyCode,
      updateProfile,
      completeOnboarding,
      signOut,
    }),
    [
      session,
      ready,
      setIntent,
      signInWithSocial,
      signInWithEmail,
      sendVerificationCode,
      resendVerificationCode,
      verifyCode,
      updateProfile,
      completeOnboarding,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside <AuthSessionProvider>");
  }
  return value;
}
