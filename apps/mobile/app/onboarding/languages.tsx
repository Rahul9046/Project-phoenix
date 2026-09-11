import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { useSession } from "@/features/auth/SessionProvider";
import { useT } from "@/features/i18n/LocaleProvider";
import { routes } from "@/features/auth/routing";
import {
  listLanguages,
  saveLanguages,
  type LanguageOption,
} from "@/features/onboarding/data";
import { Step } from "@/features/onboarding/Step";
import { space } from "@/theme/tokens";
import { TextButton } from "@/ui/Button";
import { Chip, ChipGroup } from "@/ui/Selection";
import { LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";

/**
 * Languages.
 *
 * The last question, and the only one that takes several answers -- so chips
 * rather than full-width rows. There are enough languages that a list of rows
 * would be a scroll marathon for a question that most people answer in two taps.
 *
 * "I would rather not say" is stored as a flag of its own rather than as an
 * empty list. The difference matters: an empty list is indistinguishable from an
 * unfinished screen, and someone who declined to answer would be sent back here
 * every time they opened the app.
 */
export default function LanguagesStep() {
  const { profile, refresh } = useSession();
  const t = useT();

  const [options, setOptions] = useState<LanguageOption[] | null>(null);
  const [selected, setSelected] = useState<string[]>(profile?.languageIds ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listLanguages().then((list) => {
      if (active) setOptions(list);
    });
    return () => {
      active = false;
    };
  }, []);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
    if (error) setError(null);
  }

  async function submit(undisclosed: boolean) {
    setPending(true);
    setError(null);

    const result = await saveLanguages(undisclosed ? [] : selected, undisclosed);

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    await refresh();
    setPending(false);

    // The one step `nextRouteFor` cannot route to, because a photograph is
    // optional and its absence never means unfinished. See routing.ts.
    router.push(routes.photo);
  }

  return (
    <Step
      step="languages"
      title={t("onboarding.languages.title")}
      lede={t("onboarding.languages.lede")}
      onContinue={() => void submit(false)}
      canContinue={selected.length > 0}
      pending={pending}
      error={error}
      secondary={
        <TextButton
          label={t("onboarding.languages.ratherNotSay")}
          tone="muted"
          disabled={pending}
          onPress={() => void submit(true)}
        />
      }
    >
      {options === null ? (
        <LoadingState label={t("common.loading")} />
      ) : (
        <View>
          <ChipGroup>
            {options.map((option) => (
              <Chip
                key={option.id}
                label={option.name}
                selected={selected.includes(option.id)}
                onPress={() => toggle(option.id)}
              />
            ))}
          </ChipGroup>

          {selected.length > 0 ? (
            <Text variant="caption" tone="subtle" style={{ marginTop: space.xl }}>
              {t("onboarding.languages.selected", {
                count: selected.length,
              })}
            </Text>
          ) : null}
        </View>
      )}
    </Step>
  );
}
