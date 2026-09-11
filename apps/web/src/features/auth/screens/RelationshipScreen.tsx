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
import { saveRelationshipStatus } from "@/features/auth/actions";
import { relationshipOptions } from "@/features/auth/content";
import { authRoutes, onboardingStepIndex } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import type { RelationshipStatus } from "@/features/auth/types";
import { useT } from "@/features/i18n/LocaleProvider";

export function RelationshipScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.relationship);
  if (!allowed) return <AuthLoading />;
  return <RelationshipForm stored={session.profile.relationshipStatus} />;
}

function RelationshipForm({
  stored,
}: {
  stored: RelationshipStatus | null;
}) {
  const t = useT();
  const router = useRouter();

  const [status, setStatus] = useState<RelationshipStatus | null>(stored);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (!status) {
      setError(t("onboarding.relationship.error"));
      return;
    }

    setError(null);
    setPending(true);

    const result = await saveRelationshipStatus(status);
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    router.push(authRoutes.languages);
  }

  return (
    <AuthLayout
      backHref={authRoutes.city}
      progress={
        <ProgressIndicator
          currentIndex={onboardingStepIndex(authRoutes.relationship)}
        />
      }
    >
      <AuthHeader
        title={t("onboarding.relationship.title")}
        lede={t("onboarding.relationship.lede")}
        showLogo={false}
      />

      <form onSubmit={handleSubmit} noValidate className="mt-9">
        <div
          className="grid gap-2.5"
          role="radiogroup"
          aria-label={t("onboarding.relationship.title")}
        >
          {relationshipOptions.map((option) => (
            <SelectableOption
              key={option.value}
              type="radio"
              name="relationship"
              value={option.value}
              label={t(option.labelKey)}
              description={t(option.descriptionKey)}
              checked={status === option.value}
              onChange={(value) => {
                setStatus(value as RelationshipStatus);
                if (error) setError(null);
              }}
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
          {t("common.continue")}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
