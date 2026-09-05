"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { createClient } from "@/lib/supabase/client";
import {
  clearPendingPhone,
  getPendingPhone,
  getPendingPhoneServerSnapshot,
  pendingPhoneHydration,
  setPendingPhone,
  subscribePendingPhone,
} from "@/features/auth/pending-phone";
import { supabaseAuthClient } from "@/features/auth/supabase-auth-client";
import type {
  AuthClient,
  AuthSession,
  PhoneNumber,
  SocialProviderId,
} from "@/features/auth/types";

type AuthContextValue = {
  /**
   * Who this is, as the *server* understands it. Rendered from the Supabase
   * session and the profile row on every request, so the browser cannot claim
   * a stage it has not reached.
   */
  session: AuthSession;
  /** False only until the transient pending-phone store has been read. */
  ready: boolean;
  signInWithSocial: (provider: SocialProviderId) => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  sendVerificationCode: (phone: PhoneNumber) => Promise<void>;
  /** Re-sends to the number already awaiting verification. */
  resendVerificationCode: () => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthSessionProvider({
  children,
  serverSession,
  client = supabaseAuthClient,
}: {
  children: React.ReactNode;
  /** Loaded by the server layout via `loadAuthSession()`. */
  serverSession: AuthSession;
  /** Overridable so tests can drive the flow without a network. */
  client?: AuthClient;
}) {
  const router = useRouter();

  // The number being verified never reaches the database, so it is the one
  // piece of auth state the client still owns.
  const pendingPhone = useSyncExternalStore(
    subscribePendingPhone,
    getPendingPhone,
    getPendingPhoneServerSnapshot,
  );

  const ready = useSyncExternalStore(
    pendingPhoneHydration.subscribe,
    pendingPhoneHydration.getSnapshot,
    pendingPhoneHydration.getServerSnapshot,
  );

  // Signing in or out in another tab, or a token expiring, must not leave this
  // one rendering a stale identity. Re-rendering from the server is the only
  // safe response â€” the client cannot recompute the session itself.
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const session = useMemo<AuthSession>(
    () => ({ ...serverSession, phone: pendingPhone }),
    [serverSession, pendingPhone],
  );

  const signInWithSocial = useCallback(
    async (provider: SocialProviderId) => {
      // Navigates away on success; the callback route finishes the job.
      await client.signInWithSocial(provider);
    },
    [client],
  );

  const signInWithEmail = useCallback(
    async (email: string) => {
      await client.signInWithEmail(email);
    },
    [client],
  );

  const verifyEmailCode = useCallback(
    async (email: string, code: string) => {
      await client.verifyEmailCode(email, code);
      // The session cookie is set by the verification; the server components
      // above this one still hold the signed-out render.
      router.refresh();
    },
    [client, router],
  );

  const sendVerificationCode = useCallback(
    async (phone: PhoneNumber) => {
      await client.sendVerificationCode(phone);
      setPendingPhone(phone);
    },
    [client],
  );

  /*
   * No caller while phone verification is mocked -- the OTP screen dropped its
   * resend control rather than offer a button that sends nothing. Kept because
   * it is one half of the SMS seam described in
   * features/auth/phone-verification.ts, and deleting it would only mean
   * writing it again.
   */
  const resendVerificationCode = useCallback(async () => {
    const phone = getPendingPhone();
    if (!phone) return;
    await client.sendVerificationCode(phone);
  }, [client]);

  const verifyCode = useCallback(
    async (code: string) => {
      const phone = getPendingPhone();
      if (!phone) {
        throw new Error("No phone number is awaiting verification.");
      }
      await client.verifyCode(phone, code);
    },
    [client],
  );

  const signOut = useCallback(async () => {
    clearPendingPhone();
    await client.signOut();
    router.refresh();
  }, [client, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      ready,
      signInWithSocial,
      signInWithEmail,
      verifyEmailCode,
      sendVerificationCode,
      resendVerificationCode,
      verifyCode,
      signOut,
    }),
    [
      session,
      ready,
      signInWithSocial,
      signInWithEmail,
      verifyEmailCode,
      sendVerificationCode,
      resendVerificationCode,
      verifyCode,
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
