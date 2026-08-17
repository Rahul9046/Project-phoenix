"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveLanguages } from "@/app/actions/profile";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { ErrorMessage } from "@/components/auth/ErrorMessage";
import {
  LanguageSelector,
  PREFER_NOT_TO_SAY,
} from "@/components/auth/LanguageSelector";
import { ProgressIndicator } from "@/components/auth/ProgressIndicator";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { languagesStep } from "@/content/auth";
import { authRoutes, onboardingStepIndex } from "@/lib/auth/flow";
import { useAuthGuard } from "@/lib/auth/useAuthGuard";
import type { LanguageOption } from "@/lib/data/reference";

export function LanguagesScreen({
  languages,
}: {
  languages: LanguageOption[];
}) {
  const { session, allowed } = useAuthGuard(authRoutes.languages);
  if (!allowed) return <AuthLoading />;
  return (
    <LanguagesForm languages={languages} stored={session.profile.languages} />
  );
}

function LanguagesForm({
  languages,
  stored,
}: {
  languages: LanguageOption[];
  /** Language *names* already on the profile. */
  stored: string[];
}) {
  const router = useRouter();

  // The selector works in names; the database works in ids. Names are what the
  // person sees, so they stay the selection key and are mapped on submit.
  const [selected, setSelected] = useState<string[]>(stored);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (selected.length === 0) {
      setError(languagesStep.error);
      return;
    }

    setError(null);
    setPending(true);

    const undisclosed = selected.includes(PREFER_NOT_TO_SAY);
    const languageIds = undisclosed
      ? []
      : languages
          .filter((language) => selected.includes(language.name))
          .map((language) => language.id);

    // Declining is a flag on the profile, never a language row — see the
    // languages migration.
    const result = await saveLanguages({ languageIds, undisclosed });

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

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
          languages={languages}
          selected={selected}
          onChange={(next) => {
            setSelected(next);
            if (error) setError(null);
          }}
        />

        {error ? <ErrorMessage className="mt-5">{error}</ErrorMessage> : null}

        <PrimaryButton
          type="submit"
          loading={pending}
          loadingLabel="Saving…"
          className="mt-8"
        >
          {languagesStep.cta}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
