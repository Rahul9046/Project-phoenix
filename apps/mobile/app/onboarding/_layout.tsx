import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

/**
 * Onboarding is a stack, so back always means "the previous question".
 *
 * Headers are off: each step draws its own, because the progress indicator and
 * the back control belong together and a navigation header cannot hold both
 * without looking bolted on.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: "slide_from_right",
        // Android's predictive back would otherwise animate the whole task away
        // from a mid-onboarding screen, which reads as the app closing.
        gestureEnabled: true,
      }}
    />
  );
}
