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
import { saveReligion } from "@/features/auth/actions";
import { religionOptions } from "@/features/auth/content";
import { authRoutes, onboardingStepIndex } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import type { Religion } from "@/features/auth/types";
import { useT } from "@/features/i18n/LocaleProvider";

/**
 * Religion.
 *
 * Asked because for a great many of Eraya's members it is part of who they are
 * and part of who they would find it easy to be with. Asked carefully, because
 * in this country it is also the answer people have most often been sorted by
 * against their will.
 *
 * Three things follow, and all three are on the screen.
 *
 * Nothing is preselected. A default here would be a suggestion about somebody's
 * identity that they would have to notice in order to disagree with, so the
 * form refuses to continue until they have actually chosen -- exactly as the
 * other single-answer steps do.
 *
 * "Prefer not to say" sits in the list with the rest rather than as a skip link
 * underneath it. Somebody who does not want to say has answered the question,
 * and the screen should not make that feel like leaving early.
 *
 * And the note underneath says the part people actually worry about: it can be
 * changed or withdrawn later, and Eraya does not guess. There is no caste,
 * community, sub-caste or denomination question here and there will not be one.
 * That absence is the difference between this screen and a biodata form.
 */
export function ReligionScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.religion);
  if (!allowed) return <AuthLoading />;
  return <ReligionForm stored={session.profile.religion} />;
}

function ReligionForm({ stored }: { stored: Religion | null }) {
  const t = useT();
  const router = useRouter();

  // Seeded from what they already chose, which is null for anybody reaching
  // this for the first time. Never from a name, a city or a language.
  const [religion, setReligion] = useState<Religion | null>(stored);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (!religion) {
      setError(t("onboarding.religion.error"));
      return;
    }

    setError(null);
    setPending(true);

    const result = await saveReligion(religion);
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    router.push(authRoutes.languages);
  }

  return (
    <AuthLayout
      backHref={authRoutes.relationship}
      progress={
        <ProgressIndicator
          currentIndex={onboardingStepIndex(authRoutes.religion)}
        />
      }
    >
      <AuthHeader
        title={t("onboarding.religion.title")}
        lede={t("onboarding.religion.lede")}
        showLogo={false}
      />

      <form onSubmit={handleSubmit} noValidate className="mt-9">
        <div
          className="grid gap-2.5"
          role="radiogroup"
          aria-label={t("onboarding.religion.title")}
        >
          {religionOptions.map((option) => (
            <SelectableOption
              key={option.value}
              type="radio"
              name="religion"
              value={option.value}
              label={t(option.labelKey)}
              checked={religion === option.value}
              onChange={(value) => {
                setReligion(value as Religion);
                if (error) setError(null);
              }}
            />
          ))}
        </div>

        {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

        <PrimaryButton
          type="submit"
          loading={pending}
          loadingLabel={t("common.saving")}
          className="mt-8"
        >
          {t("common.continue")}
        </PrimaryButton>

        <p className="mt-6 text-[0.9rem] leading-relaxed text-ink-subtle">
          {t("onboarding.religion.privacyNote")}
        </p>
      </form>
    </AuthLayout>
  );
}
