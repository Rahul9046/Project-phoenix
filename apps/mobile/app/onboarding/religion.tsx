import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { useSession } from "@/features/auth/SessionProvider";
import { useT } from "@/features/i18n/LocaleProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { religionOptions, type Religion } from "@/features/auth/types";
import { saveReligion } from "@/features/onboarding/data";
import { Step } from "@/features/onboarding/Step";
import { space } from "@/theme/tokens";
import { SelectionCard } from "@/ui/Selection";
import { Text } from "@/ui/Text";

/**
 * Religion.
 *
 * Asked because for a great many of Eraya's members it is part of who they are
 * and part of who they would find it easy to be with. Asked carefully, because
 * in this country it is also the answer people have most often been sorted by
 * against their will.
 *
 * Three things follow from that, and all three are visible on this screen.
 *
 * Nothing is preselected. A default here would be a suggestion about somebody's
 * identity, and the member would have to notice it in order to disagree with it.
 * The Continue button stays disabled until they choose, exactly as on the other
 * single-answer steps.
 *
 * "Prefer not to say" is an answer and sits in the list with the rest, not as a
 * skip link underneath it. Somebody who does not want to say has answered the
 * question, and the screen should not make that feel like leaving early.
 *
 * And the note under the options says the part people actually worry about:
 * this can be changed or withdrawn later, and Eraya does not guess. There is no
 * caste, community, sub-caste or denomination question here and there will not
 * be one -- that absence is the difference between this screen and a biodata
 * form.
 */
export default function ReligionStep() {
  const { profile, refresh } = useSession();
  const t = useT();

  // Seeded from what they already chose, which is null for anybody reaching
  // this for the first time. Never from a name, a city or a language.
  const [value, setValue] = useState<Religion | null>(profile?.religion ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value) return;
    setPending(true);
    setError(null);

    const result = await saveReligion(value);

    if (!result.ok) {
      setError(t(result.messageKey));
      setPending(false);
      return;
    }

    const next = await refresh();
    setPending(false);
    router.push(nextRouteFor(next));
  }

  return (
    <Step
      step="religion"
      title={t("onboarding.religion.title")}
      lede={t("onboarding.religion.lede")}
      onContinue={() => void submit()}
      canContinue={value !== null}
      pending={pending}
      error={error}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t("onboarding.religion.title")}
        style={{ gap: space.md }}
      >
        {religionOptions.map((option) => (
          <SelectionCard
            key={option.value}
            label={t(option.labelKey)}
            selected={value === option.value}
            onPress={() => {
              setValue(option.value);
              if (error) setError(null);
            }}
          />
        ))}
      </View>

      <Text variant="caption" tone="subtle" style={{ marginTop: space.xl }}>
        {t("onboarding.religion.privacyNote")}
      </Text>
    </Step>
  );
}
