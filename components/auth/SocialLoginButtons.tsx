"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorMessage } from "@/components/auth/ErrorMessage";
import { ProviderIcon } from "@/components/auth/ProviderIcon";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { connecting, providerLabels } from "@/content/auth";
import { useAuth } from "@/lib/auth/AuthSessionProvider";
import { describeAuthError } from "@/lib/auth/describeAuthError";
import { nextRoute } from "@/lib/auth/flow";
import type { SocialProviderId } from "@/lib/auth/types";

const providers: readonly SocialProviderId[] = ["google", "apple", "facebook"];

/**
 * Google, Apple and Facebook, in that order.
 *
 * Nothing leaves the browser: `signInWithSocial` runs the mocked provider,
 * which pauses briefly and reports success. Swapping in real OAuth changes the
 * client, not this component.
 */
export function SocialLoginButtons() {
  const router = useRouter();
  const { signInWithSocial } = useAuth();
  const [pending, setPending] = useState<SocialProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(provider: SocialProviderId) {
    if (pending) return;
    setPending(provider);
    setError(null);
    try {
      const session = await signInWithSocial(provider);
      router.push(nextRoute(session));
    } catch (cause) {
      setError(describeAuthError(cause));
      setPending(null);
    }
    // On success `pending` stays set so the button cannot be pressed again
    // while the next screen loads.
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
