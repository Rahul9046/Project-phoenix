"use client";

import { useState } from "react";

import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { ProviderIcon } from "@/features/auth/components/ProviderIcon";
import { SecondaryButton } from "@/shared/ui/SecondaryButton";
import { connecting, providerLabels } from "@/features/auth/content";
import { useAuth } from "@/features/auth/AuthSessionProvider";
import { describeAuthError } from "@/features/auth/describeAuthError";
import type { SocialProviderId } from "@/features/auth/types";

// Which providers to offer is decided by the server from Supabase's own
// settings — see lib/data/auth-settings.ts for why it cannot be hardcoded.

/**
 * Google, Apple and Facebook, in that order.
 *
 * `signInWithSocial` hands off to Supabase OAuth: the browser navigates away to
 * the provider and comes back through /auth/callback, which establishes the
 * session. `pending` therefore never clears on success — the page is already
 * leaving — and only resets when the hand-off itself fails.
 */
export function SocialLoginButtons({
  providers,
}: {
  providers: readonly SocialProviderId[];
}) {
  const { signInWithSocial } = useAuth();
  const [pending, setPending] = useState<SocialProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(provider: SocialProviderId) {
    if (pending) return;
    setPending(provider);
    setError(null);
    try {
      await signInWithSocial(provider);
      // On success the browser is already leaving for the provider. `pending`
      // stays set so nothing can be pressed during the hand-off; the session
      // is established afterwards by /auth/callback.
    } catch (cause) {
      setError(describeAuthError(cause));
      setPending(null);
    }
  }

  return (
    <div>
      <div className="grid gap-3">
        {providers.map((provider) => (
          <SecondaryButton
            key={provider}
            onClick={() => handle(provider)}
            loading={pending === provider}
            loadingLabel={connecting}
            // Pressing one provider should not let you start another.
            disabled={pending !== null && pending !== provider}
          >
            <ProviderIcon provider={provider} />
            {providerLabels[provider]}
          </SecondaryButton>
        ))}
      </div>

      {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}
    </div>
  );
}
