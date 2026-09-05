import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor } from "@/features/auth/routing";
import {
  relationshipOptions,
  type RelationshipStatus,
} from "@/features/auth/types";
import { saveRelationship } from "@/features/onboarding/data";
import { Step } from "@/features/onboarding/Step";
import { space } from "@/theme/tokens";
import { SelectionCard } from "@/ui/Selection";
import { Text } from "@/ui/Text";

/**
 * The chapter someone is in.
 *
 * Three options, and there will never be a fourth. "Single" does not appear
 * here, is not in the database enum, and adding it would turn Eraya into a
 * general dating app -- which is the one thing the product cannot become. The
 * whole proposition is that everyone here has been through something similar.
 *
 * The wording is plain. "My marriage has legally ended" is a harder sentence to
 * read than a euphemism, and it is the right one: people in this position have
 * usually had enough of other people being delicate about it.
 */
export default function RelationshipStep() {
  const { profile, refresh } = useSession();
  const [value, setValue] = useState<RelationshipStatus | null>(
    profile?.relationshipStatus ?? null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value) return;
    setPending(true);
    setError(null);

    const result = await saveRelationship(value);

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
      step="relationship"
      title="Where are you in your story?"
      lede="Everyone on Eraya has been through one of these. It is shown on your profile."
      onContinue={() => void submit()}
      canContinue={value !== null}
      pending={pending}
      error={error}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Where are you in your story?"
        style={{ gap: space.md }}
      >
        {relationshipOptions.map((option) => (
          <SelectionCard
            key={option.value}
            label={option.label}
            description={option.description}
            selected={value === option.value}
            onPress={() => {
              setValue(option.value);
              if (error) setError(null);
            }}
          />
        ))}
      </View>

      <Text variant="caption" tone="subtle" style={{ marginTop: space.xl }}>
        Eraya does not check this. It is taken on trust, the same way you are
        trusting everyone else here.
      </Text>
    </Step>
  );
}
