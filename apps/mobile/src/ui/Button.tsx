import { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

import { colors, hit, motion, radius, space } from "@/theme/tokens";
import { text } from "@/theme/typography";
import { Text } from "@/ui/Text";

/**
 * The button.
 *
 * Three things it gets right on purpose, because each was called out as
 * something the prototype got wrong:
 *
 * Labels are never clipped. The label is a single line that shrinks rather than
 * truncates, horizontal padding is generous and independent of height, and the
 * button grows to fit rather than the text shrinking to fit the button.
 *
 * Height comes from the touch-target scale, never from padding arithmetic. Every
 * variant clears 44pt, and the standard size is 54 because a 44pt button with a
 * label in it looks cramped even though it is technically accessible.
 *
 * A press is acknowledged immediately -- a slight settle, and a haptic tick on
 * the primary action -- so the tap registers before the network does. That gap
 * is the single most common reason an application feels broken while working
 * perfectly.
 */

export type ButtonVariant =
  /** The one thing this screen is for. Terracotta, cream label. */
  | "primary"
  /** The alternative that is equally valid. Bordered, ink label. */
  | "secondary"
  /** A quiet action beside a louder one. No border, no fill. */
  | "ghost"
  /** Irreversible or unkind. Reads as a warning without shouting. */
  | "danger";

export type ButtonSize = "md" | "lg";

type Props = Omit<PressableProps, "style" | "children"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Fills the width of its container. */
  block?: boolean;
  /** Rendered before the label, at the label's own size. */
  icon?: React.ReactNode;
  style?: ViewStyle;
};

export function Button({
  label,
  variant = "primary",
  size = "lg",
  loading = false,
  block = true,
  icon,
  disabled,
  onPress,
  style,
  ...rest
}: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const isDisabled = Boolean(disabled) || loading;

  function settle(to: number) {
    Animated.timing(scale, {
      toValue: to,
      duration: motion.fast,
      useNativeDriver: true,
    }).start();
  }

  const height = size === "lg" ? hit.large : hit.control;
  const paletteFor: Record<
    ButtonVariant,
    { bg: string; border: string; label: string; pressed: string }
  > = {
    primary: {
      bg: colors.ember,
      border: colors.ember,
      label: colors.inkInverse,
      pressed: colors.emberStrong,
    },
    secondary: {
      bg: colors.surface,
      border: colors.lineStrong,
      label: colors.ink,
      pressed: colors.sand,
    },
    ghost: {
      bg: "transparent",
      border: "transparent",
      label: colors.emberText,
      pressed: colors.emberTint,
    },
    danger: {
      bg: colors.surface,
      border: colors.lineStrong,
      label: colors.danger,
      pressed: colors.dangerTint,
    },
  };
  const palette = paletteFor[variant];

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        block ? { alignSelf: "stretch" } : { alignSelf: "flex-start" },
        style,
      ]}
    >
      <Pressable
        {...rest}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityLabel={label}
        disabled={isDisabled}
        onPressIn={() => settle(0.98)}
        onPressOut={() => settle(1)}
        onPress={(event) => {
          if (variant === "primary") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onPress?.(event);
        }}
        style={({ pressed }) => ({
          minHeight: height,
          // Generous, and independent of height. A label needs room either side
          // of it far more than it needs a taller box.
          paddingHorizontal: space.xxl,
          paddingVertical: space.md,
          borderRadius: radius.pill,
          borderWidth: variant === "ghost" ? 0 : 1,
          borderColor: palette.border,
          backgroundColor: pressed ? palette.pressed : palette.bg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          opacity: isDisabled ? 0.55 : 1,
        })}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={palette.label}
            style={{ marginRight: space.xs }}
          />
        ) : icon ? (
          <View>{icon}</View>
        ) : null}

        <Text
          // One line that scales down rather than truncating. A button whose
          // label ends in an ellipsis has failed at the only job it has.
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={[text.label, { color: palette.label, flexShrink: 1 }]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * A label-only action, for the quiet option beside a loud one.
 *
 * Still clears the minimum touch target: the hit area is padded even though
 * nothing is drawn around it.
 */
export function TextButton({
  label,
  tone = "accent",
  onPress,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  label: string;
  tone?: "accent" | "muted" | "danger";
  style?: ViewStyle;
}) {
  const color =
    tone === "muted"
      ? colors.inkMuted
      : tone === "danger"
        ? colors.danger
        : colors.emberText;

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={space.sm}
      style={({ pressed }) => [
        {
          minHeight: hit.min,
          paddingHorizontal: space.sm,
          justifyContent: "center",
          alignSelf: "flex-start",
          opacity: pressed ? 0.6 : disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text variant="label" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * An icon on its own -- a back arrow, an overflow menu.
 *
 * The drawn size and the tappable size are separate. A 20pt glyph in a 44pt
 * target is correct; a 44pt glyph is a different design.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  icon: React.ReactNode;
  accessibilityLabel: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: hit.min,
          height: hit.min,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.pill,
          backgroundColor: pressed ? colors.sand : "transparent",
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}
