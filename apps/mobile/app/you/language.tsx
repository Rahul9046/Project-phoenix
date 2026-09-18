import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { LOCALES, LOCALE_NAMES, type Locale } from "@eraya/i18n";

import { useLocale } from "@/features/i18n/LocaleProvider";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { Screen } from "@/ui/Screen";
import { Card, Divider } from "@/ui/Surface";
import { Text } from "@/ui/Text";
import { useToast } from "@/ui/Toast";

/**
 * Choosing the language Eraya speaks.
 *
 * Each option is written in its own language and nothing else. Somebody looking
 * for Bengali is looking for বাংলা; showing them "Bengali" in a language they
 * may not read is the one mistake this screen cannot afford. No flags either --
 * a flag is a country, these are languages, and the mapping is wrong often
 * enough to be insulting.
 *
 * The change is immediate. The provider holds the locale in state, so tapping
 * an option re-renders this screen and every other mounted one; there is no
 * restart, and no "apply" button to press afterwards.
 *
 * The note at the bottom is not decoration. "Language" and "languages I speak"
 * are easy to confuse, and confusing them means somebody believes they have
 * edited their profile when they have not.
 */
export default function Language() {
  const { locale, t, setLocale } = useLocale();
  const toast = useToast();

  const [pending, setPending] = useState<Locale | null>(null);

  async function choose(next: Locale) {
    if (next === locale || pending) return;

    setPending(next);
    const ok = await setLocale(next);
    setPending(null);

    // Said in the language just chosen, which is the clearest possible proof
    // that it worked.
    toast.show(
      ok ? t("account.language.saved") : t("account.language.failed"),
      ok ? "positive" : "danger",
    );
  }

  return (
    <Screen>
      <Text variant="title">{t("account.language.title")}</Text>
      <Text variant="body" tone="muted" style={{ marginTop: space.md }}>
        {t("account.language.lede")}
      </Text>

      <Card style={{ marginTop: space.section }}>
        {LOCALES.map((option, index) => {
          const selected = option === locale;

          return (
            <View key={option}>
              {index > 0 ? <Divider style={{ marginVertical: space.md }} /> : null}

              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: pending !== null }}
                accessibilityLabel={LOCALE_NAMES[option]}
                disabled={pending !== null}
                onPress={() => void choose(option)}
                style={({ pressed }) => ({
                  minHeight: hit.control,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: space.md,
                  paddingHorizontal: space.sm,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? colors.sand : "transparent",
                  opacity: pending !== null && pending !== option ? 0.5 : 1,
                })}
              >
                <Text variant="body">{LOCALE_NAMES[option]}</Text>

                {selected ? (
                  <Ionicons
                    name="checkmark"
                    size={iconSize.md}
                    color={colors.ember}
                  />
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </Card>

      <Text variant="bodySm" tone="subtle" style={{ marginTop: space.lg }}>
        {t("account.language.note")}
      </Text>
    </Screen>
  );
}
