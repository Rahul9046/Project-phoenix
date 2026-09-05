import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";

import { colors, radius, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * Bordered surfaces, dividers and headings.
 *
 * Depth in Eraya comes from a hairline border on a slightly different ground,
 * not from a drop shadow. A screen of shadowed cards reads as a dashboard; a
 * screen of bordered panels reads as a document, which is closer to what this
 * product is trying to be. Shadows are reserved for things that genuinely float.
 */

export function Card({
  children,
  onPress,
  tone = "surface",
  padded = true,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  /** Makes the whole card a control. Adds a press state; keeps the border. */
  onPress?: () => void;
  tone?: "surface" | "sand" | "accent";
  padded?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const background =
    tone === "sand"
      ? colors.sand
      : tone === "accent"
        ? colors.emberTint
        : colors.surface;
  const border = tone === "accent" ? colors.emberTint : colors.line;

  const base: ViewStyle = {
    backgroundColor: background,
    borderWidth: 1,
    borderColor: border,
    borderRadius: radius.xl,
    padding: padded ? space.xl : 0,
    overflow: "hidden",
  };

  if (!onPress) {
    return <View style={[base, style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        base,
        pressed && {
          backgroundColor: tone === "surface" ? colors.sand : colors.sandDeep,
          borderColor: colors.lineStrong,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Divider({
  style,
  inset = 0,
}: {
  style?: ViewStyle;
  /** Indents the rule, for lists where rows share a leading avatar. */
  inset?: number;
}) {
  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: colors.line,
          marginLeft: inset,
        },
        style,
      ]}
    />
  );
}

/**
 * The heading above a block of content.
 *
 * Eyebrow, title, and an optional supporting line -- the same three-part shape
 * the web uses, so a section here looks like a section there.
 */
export function SectionHeader({
  eyebrow,
  title,
  lede,
  action,
  style,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  /** A single control on the right of the title, e.g. "See all". */
  action?: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={style}>
      {eyebrow ? (
        <Text variant="eyebrow" tone="accent" style={{ marginBottom: space.sm }}>
          {eyebrow}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.md,
        }}
      >
        <Text variant="title" style={{ flexShrink: 1 }}>
          {title}
        </Text>
        {action}
      </View>

      {lede ? (
        <Text variant="body" tone="muted" style={{ marginTop: space.sm }}>
          {lede}
        </Text>
      ) : null}
    </View>
  );
}

/** Vertical space, named rather than a magic margin on the next element. */
export function Spacer({ size = "lg" }: { size?: keyof typeof space }) {
  return <View style={{ height: space[size] }} />;
}
