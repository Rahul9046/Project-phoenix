import { useRef } from "react";
import { Pressable, TextInput, View } from "react-native";

import { colors, hit, radius, space } from "@/theme/tokens";
import { text } from "@/theme/typography";
import { Text } from "@/ui/Text";

/**
 * A six-digit code.
 *
 * One hidden field behind six drawn boxes. Six real inputs means six focus
 * targets, six places for the keyboard to jump, and autofill that works on none
 * of them -- and it is the usual reason a code screen feels broken on Android.
 *
 * `autoComplete="sms-otp"` and `textContentType="oneTimeCode"` let both
 * platforms offer the code from the notification, which turns this screen into a
 * single tap when it works.
 *
 * Extracted from the phone step so the email code screen is the same control
 * rather than a second implementation that drifts from it.
 */
export const CODE_LENGTH = 6;

export function CodeInput({
  value,
  onChange,
  autoFocus = true,
  disabled = false,
  accessibilityLabel = "Six digit code",
}: {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const inputRef = useRef<TextInput>(null);

  return (
    <View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(next) =>
          onChange(next.replace(/[^\d]/g, "").slice(0, CODE_LENGTH))
        }
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={CODE_LENGTH}
        autoFocus={autoFocus}
        editable={!disabled}
        accessibilityLabel={accessibilityLabel}
        style={{
          position: "absolute",
          opacity: 0,
          height: hit.large,
          width: "100%",
        }}
      />

      {/* The boxes are one control: tapping any of them focuses the field. */}
      <Pressable
        accessibilityRole="none"
        onPress={() => inputRef.current?.focus()}
        style={{ flexDirection: "row", gap: space.sm }}
      >
        {Array.from({ length: CODE_LENGTH }).map((_, index) => {
          const digit = value[index];
          const active = index === value.length;

          return (
            <View
              key={index}
              style={{
                flex: 1,
                height: 62,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius.lg,
                borderWidth: active || digit ? 2 : 1,
                borderColor: digit
                  ? colors.ink
                  : active
                    ? colors.ember
                    : colors.lineStrong,
                backgroundColor: colors.surface,
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <Text style={[text.title, { fontSize: 26 }]}>{digit ?? ""}</Text>
            </View>
          );
        })}
      </Pressable>
    </View>
  );
}
