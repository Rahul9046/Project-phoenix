import { forwardRef, useState } from "react";
import {
  Pressable,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { text } from "@/theme/typography";
import { Text } from "@/ui/Text";

/**
 * Text entry.
 *
 * The label sits above the field rather than inside it. A placeholder that
 * doubles as a label disappears the moment someone starts typing, which is
 * exactly when they are most likely to want to check what was being asked --
 * and it is unreadable to a screen reader reviewing a completed form.
 *
 * Errors are announced as well as shown. Colour alone is not a message.
 */

export type FieldProps = TextInputProps & {
  label?: string;
  /** Guidance shown under the field while it is valid. */
  hint?: string;
  /** Replaces the hint and turns the border. Announced politely. */
  error?: string | null;
  /** Drawn inside the field, before the text. */
  leading?: React.ReactNode;
  /** Drawn inside the field, after the text. Usually a control. */
  trailing?: React.ReactNode;
  containerStyle?: ViewStyle;
};

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  {
    label,
    hint,
    error,
    leading,
    trailing,
    containerStyle,
    style,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.danger
    : focused
      ? colors.ink
      : colors.lineStrong;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" style={{ marginBottom: space.sm }}>
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          minHeight: hit.control,
          paddingHorizontal: space.lg,
          borderWidth: 1,
          borderColor,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
        }}
      >
        {leading}
        <TextInput
          ref={ref}
          {...rest}
          accessibilityLabel={label ?? rest.accessibilityLabel}
          placeholderTextColor={colors.inkSubtle}
          selectionColor={colors.ember}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            text.body,
            {
              flex: 1,
              color: colors.ink,
              // Android adds its own vertical padding to TextInput and it does
              // not match iOS. Zeroing it lets minHeight decide, on both.
              paddingVertical: space.md,
            },
            style,
          ]}
        />
        {trailing}
      </View>

      {error ? (
        <Text
          variant="bodySm"
          tone="danger"
          accessibilityLiveRegion="polite"
          style={{ marginTop: space.sm }}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text variant="bodySm" tone="subtle" style={{ marginTop: space.sm }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

/**
 * A search field.
 *
 * Separated from `Field` because it behaves differently: a leading glyph, a
 * clear control that only appears when there is something to clear, and no
 * label -- the placeholder is the label, which is acceptable here precisely
 * because the field's content is the query rather than an answer to a question.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder = "Search",
  autoFocus,
  accessibilityLabel,
  style,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  accessibilityLabel: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          minHeight: hit.control,
          paddingHorizontal: space.lg,
          borderWidth: 1,
          borderColor: colors.lineStrong,
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      <Ionicons name="search" size={iconSize.md} color={colors.inkSubtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSubtle}
        selectionColor={colors.ember}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel}
        style={[
          text.body,
          { flex: 1, color: colors.ink, paddingVertical: space.md },
        ]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={space.md}
        >
          <Ionicons
            name="close-circle"
            size={iconSize.md}
            color={colors.inkSubtle}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
