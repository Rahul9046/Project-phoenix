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

const ALL: readonly SocialProviderId[] = ["google", "apple", "facebook"];

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
