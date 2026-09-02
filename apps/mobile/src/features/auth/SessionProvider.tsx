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
  /**
   * True until both the stored session and, if there is one, its profile have
   * resolved. Consumers must wait rather than decide: a signed-in person whose
   * profile has not arrived yet is not the same as a signed-out one, and
   * treating them alike is what produced an infinite redirect between the entry
   * screen and sign-in.
   */
  loading: boolean;
  session: Session | null;
  profile: ProfileSnapshot | null;
  /**
   * Set when the profile could not be read at all -- offline, a stalled
   * connection, a rejected query. Distinct from "no profile yet", which is a
   * normal state for a brand-new account and is represented by a snapshot at
   * the earliest stage.
   */
  error: string | null;
  /** Re-reads the profile row. Call after any onboarding write. */
  refresh: () => Promise<ProfileSnapshot | null>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

/** See the note in `loadProfile`: a stalled request is the failure to design for. */
const PROFILE_TIMEOUT_MS = 10_000;

const PROFILE_COLUMNS =
  "id, first_name, date_of_birth, gender, city_id, other_city, relationship_status, languages_undisclosed, phone_verified_at, onboarding_stage";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  // Separate from `loading`, which covers the very first read. This one goes
  // true again whenever a new sign-in triggers a fresh profile fetch.
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      /*
       * Bounded, and wrapped.
       *
       * Both matter, and the app hung without them. `loading` is true while a
       * session exists and a profile does not, which is correct -- routing on a
       * half-resolved state is what caused an infinite redirect earlier. But it
       * makes any failure here permanent: a rejected query left `profile` null
       * for ever, and a stalled socket never rejected at all, so the entry
       * screen showed the mark and nothing else until the app was killed.
       *
       * A phone on mobile data does not fail cleanly. It hangs. Ten seconds is
       * long enough for a slow connection and short enough that nobody sits
       * looking at a logo wondering whether it is broken.
       */
      let row: Awaited<ReturnType<typeof readProfile>>["data"] = null;
      let languageRows: { language_id: string }[] | null = null;

      function readProfile() {
        return supabase
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .eq("id", activeSession!.user.id)
          .abortSignal(AbortSignal.timeout(PROFILE_TIMEOUT_MS))
          .maybeSingle();
      }

      try {
        const [profileResult, languageResult] = await Promise.all([
          readProfile(),
          supabase
            .from("profile_languages")
            .select("language_id")
            .eq("profile_id", activeSession.user.id)
            .abortSignal(AbortSignal.timeout(PROFILE_TIMEOUT_MS)),
        ]);

        if (profileResult.error && profileResult.error.code !== "PGRST116") {
          throw new Error(profileResult.error.message);
        }
        row = profileResult.data;
        languageRows = languageResult.data;
      } catch (cause) {
        if (ticket !== requestId.current) return null;

        console.warn("[eraya] could not read the profile:", cause);
        setError(
          "We could not reach Eraya just now. Check your connection and try again.",
        );
        return null;
      }

      if (ticket !== requestId.current) return null;
      setError(null);

      if (!row) {
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

        setProfileLoading(true);
        void loadProfile(nextSession).finally(() => setProfileLoading(false));
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
    setError(null);
    // Clear locally first. If the network call fails the person must still end
    // up signed out on this device rather than stuck on a screen they cannot
    // leave; the refresh token is revoked on the server either way.
    setProfile(null);
    setSession(null);
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      // A session with no profile yet still counts as loading. This is the line
      // that stops a half-resolved state from being routed on.
      /*
       * A session with no profile yet still counts as loading -- that is what
       * stops a half-resolved state being routed on. But not once the read has
       * actually failed, or the screen waits for something that is not coming.
       */
      loading:
        error === null &&
        (loading || profileLoading || (session !== null && profile === null)),
      session,
      profile,
      error,
      refresh,
      signOut,
    }),
    [loading, profileLoading, error, session, profile, refresh, signOut],
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
