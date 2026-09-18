"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveLanguages } from "@/features/auth/actions";
import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import {
  LanguageSelector,
  PREFER_NOT_TO_SAY,
} from "@/features/auth/components/LanguageSelector";
import { ProgressIndicator } from "@/features/auth/components/ProgressIndicator";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";

import { authRoutes, onboardingStepIndex } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import type { LanguageOption } from "@/shared/data/reference";
import { useT } from "@/features/i18n/LocaleProvider";

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
  const t = useT();
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
      setError(t("onboarding.languages.error"));
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

    router.push(authRoutes.photo);
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
        title={t("onboarding.languages.title")}
        lede={t("onboarding.languages.lede")}
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
          {t("common.continue")}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
