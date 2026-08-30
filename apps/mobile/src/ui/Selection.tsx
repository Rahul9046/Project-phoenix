import { Pressable, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * Making a choice.
 *
 * Onboarding asks one question at a time, so its answers are full-width rows
 * with room for a supporting line -- not a grid of small pills that has to be
 * squinted at. Selection is shown by a filled border and a tick rather than by
 * colour alone, so it survives both a screen reader and a colour-blind reader.
 */

export function SelectionCard({
  label,
  description,
  selected,
  onPress,
  style,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: hit.large,
          flexDirection: "row",
          alignItems: "center",
          gap: space.lg,
          paddingVertical: space.lg,
          paddingHorizontal: space.xl,
          borderRadius: radius.lg,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.ember : colors.lineStrong,
          backgroundColor: selected
            ? colors.emberTint
            : pressed
              ? colors.sand
              : colors.surface,
        },
        style,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text variant="label" style={{ fontSize: 16.5 }}>
          {label}
        </Text>
        {description ? (
          <Text variant="bodySm" tone="muted" style={{ marginTop: space.xs }}>
            {description}
          </Text>
        ) : null}
      </View>

      {selected ? (
        <Ionicons
          name="checkmark-circle"
          size={iconSize.lg}
          color={colors.ember}
        />
      ) : (
        <View
          style={{
            width: iconSize.lg,
            height: iconSize.lg,
            borderRadius: radius.pill,
            borderWidth: 1.5,
            borderColor: colors.lineStrong,
          }}
        />
      )}
    </Pressable>
  );
}

/**
 * A compact toggle, for choosing several things from a set.
 *
 * Used for languages and for filter values, where the options are short and the
 * count is high enough that full-width rows would turn into a scroll marathon.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  tone = "default",
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** `accent` marks an active filter; `quiet` is a read-only tag. */
  tone?: "default" | "accent" | "quiet";
  style?: ViewStyle;
}) {
  const readOnly = !onPress;
  const background = selected
    ? colors.ember
    : tone === "accent"
      ? colors.emberTint
      : tone === "quiet"
        ? colors.sand
        : colors.surface;
  const border = selected
    ? colors.ember
    : tone === "quiet"
      ? colors.sand
      : colors.lineStrong;
  const labelColor = selected
    ? colors.inkInverse
    : tone === "accent"
      ? colors.emberText
      : colors.ink;

  const body = (
    <Text
      variant="labelSm"
      numberOfLines={1}
      style={{ color: labelColor, flexShrink: 1 }}
    >
      {label}
    </Text>
  );

  const shape: ViewStyle = {
    minHeight: readOnly ? 32 : hit.min,
    justifyContent: "center",
    paddingHorizontal: readOnly ? space.md : space.lg,
    paddingVertical: readOnly ? space.xs : space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: background,
  };

  if (readOnly) {
    return <View style={[shape, style]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        shape,
        pressed && !selected && { backgroundColor: colors.sand },
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

/** A row of chips that wraps rather than scrolls. */
export function ChipGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
        style,
      ]}
    >
      {children}
    </View>
  );
}
