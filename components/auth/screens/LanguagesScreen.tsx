"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { ErrorMessage } from "@/components/auth/ErrorMessage";
import { LanguageSelector } from "@/components/auth/LanguageSelector";
import { ProgressIndicator } from "@/components/auth/ProgressIndicator";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { languagesStep } from "@/content/auth";
import { useAuth } from "@/lib/auth/AuthSessionProvider";
import { authRoutes, onboardingStepIndex } from "@/lib/auth/flow";
import { useAuthGuard } from "@/lib/auth/useAuthGuard";

export function LanguagesScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.languages);
  if (!allowed) return <AuthLoading />;
  return <LanguagesForm stored={session.profile.languages} />;
}

function LanguagesForm({ stored }: { stored: string[] }) {
  const router = useRouter();
  const { updateProfile, completeOnboarding } = useAuth();

  const [languages, setLanguages] = useState<string[]>(stored);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (languages.length === 0) {
      setError(languagesStep.error);
      return;
    }

    setError(null);
    updateProfile({ languages });
    // Last question in this phase — signup is done. Building out the rest of
    // the profile is the next piece of work.
    completeOnboarding();
    router.push(authRoutes.complete);
  }

  return (
    <AuthLayout
      backHref={authRoutes.relationship}
      progress={
        <ProgressIndicator
          currentIndex={onboardingStepIndex(authRoutes.languages)}
        />
      }
    >
      <AuthHeader
        title={languagesStep.title}
        lede={languagesStep.lede}
        showLogo={false}
      />

      <form onSubmit={handleSubmit} noValidate className="mt-9">
        <LanguageSelector
          selected={languages}
          onChange={(next) => {
            setLanguages(next);
            if (error) setError(null);
          }}
        />

        {error ? <ErrorMessage className="mt-5">{error}</ErrorMessage> : null}

        <PrimaryButton type="submit" className="mt-8">
          {languagesStep.cta}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
