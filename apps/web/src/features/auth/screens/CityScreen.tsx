"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { saveCity } from "@/features/auth/actions";
import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { CitySelector, OTHER_CITY } from "@/features/auth/components/CitySelector";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { ProgressIndicator } from "@/features/auth/components/ProgressIndicator";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { cityStep } from "@/features/auth/content";
import { authRoutes, onboardingStepIndex } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import type { CityOption } from "@/shared/data/reference";
import type { OnboardingProfile } from "@/features/auth/types";

export function CityScreen({ cities }: { cities: CityOption[] }) {
  const { session, allowed } = useAuthGuard(authRoutes.city);
  if (!allowed) return <AuthLoading />;
  return <CityForm cities={cities} profile={session.profile} />;
}

function CityForm({
  cities,
  profile,
}: {
  cities: CityOption[];
  profile: OnboardingProfile;
}) {
  const router = useRouter();
  const fieldId = useId();

  // `profile.city` holds a city id, or the OTHER_CITY sentinel.
  const [city, setCity] = useState<string | null>(profile.city);
  const [otherCity, setOtherCity] = useState(profile.otherCity ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (!city) {
      setError(cityStep.error);
      return;
    }

    setError(null);
    setPending(true);

    // Somewhere unlisted is stored as free text against a null city_id, and is
    // never a reason to stop. Naming the city is optional too.
    const isOther = city === OTHER_CITY;
    const result = await saveCity({
      cityId: isOther ? null : city,
      otherCity: isOther ? otherCity.trim() || null : null,
    });

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
        <CitySelector
          id={fieldId}
          cities={cities}
          value={city}
          otherCity={otherCity}
          onChange={(value) => {
            setCity(value);
            if (error) setError(null);
          }}
          onOtherCityChange={setOtherCity}
          disabled={pending}
        />

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
