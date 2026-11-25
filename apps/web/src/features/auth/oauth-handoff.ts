import type { SocialProviderId } from "@/features/auth/types";

/**
 * Remembering which provider a round trip belongs to.
 *
 * `/auth/callback` is where every OAuth provider returns, and what arrives
 * there says nothing about where it came from: a `code` is a `code`, and a
 * refusal is `?error=access_denied` whoever refused. Without this the callback
 * can only record "an OAuth sign-in failed", and the enum in `auth_events` has
 * no such name -- outcomes are per provider, because "is Facebook broken" is
 * the question anybody actually asks.
 *
 * A cookie rather than a query parameter on `redirectTo`. The address handed to
 * Supabase has to match `additional_redirect_urls` in `supabase/config.toml`,
 * and a redirect that fails that match comes back as an error instead of a
 * session -- the single most common reason a working OAuth setup appears
 * broken. Appending `?provider=facebook` to a listed URL is exactly the kind of
 * near-miss that is unreviewable from here, with no staging to find out on. A
 * cookie never touches the allowlist.
 *
 * Deliberately not `httpOnly`: it is written by browser code at handoff. There
 * is nothing to protect -- the value is the name of a button the person just
 * pressed, which the provider's own URL announces anyway.
 *
 * `SameSite=Lax` is the load-bearing attribute. The return from Facebook is a
 * top-level cross-site navigation, which `Lax` permits and `Strict` would
 * silently drop, leaving every outcome unattributed.
 */
export const OAUTH_HANDOFF_COOKIE = "eraya_oauth_handoff";

/**
 * Long enough to read a consent screen, find a password, pass a 2FA prompt.
 * Short enough that a cookie left behind by an abandoned attempt cannot
 * mislabel a sign-in started half an hour later.
 */
const HANDOFF_COOKIE_MAX_AGE_SECONDS = 15 * 60;

/** Browser-side. Called immediately before the page leaves for the provider. */
export function rememberOAuthHandoff(provider: SocialProviderId): void {
  try {
    document.cookie = [
      `${OAUTH_HANDOFF_COOKIE}=${provider}`,
      "Path=/",
      `Max-Age=${HANDOFF_COOKIE_MAX_AGE_SECONDS}`,
      "SameSite=Lax",
      // The site is HTTPS everywhere except a developer's own machine, where
      // `Secure` would stop the cookie being stored at all.
      ...(location.protocol === "https:" ? ["Secure"] : []),
    ].join("; ");
  } catch {
    // Storage can be denied outright. Losing the attribution on one sign-in is
    // not a reason to stop the sign-in.
  }
}

const SOCIAL_PROVIDER_IDS: readonly SocialProviderId[] = [
  "google",
  "apple",
  "facebook",
];

/**
 * Reads the cookie back.
 *
 * Narrow rather than cast: the value arrives from a request and a cookie is
 * whatever the sender put in it. Anything unrecognised becomes `null`, so the
 * worst a forged cookie achieves is an unattributed outcome.
 */
export function readOAuthHandoff(value: string | undefined): SocialProviderId | null {
  if (!value) return null;
  return (
    SOCIAL_PROVIDER_IDS.find((provider) => provider === value) ?? null
  );
}
