import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { genderOptions, type Gender } from "@/features/auth/types";
import { saveGender } from "@/features/onboarding/data";
import { Step } from "@/features/onboarding/Step";
import { space } from "@/theme/tokens";
import { SelectionCard } from "@/ui/Selection";

/**
 * Gender.
 *
 * The options are the database enum, imported rather than retyped. The web app
 * shipped a bug where TypeScript said `"non-binary"` and Postgres said
 * `non_binary`, and a cast hid the mismatch until a real person hit it during
 * signup -- so the list is derived from the generated types and cannot drift.
 *
 * "Prefer not to say" is a real answer, stored as itself. It is not a way of
 * skipping the question and it is not a null.
 */
export default function GenderStep() {
  const { profile, refresh } = useSession();
  const [value, setValue] = useState<Gender | null>(profile?.gender ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value) return;
    setPending(true);
    setError(null);

    const result = await saveGender(value);

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
      step="gender"
      title="How do you describe yourself?"
      onContinue={() => void submit()}
      canContinue={value !== null}
      pending={pending}
      error={error}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="How do you describe yourself?"
        style={{ gap: space.md }}
      >
        {genderOptions.map((option) => (
          <SelectionCard
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => {
              setValue(option.value);
              if (error) setError(null);
            }}
          />
        ))}
      </View>
    </Step>
  );
}
