import { Stack } from "expo-router";

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
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleStyle: {
          fontFamily: fontFamily.serif,
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
      <Stack.Screen name="profile" options={{ title: "Your profile" }} />
      <Stack.Screen name="edit" options={{ title: "Edit profile" }} />
      <Stack.Screen name="photos" options={{ title: "Photos" }} />
      <Stack.Screen name="verification" options={{ title: "Verification" }} />
      <Stack.Screen name="membership" options={{ title: "Membership" }} />
      <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
      <Stack.Screen name="blocked" options={{ title: "Blocked" }} />
      <Stack.Screen name="help" options={{ title: "Safety and help" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen
        name="logout"
        options={{ title: "Log out", presentation: "modal" }}
      />
    </Stack>
  );
}
