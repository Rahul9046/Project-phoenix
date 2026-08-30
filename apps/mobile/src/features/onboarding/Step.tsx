import type { ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, iconSize, radius, space } from "@/theme/tokens";
import { Button, IconButton } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/**
 * One question, and the frame around it.
 *
 * Onboarding is a sequence of screens that differ only in the question and the
 * control that answers it, so everything else -- the back affordance, the
 * progress, the heading, the button pinned to the bottom -- is decided once
 * here. That is what keeps it feeling like one conversation rather than seven
 * forms, and it makes adding or reordering a step a change in one place.
 *
 * The continue button sits at the bottom above the safe area, not at the end of
 * the content. On a phone the thumb is at the bottom, and a button that moves
 * with the content is a button that has to be hunted for.
 */

export const onboardingSteps = [
  "phone",
  "name",
  "birthday",
  "gender",
  "city",
  "relationship",
  "languages",
] as const;

export type OnboardingStepName = (typeof onboardingSteps)[number];

export function Step({
  step,
  title,
  lede,
  children,
  continueLabel = "Continue",
  onContinue,
  canContinue,
  pending = false,
  error,
  secondary,
  canGoBack = true,
}: {
  step: OnboardingStepName;
  title: string;
  /** One line under the heading. Two at most -- this is not a page of copy. */
  lede?: string;
  children: ReactNode;
  continueLabel?: string;
  onContinue: () => void;
  canContinue: boolean;
  pending?: boolean;
  error?: string | null;
  /** A quiet alternative under the primary button, e.g. "I'd rather not say". */
  secondary?: ReactNode;
  canGoBack?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const index = onboardingSteps.indexOf(step);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.md,
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
        }}
      >
        {canGoBack && router.canGoBack() ? (
          <IconButton
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            icon={
              <Ionicons
                name="chevron-back"
                size={iconSize.lg}
                color={colors.ink}
              />
            }
          />
        ) : (
          <View style={{ width: 44 }} />
        )}

        <Progress index={index} total={onboardingSteps.length} />

        <View style={{ width: 44 }} />
      </View>

      <Screen bottomSpace={0} contentStyle={{ flexGrow: 1 }}>
        <Text variant="display" style={{ marginTop: space.xl }}>
          {title}
        </Text>

        {lede ? (
          <Text variant="body" tone="muted" style={{ marginTop: space.md }}>
            {lede}
          </Text>
        ) : null}

        <View style={{ marginTop: space.section, flex: 1 }}>{children}</View>

        {error ? (
          <Text
            variant="bodySm"
            tone="danger"
            accessibilityLiveRegion="polite"
            style={{ marginTop: space.lg }}
          >
            {error}
          </Text>
        ) : null}
      </Screen>

      <View
        style={{
          paddingHorizontal: space.gutter,
          paddingTop: space.lg,
          paddingBottom: insets.bottom + space.lg,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          backgroundColor: colors.canvas,
          gap: space.sm,
        }}
      >
        <Button
          label={continueLabel}
          onPress={onContinue}
          disabled={!canContinue}
          loading={pending}
        />
        {secondary ? (
          <View style={{ alignItems: "center" }}>{secondary}</View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * How far along, as segments rather than a percentage.
 *
 * Seven short bars say "seven questions, you are on the third". A single filling
 * bar says "43%", which is a number nobody wanted and which makes the remaining
 * work feel unbounded.
 */
function Progress({ index, total }: { index: number; total: number }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${total}`}
      style={{
        flex: 1,
        flexDirection: "row",
        gap: space.xs,
        alignItems: "center",
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: radius.pill,
            backgroundColor: i <= index ? colors.ember : colors.line,
          }}
        />
      ))}
    </View>
  );
}
