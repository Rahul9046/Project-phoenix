import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";
import type { OnboardingStage, ProfileSnapshot } from "@/features/auth/types";

/**
 * Who is signed in, and how far through onboarding they are.
 *
 * One provider at the root, one subscription to `onAuthStateChange`, one profile
 * fetch per sign-in. Every screen reads from here rather than asking Supabase
 * itself, which is what stops a tab switch from firing four identical profile
 * queries.
 *
 * The profile is refetched rather than patched after a write. Onboarding writes
 * a column and the database decides the resulting stage -- a trigger may move it
 * -- so trusting a locally-computed stage is how someone ends up stuck on a
 * screen they have already completed.
 */

type SessionState = {
  /** Null while the stored session is still being read from the keystore. */
  loading: boolean;
  session: Session | null;
  profile: ProfileSnapshot | null;
  /** Re-reads the profile row. Call after any onboarding write. */
  refresh: () => Promise<ProfileSnapshot | null>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

const PROFILE_COLUMNS =
  "id, first_name, date_of_birth, gender, city_id, other_city, relationship_status, languages_undisclosed, phone_verified_at, onboarding_stage";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);

  // Guards against a slow fetch for a signed-out user landing after a newer one
  // for a signed-in user, which would show the previous person's profile.
  const requestId = useRef(0);

  const loadProfile = useCallback(
    async (activeSession: Session | null): Promise<ProfileSnapshot | null> => {
      const ticket = ++requestId.current;

      if (!activeSession?.user) {
        if (ticket === requestId.current) setProfile(null);
        return null;
      }

      const [{ data: row, error }, { data: languageRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .eq("id", activeSession.user.id)
          .maybeSingle(),
        supabase
          .from("profile_languages")
          .select("language_id")
          .eq("profile_id", activeSession.user.id),
      ]);

      if (ticket !== requestId.current) return null;

      if (error || !row) {
        /*
         * A signed-in user with no profile row is possible for a moment: the
         * row is created by a trigger on `auth.users`, and a first sign-in can
         * outrun it. Treat it as the earliest stage rather than as an error --
         * the person lands on the first onboarding screen, which is where they
         * belong anyway.
         */
        const fallback: ProfileSnapshot = {
          id: activeSession.user.id,
          email: activeSession.user.email ?? null,
          firstName: null,
          dateOfBirth: null,
          gender: null,
          cityId: null,
          otherCity: null,
          relationshipStatus: null,
          languagesUndisclosed: false,
          languageIds: [],
          phoneVerifiedAt: null,
          emailVerified: Boolean(activeSession.user.email_confirmed_at),
          stage: "authenticated",
        };
        setProfile(fallback);
        return fallback;
      }

      const snapshot: ProfileSnapshot = {
        id: row.id,
        email: activeSession.user.email ?? null,
        firstName: row.first_name,
        dateOfBirth: row.date_of_birth,
        gender: row.gender,
        cityId: row.city_id,
        otherCity: row.other_city,
        relationshipStatus: row.relationship_status,
        languagesUndisclosed: row.languages_undisclosed,
        languageIds: (languageRows ?? []).map((l) => l.language_id),
        phoneVerifiedAt: row.phone_verified_at,
        emailVerified: Boolean(activeSession.user.email_confirmed_at),
        stage: row.onboarding_stage as OnboardingStage,
      };

      setProfile(snapshot);
      return snapshot;
    },
    [],
  );

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!active) return;
        setSession(nextSession);

        /*
         * TOKEN_REFRESHED fires on a timer and changes nothing about who is
         * signed in. Refetching the profile on it would put a network request
         * on a clock for no reason.
         */
        if (event === "TOKEN_REFRESHED") return;

        void loadProfile(nextSession);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    return loadProfile(data.session);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    // Clear locally first. If the network call fails the person must still end
    // up signed out on this device rather than stuck on a screen they cannot
    // leave; the refresh token is revoked on the server either way.
    setProfile(null);
    setSession(null);
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<SessionState>(
    () => ({ loading, session, profile, refresh, signOut }),
    [loading, session, profile, refresh, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return value;
}
