"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { saveCity } from "@/features/auth/actions";
import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { CitySearch } from "@/shared/ui/CitySearch";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { ProgressIndicator } from "@/features/auth/components/ProgressIndicator";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { cityStep } from "@/features/auth/content";
import { authRoutes, onboardingStepIndex } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import { getCityById, type CityResult } from "@/shared/data/cities";
import type { OnboardingProfile } from "@/features/auth/types";

export function CityScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.city);
  if (!allowed) return <AuthLoading />;
  return <CityForm profile={session.profile} />;
}

function CityForm({ profile }: { profile: OnboardingProfile }) {
  const router = useRouter();

  const [city, setCity] = useState<CityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // The profile stores a city id. Someone returning to change an answer should
  // see the city they already chose, not an empty box implying it was lost.
  useEffect(() => {
    const storedId = profile.city;
    if (!storedId) return;

    let cancelled = false;
    void getCityById(storedId).then((found) => {
      if (!cancelled && found) setCity(found);
    });

    return () => {
      cancelled = true;
    };
  }, [profile.city]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (!city) {
      setError(cityStep.error);
      return;
    }

    setError(null);
    setPending(true);

    // Always a real city id now. Registration is open across India, so there is
    // no "somewhere else" case left to record as free text.
    const result = await saveCity({ cityId: city.id, otherCity: null });

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    router.push(authRoutes.relationship);
  }

  return (
    <AuthLayout
      backHref={authRoutes.basics}
      progress={
        <ProgressIndicator currentIndex={onboardingStepIndex(authRoutes.city)} />
      }
    >
      <AuthHeader title={cityStep.title} lede={cityStep.lede} showLogo={false} />

      <form onSubmit={handleSubmit} noValidate className="mt-9">
        <CitySearch
          labels={cityStep}
          value={city}
          onChange={(next) => {
            setCity(next);
            if (error) setError(null);
          }}
          disabled={pending}
          autoFocus
        />

        {!city ? (
          <p className="mt-2.5 text-sm leading-relaxed text-ink-subtle">
            {cityStep.hint}
          </p>
        ) : null}

        {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

        <PrimaryButton
          type="submit"
          loading={pending}
          loadingLabel="Saving…"
          className="mt-8"
        >
          {cityStep.cta}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
