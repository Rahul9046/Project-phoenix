import { Stack } from "expo-router";

import { useT } from "@/features/i18n/LocaleProvider";
import { colors } from "@/theme/tokens";
import { fontFamily } from "@/theme/typography";

/**
 * The legal documents.
 *
 * At the root rather than inside `you/`, because they have to be reachable
 * before anybody signs in. The line at the bottom of the sign-in screen points
 * here, and a person deciding whether to join should be able to read the terms
 * they are agreeing to without first agreeing to them.
 *
 * Headers are shown for the same reason they are in the account area: these are
 * screens somebody moves into and back out of, and the platform's own back
 * affordance is clearer than anything hand-rolled -- Android's predictive back
 * included.
 */
export default function LegalLayout() {
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
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen
        name="privacy"
        options={{ title: t("common.legalPrivacy") }}
      />
      <Stack.Screen name="terms" options={{ title: t("common.legalTerms") }} />
      <Stack.Screen
        name="safety"
        options={{ title: t("common.legalGuidelines") }}
      />
    </Stack>
  );
}
