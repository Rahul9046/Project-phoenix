import { Stack } from "expo-router";

import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { useT } from "@/features/i18n/LocaleProvider";
import { colors } from "@/theme/tokens";
import { fontFamily } from "@/theme/typography";

/**
 * The account area.
 *
 * These screens use a real navigation header, unlike onboarding and the tabs.
 * They are a hierarchy someone moves through and back out of, and the platform's
 * own back affordance is the clearest thing available for that -- including
 * Android's hardware and predictive back, which a hand-rolled header does not
 * get for free.
 */
export default function YouLayout() {
  const t = useT();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleStyle: {
          fontFamily: fontFamily.semibold,
          fontSize: 18,
          color: colors.ink,
        },
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerBackButtonDisplayMode: "minimal",
        /*
          Every screen in the account area, from one place. A member who has
          landed in a language they cannot read is most likely to come looking
          here, and the control should already be in front of them rather than
          two taps further in.
        */
        headerRight: () => <LanguageSwitcher />,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="profile" options={{ title: "Your profile" }} />
      <Stack.Screen name="edit" options={{ title: "Edit profile" }} />
      <Stack.Screen name="photos" options={{ title: "Photos" }} />
      <Stack.Screen name="verification" options={{ title: "Verification" }} />
      <Stack.Screen name="membership" options={{ title: "Membership" }} />
      <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
      <Stack.Screen name="blocked" options={{ title: "Blocked" }} />
      <Stack.Screen name="help" options={{ title: "Safety and help" }} />
      {/*
        The title comes from the translations, so the language screen's own
        header is already in whichever language is active.
      */}
      <Stack.Screen
        name="language"
        options={{ title: t("account.language.title") }}
      />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen
        name="logout"
        options={{ title: "Log out", presentation: "modal" }}
      />
    </Stack>
  );
}
