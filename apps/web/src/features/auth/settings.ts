import "server-only";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import type { SocialProviderId } from "@/features/auth/types";

/**
 * Which social providers are actually configured in Supabase.
 *
 * This has to be asked, not assumed. `signInWithOAuth` does not fail when a
 * provider is disabled — it builds the URL and navigates the browser to
 * Supabase, which answers with a raw JSON error *as a page*. The person is
 * thrown out of Eraya onto a page they cannot read or act on, and no
 * client-side error handler ever runs, because the tab is already gone.
 *
 * So the only reliable guard is to not offer the button. Reading the real
 * setting means enabling Google in the dashboard makes the button appear with
 * no deploy.
 */

/**
 * The providers the *website* is willing to show.
 *
 * Apple is deliberately absent, and this is a compliance control rather than a
 * preference. One Supabase project serves the website, the Android app and
 * (soon) the iOS app, and `/auth/v1/settings` is per-project with no notion of
 * platform. Sign in with Apple has to be enabled there before the iOS app can
 * be submitted -- App Store Guideline 4.8 effectively requires it once Google
 * ships -- and on the day it is enabled, this list is the only thing standing
 * between that config push and an Apple button appearing on eraya.app, on a
 * flow nobody has tested in a browser.
 *
 * It was `["google", "apple", "facebook"]`, which would have done exactly that.
 *
 * Reinstating it is a one-word change, and the right time is after the web
 * redirect has actually been tested against the configured Apple provider --
 * not as a side effect of unblocking iOS. The mobile app applies the same
 * control per platform in `apps/mobile/src/features/auth/providers.ts`.
 */
const ALL: readonly SocialProviderId[] = ["google", "facebook"];

type AuthSettings = { external?: Record<string, boolean> };

export async function getEnabledSocialProviders(): Promise<SocialProviderId[]> {
  const { url, key } = getPublicSupabaseConfig();

  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      // Provider configuration changes rarely; re-check every few minutes
      // rather than on every render.
      next: { revalidate: 300 },
    });

    if (!response.ok) return [];

    const settings = (await response.json()) as AuthSettings;
    return ALL.filter((provider) => settings.external?.[provider] === true);
  } catch {
    // If the setting cannot be read, offer nothing rather than offering a
    // button that would eject someone from the site.
    return [];
  }
}
