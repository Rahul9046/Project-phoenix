"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { ErrorMessage } from "@/components/auth/ErrorMessage";
import { ProgressIndicator } from "@/components/auth/ProgressIndicator";
import { SelectableOption } from "@/components/auth/SelectableOption";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { relationshipOptions, relationshipStep } from "@/content/auth";
import { useAuth } from "@/lib/auth/AuthSessionProvider";
import { authRoutes, onboardingStepIndex } from "@/lib/auth/flow";
import { useAuthGuard } from "@/lib/auth/useAuthGuard";
import type { RelationshipStatus } from "@/lib/auth/types";

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
  const router = useRouter();
  const { updateProfile } = useAuth();

  const [status, setStatus] = useState<RelationshipStatus | null>(stored);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!status) {
      setError(relationshipStep.error);
      return;
    }

    setError(null);
    updateProfile({ relationshipStatus: status });
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
        title={relationshipStep.title}
        lede={relationshipStep.lede}
        showLogo={false}
      />

      <form onSubmit={handleSubmit} noValidate className="mt-9">
        <div
          className="grid gap-2.5"
          role="radiogroup"
          aria-label={relationshipStep.title}
        >
          {relationshipOptions.map((option) => (
            <SelectableOption
              key={option.value}
              type="radio"
              name="relationship"
              value={option.value}
              label={option.label}
              description={option.description}
              checked={status === option.value}
              onChange={(value) => {
                setStatus(value as RelationshipStatus);
                if (error) setError(null);
              }}
            />
          ))}
        </div>

        {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

        <PrimaryButton type="submit" className="mt-8">
          {relationshipStep.cta}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
