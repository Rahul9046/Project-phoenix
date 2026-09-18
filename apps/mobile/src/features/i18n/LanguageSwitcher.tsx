import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { LOCALES, LOCALE_NAMES, type Locale } from "@eraya/i18n";

import { useLocale } from "@/features/i18n/LocaleProvider";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { BottomSheet } from "@/ui/Sheet";
import { Divider } from "@/ui/Surface";
import { Text } from "@/ui/Text";

/**
 * The language control that sits on screens nobody has signed in to yet.
 *
 * `you/language.tsx` is the settings version of this: a full screen, reached
 * deliberately, with room for an explanation. That is the right shape for
 * changing your mind later and the wrong shape for the first screen of the
 * product, where the question is not "would you like to review a preference"
 * but "can you read this at all".
 *
 * So this is the compact form of the same decision -- a control small enough to
 * sit in a header, on sign-in and on every onboarding step. It is the reason
 * `LocaleProvider` writes to device storage at all: a member who has not signed
 * in has no profile to hold a preference, and until there is something on screen
 * to change the language *with*, six translated languages are six languages
 * nobody can reach.
 *
 * On sign-in it names the current language as well as carrying the globe. A
 * globe alone says "settings of some kind"; বাংলা says "this is in Bengali, and
 * this is where you change it" to the one person who most needs to know -- and
 * sign-in is the one screen where nothing else has told them yet. Inside
 * onboarding the globe is enough: the question they are reading is already in
 * the language, and that header has a back button and nine progress segments to
 * fit beside this.
 */
export function LanguageSwitcher({
  /**
   * `quiet` is the onboarding-header form: the globe alone, because that header
   * already holds a back button and nine progress segments and the screen behind
   * it is visibly in the chosen language. `bordered` names the language as well,
   * for a screen with the room for it and no header to anchor the control --
   * sign-in, where nothing else on screen has told the member what language
   * they are about to read.
   */
  variant = "quiet",
}: {
  variant?: "quiet" | "bordered";
}) {
  const { locale, t, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Locale | null>(null);

  async function choose(next: Locale) {
    if (pending) return;

    if (next === locale) {
      setOpen(false);
      return;
    }

    setPending(next);
    await setLocale(next);
    setPending(null);

    /*
     * Closed once the choice is made, and no toast.
     *
     * The settings screen confirms in words because there the member is looking
     * at a list of preferences and needs to be told which one took. Here the
     * proof is the screen behind the sheet: it is already in the new language by
     * the time this closes. Saying so as well, in a language they have just told
     * us they may not read, adds nothing.
     */
    setOpen(false);
  }

  const bordered = variant === "bordered";

  return (
    <>
      <Pressable
        accessibilityRole="button"
        /*
          The label is the verb and the value is the current language, which is
          how a screen reader announces a control that changes a setting. It also
          means the icon-only form is not a mystery button: there is no visible
          text in that variant for a label to duplicate.
        */
        accessibilityLabel={t("common.changeLanguage")}
        accessibilityValue={{ text: LOCALE_NAMES[locale] }}
        onPress={() => setOpen(true)}
        hitSlop={space.sm}
        style={({ pressed }) => ({
          minHeight: hit.min,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.xs,
          paddingHorizontal: bordered ? space.md : space.sm,
          borderRadius: radius.pill,
          borderWidth: bordered ? 1 : 0,
          borderColor: colors.line,
          backgroundColor: pressed
            ? colors.sand
            : bordered
              ? colors.surface
              : "transparent",
        })}
      >
        <Ionicons
          name="language-outline"
          size={iconSize.md}
          color={colors.inkMuted}
        />
        {bordered ? (
          <Text variant="bodySm" tone="muted" numberOfLines={1}>
            {LOCALE_NAMES[locale]}
          </Text>
        ) : null}
        <Ionicons
          name="chevron-down"
          size={iconSize.sm}
          color={colors.inkSubtle}
        />
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t("account.language.title")}
      >
        {LOCALES.map((option, index) => {
          const selected = option === locale;

          return (
            <View key={option}>
              {index > 0 ? (
                <Divider style={{ marginVertical: space.md }} />
              ) : null}

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
                {/*
                  Each name in its own language and nothing else -- the same rule
                  the settings screen follows, and for the same reason. Somebody
                  looking for Tamil is looking for தமிழ், not for the word
                  "Tamil" written in a language they may not read. No flags: a
                  flag is a country and these are languages.
                */}
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
      </BottomSheet>
    </>
  );
}
