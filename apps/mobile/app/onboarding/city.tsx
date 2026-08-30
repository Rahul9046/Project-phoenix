import { useState } from "react";
import { router } from "expo-router";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { CityPicker } from "@/features/onboarding/CityPicker";
import { saveCity } from "@/features/onboarding/data";
import { Step } from "@/features/onboarding/Step";

/**
 * Where you live.
 *
 * Anyone in India can join from anywhere. This decides who you are likely to
 * meet nearby -- nothing more -- and discovery applies no city filter of its
 * own, so nobody is hidden for living somewhere quiet.
 */
export default function CityStep() {
  const { profile, refresh } = useSession();

  const [selected, setSelected] = useState<
    { id: string; label: string } | { name: string } | null
  >(profile?.otherCity ? { name: profile.otherCity } : null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!selected) return;
    setPending(true);
    setError(null);

    const result = await saveCity(
      "id" in selected ? { id: selected.id } : { name: selected.name },
    );

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    const next = await refresh();
    setPending(false);
    router.push(nextRouteFor(next));
  }

  return (
    <Step
      step="city"
      title="Where do you live?"
      lede="Every city and town in India is here. It shapes who you are likely to meet nearby, never whether you can join."
      onContinue={() => void submit()}
      canContinue={selected !== null}
      pending={pending}
      error={error}
    >
      <CityPicker
        selected={selected}
        onSelect={(city) => {
          setSelected(city);
          if (error) setError(null);
        }}
      />
    </Step>
  );
}
