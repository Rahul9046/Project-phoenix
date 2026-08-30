import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, motion, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";

/**
 * The three states every screen has besides its content.
 *
 * Eraya is new, so empty is the state most people will see first and most often.
 * An empty screen that looks broken is the fastest way to lose someone, and a
 * screen that invents activity to look busy is the fastest way to deserve it --
 * so these say plainly that there is nothing yet, explain when that will change,
 * and offer the one thing worth doing next. They never fabricate a count, a
 * profile or a notification.
 */

export function EmptyState({
  icon = "leaf-outline",
  title,
  body,
  actionLabel,
  onAction,
  style,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { alignItems: "center", paddingVertical: space.region },
        style,
      ]}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.sand,
        }}
      >
        <Ionicons name={icon} size={26} color={colors.inkSubtle} />
      </View>

      <Text variant="headline" center style={{ marginTop: space.xl }}>
        {title}
      </Text>
      <Text
        variant="body"
        tone="muted"
        center
        style={{ marginTop: space.sm, maxWidth: 330 }}
      >
        {body}
      </Text>

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          variant="secondary"
          size="md"
          block={false}
          onPress={onAction}
          style={{ marginTop: space.xxl }}
        />
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = "That did not load",
  body = "Check your connection and try again. Nothing has been lost.",
  onRetry,
  style,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[{ alignItems: "center", paddingVertical: space.region }, style]}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.dangerTint,
        }}
      >
        <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
      </View>

      <Text variant="headline" center style={{ marginTop: space.xl }}>
        {title}
      </Text>
      <Text
        variant="body"
        tone="muted"
        center
        style={{ marginTop: space.sm, maxWidth: 330 }}
      >
        {body}
      </Text>

      {onRetry ? (
        <Button
          label="Try again"
          variant="secondary"
          size="md"
          block={false}
          onPress={onRetry}
          style={{ marginTop: space.xxl }}
        />
      ) : null}
    </View>
  );
}

/** A spinner for the middle of an otherwise empty area. */
export function LoadingState({
  label = "Loading",
  style,
}: {
  label?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[
        { alignItems: "center", paddingVertical: space.region },
        style,
      ]}
    >
      <ActivityIndicator color={colors.ember} />
    </View>
  );
}

/**
 * A placeholder in the shape of what is coming.
 *
 * A skeleton in roughly the right layout says both "your tap registered" and
 * "here is what is arriving", and the content settles into place instead of
 * replacing something unrelated. The sweep is slow on purpose: a fast pulse
 * draws the eye rhythmically and makes a half-second wait feel like an event.
 */
export function Skeleton({
  height = 16,
  width = "100%",
  rounded = radius.sm,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  rounded?: number;
  style?: ViewStyle;
}) {
  const [pulse] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: motion.settle * 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: motion.settle * 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height,
          width,
          borderRadius: rounded,
          backgroundColor: colors.sandDeep,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

/** A person-shaped placeholder: monogram, name, one line beneath. */
export function SkeletonRow() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.lg,
        paddingVertical: space.lg,
      }}
    >
      <Skeleton height={52} width={52} rounded={radius.pill} />
      <View style={{ flex: 1, gap: space.sm }}>
        <Skeleton height={16} width="45%" />
        <Skeleton height={13} width="70%" />
      </View>
    </View>
  );
}
