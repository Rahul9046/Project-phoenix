"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { CitySelector, OTHER_CITY } from "@/components/auth/CitySelector";
import { ErrorMessage } from "@/components/auth/ErrorMessage";
import { ProgressIndicator } from "@/components/auth/ProgressIndicator";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { cityStep } from "@/content/auth";
import { useAuth } from "@/lib/auth/AuthSessionProvider";
import { authRoutes, onboardingStepIndex } from "@/lib/auth/flow";
import { useAuthGuard } from "@/lib/auth/useAuthGuard";
import type { OnboardingProfile } from "@/lib/auth/types";

export function CityScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.city);
  if (!allowed) return <AuthLoading />;
  return <CityForm profile={session.profile} />;
}

function CityForm({ profile }: { profile: OnboardingProfile }) {
  const router = useRouter();
  const { updateProfile } = useAuth();
  const fieldId = useId();

  const [city, setCity] = useState<string | null>(profile.city);
  const [otherCity, setOtherCity] = useState(profile.otherCity ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!city) {
      setError(cityStep.error);
      return;
    }

    setError(null);
    // "Another city" never blocks anyone — naming the city is optional, and an
    // empty one still continues.
    updateProfile({
      city,
      otherCity: city === OTHER_CITY ? otherCity.trim() || null : null,
    });
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
        <CitySelector
          id={fieldId}
          value={city}
          otherCity={otherCity}
          onChange={(value) => {
            setCity(value);
            if (error) setError(null);
          }}
          onOtherCityChange={setOtherCity}
        />

        {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

        <PrimaryButton type="submit" className="mt-8">
          {cityStep.cta}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
