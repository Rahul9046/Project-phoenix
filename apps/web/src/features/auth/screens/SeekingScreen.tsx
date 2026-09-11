"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { ProgressIndicator } from "@/features/auth/components/ProgressIndicator";
import { SelectableOption } from "@/features/auth/components/SelectableOption";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { saveSeeking } from "@/features/auth/actions";
import { seekingOptions, seekingStep } from "@/features/auth/content";
import { authRoutes, onboardingStepIndex } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import type { Gender } from "@/features/auth/types";

/**
 * Who you would like to meet.
 *
 * The app asked this from the beginning and the website did not, so a profile
 * created in a browser was stored with no preference. The matching function
 * reads that as "no constraint", which meant those members were shown to
 * everyone, were never filtered by their own answer, and — because the app
 * checks the field rather than the onboarding stage — were sent back here the
 * first time they opened Eraya on a phone.
 *
 * Checkboxes rather than radios: wanting to meet women and non-binary people is
 * one answer, not a contradiction.
 */
export function SeekingScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.seeking);
  if (!allowed) return <AuthLoading />;
  return <SeekingForm stored={session.profile.seeking} />;
}

function SeekingForm({ stored }: { stored: Gender[] }) {
  const router = useRouter();

  const [chosen, setChosen] = useState<Gender[]>(stored);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggle(value: Gender) {
    setChosen((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
    if (error) setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (chosen.length === 0) {
      setError(seekingStep.error);
      return;
    }

    setError(null);
    setPending(true);

    const result = await saveSeeking(chosen);
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    router.push(authRoutes.city);
  }

  return (
    <AuthLayout
      backHref={authRoutes.basics}
      progress={
        <ProgressIndicator
          currentIndex={onboardingStepIndex(authRoutes.seeking)}
        />
      }
    >
      <AuthHeader
        title={seekingStep.title}
        lede={seekingStep.lede}
        showLogo={false}
      />

      <form onSubmit={handleSubmit} noValidate className="mt-9">
        <div className="grid gap-2.5" role="group" aria-label={seekingStep.title}>
          {seekingOptions.map((option) => (
            <SelectableOption
              key={option.value}
              type="checkbox"
              name="seeking"
              value={option.value}
              label={option.label}
              checked={chosen.includes(option.value)}
              onChange={(value) => toggle(value as Gender)}
            />
          ))}
        </div>

        {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

        <PrimaryButton
          type="submit"
          loading={pending}
          loadingLabel="Saving…"
          className="mt-8"
        >
          {seekingStep.cta}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
