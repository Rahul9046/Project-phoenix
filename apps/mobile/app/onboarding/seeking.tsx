import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { seekingOptions, type Gender } from "@/features/auth/types";
import { saveSeeking } from "@/features/onboarding/data";
import { Step } from "@/features/onboarding/Step";
import { space } from "@/theme/tokens";
import { SelectionCard } from "@/ui/Selection";
import { Text } from "@/ui/Text";

/**
 * Who someone hopes to meet.
 *
 * Discovery used to show everyone to everyone, which for a product whose purpose
 * is introducing two people was not a missing filter so much as a missing
 * question -- nobody had ever been asked.
 *
 * Several answers rather than one, because "women", "men", "either" and
 * occasionally "these two but not that one" are all real, and a single choice
 * forces the last two into a shape that does not fit. Choosing all three is how
 * "everyone" is said.
 *
 * It is applied in both directions. Someone appears in your introductions only
 * if they match what you are looking for and you match what they are -- a
 * one-sided rule would keep showing you to people who have already said they are
 * not looking for someone like you.
 *
 * "Prefer not to say" is not offered here, though it is a gender someone can be.
 * It is a real answer to "what are you" and a meaningless one to "who do you
 * want to meet". Members with that gender are matched by the permissive rule in
 * the database instead, so no one else's preference can make them invisible.
 */
export default function SeekingStep() {
  const { profile, refresh } = useSession();
  const [selected, setSelected] = useState<Gender[]>(profile?.seeking ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(value: Gender) {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value],
    );
    if (error) setError(null);
  }

  async function submit() {
    if (selected.length === 0) return;
    setPending(true);
    setError(null);

    const result = await saveSeeking(selected);

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    const next = await refresh();
    setPending(false);
    router.push(nextRouteFor(next));
  }

  const everyone = selected.length === seekingOptions.length;

  return (
    <Step
      step="seeking"
      title="Who would you like to meet?"
      lede="Choose as many as apply. You can change this later, and it works both ways — you only appear to people you would also like to meet."
      onContinue={() => void submit()}
      canContinue={selected.length > 0}
      pending={pending}
      error={error}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Who would you like to meet?"
        style={{ gap: space.md }}
      >
        {seekingOptions.map((option) => (
          <SelectionCard
            key={option.value}
            label={option.label}
            selected={selected.includes(option.value)}
            onPress={() => toggle(option.value)}
          />
        ))}
      </View>

      {everyone ? (
        <Text variant="caption" tone="subtle" style={{ marginTop: space.xl }}>
          You will be introduced to anyone who would also like to meet you.
        </Text>
      ) : null}
    </Step>
  );
}
