import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  anonymousSession,
  emptyProfile,
  stageFromDatabase,
  type AuthProviderId,
  type AuthSession,
  type AuthUser,
} from "@/lib/auth/types";

/**
 * Reads the signed-in member's session and profile on the server.
 *
 * This is the source of truth. The browser no longer decides who it is â€” it
 * receives this from the server on every render, so a tampered client store
 * cannot manufacture a stage it has not reached.
 */

function providerOf(raw: string | undefined): AuthProviderId {
  switch (raw) {
    case "google":
    case "apple":
    case "facebook":
      return raw;
    default:
      // Supabase reports magic-link sign-in as "email".
      return "email";
  }
}

export async function loadAuthSession(
  // The route handlers that establish a session pass their own client. Reusing
  // it matters: they have just written the auth cookies, and a client built
  // before those writes land would read the request as still signed out.
  client?: Awaited<ReturnType<typeof createClient>>,
): Promise<AuthSession> {
  const supabase = client ?? (await createClient());

  // `getUser` validates the token with Supabase rather than trusting the
  // cookie, which matters because everything below keys off it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return anonymousSession;

  const authUser: AuthUser = {
    id: user.id,
    provider: providerOf(user.app_metadata?.provider),
    email: user.email ?? null,
    displayName:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    createdAt: user.created_at,
  };

  const [{ data: profile }, { data: languageRows }] = await Promise.all([
    supabase
      .from("profiles")
      // One string literal, deliberately: Supabase infers the row type from
      // the select at compile time, and a concatenated expression defeats it.
      .select(
        "first_name, date_of_birth, gender, city_id, other_city, relationship_status, languages_undisclosed, onboarding_stage, phone_verified_at",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_languages")
      .select("languages(name)")
      .eq("profile_id", user.id),
  ]);

  // The signup trigger creates the profile, so this is only reachable if that
  // trigger has not been applied. Treat them as freshly authenticated rather
  // than signed out â€” they are, and onboarding will create what it needs.
  if (!profile) {
    return {
      stage: "authenticated",
      user: authUser,
      phone: null,
      profile: emptyProfile,
    };
  }

  const languages = (languageRows ?? [])
    .map((row) => {
      // The embedded relation is an object for a to-one join; be tolerant of
      // either shape rather than trusting one.
      const related = row.languages as unknown;
      if (Array.isArray(related)) {
        return (related[0] as { name?: string } | undefined)?.name ?? null;
      }
      return (related as { name?: string } | null)?.name ?? null;
    })
    .filter((name): name is string => Boolean(name));

  return {
    stage: stageFromDatabase(profile.onboarding_stage),
    user: authUser,
    // The number being verified is transient client state, not a stored
    // column â€” see lib/auth/pending-phone.ts.
    phone: null,
    profile: {
      firstName: profile.first_name,
      dateOfBirth: profile.date_of_birth,
      gender: profile.gender,
      // `city` carries the city id, or the OTHER_CITY sentinel when the person
      // named somewhere unlisted.
      city: profile.city_id ?? (profile.other_city ? "other" : null),
      otherCity: profile.other_city,
      relationshipStatus: profile.relationship_status,
      languages: profile.languages_undisclosed ? [] : languages,
    },
  };
}
