import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Step } from "@/features/onboarding/Step";
import {
  dialCodes,
  defaultDialCode,
  isPlausibleNumber,
  normaliseNumber,
  phoneVerificationIsLive,
  requestCode,
} from "@/features/onboarding/phone";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { Field } from "@/ui/Input";
import { BottomSheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";

/**
 * The phone number.
 *
 * The dial-code control is a short list, not a country picker. Eraya's members
 * are in India and a searchable list of two hundred countries would be a
 * needless obstacle in front of the one everybody wants; the handful of others
 * are here for members who live abroad.
 *
 * The wording promises only what happens. Nothing is verified yet, so the screen
 * does not say "verify" and the button does not say "send code".
 */
export default function PhoneStep() {
  const [dialCode, setDialCode] = useState<string>(defaultDialCode);
  const [national, setNational] = useState("");
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);

    const result = await requestCode(dialCode, national);

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    setPending(false);
    router.push({
      pathname: "/onboarding/confirm-phone",
      params: { dialCode, national: normaliseNumber(national) },
    });
  }

  const selectedLabel =
    dialCodes.find((entry) => entry.code === dialCode)?.label ?? dialCode;

  return (
    <Step
      step="phone"
      title="Add your phone number."
      lede="We send a six-digit code to check it, and keep it for account recovery. It is never shown on your profile, and no other member ever sees it."
      onContinue={() => void submit()}
      canContinue={isPlausibleNumber(dialCode, national)}
      pending={pending}
      error={error}
      canGoBack={false}
    >
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Country code, ${selectedLabel}. Tap to change.`}
          onPress={() => setPicking(true)}
          style={({ pressed }) => ({
            minHeight: hit.control,
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            paddingHorizontal: space.lg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.lineStrong,
            backgroundColor: pressed ? colors.sand : colors.surface,
          })}
        >
          <Text variant="body">{dialCode}</Text>
          <Ionicons
            name="chevron-down"
            size={iconSize.sm}
            color={colors.inkSubtle}
          />
        </Pressable>

        <Field
          containerStyle={{ flex: 1 }}
          value={national}
          onChangeText={(next) => {
            setNational(normaliseNumber(next));
            if (error) setError(null);
          }}
          placeholder="98765 43210"
          keyboardType="number-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={14}
          autoFocus
          accessibilityLabel="Phone number"
        />
      </View>

      {!phoneVerificationIsLive ? (
        <View
          style={{
            marginTop: space.xxl,
            flexDirection: "row",
            gap: space.md,
            padding: space.lg,
            borderRadius: radius.lg,
            backgroundColor: colors.sand,
          }}
        >
          <Ionicons
            name="construct-outline"
            size={iconSize.md}
            color={colors.inkMuted}
          />
          <Text variant="bodySm" tone="muted" style={{ flex: 1 }}>
            Checking numbers by SMS is not switched on yet, so nothing will be
            sent. Your number is stored, and no other member ever sees it.
          </Text>
        </View>
      ) : null}

      <BottomSheet
        visible={picking}
        onClose={() => setPicking(false)}
        title="Country code"
      >
        <View style={{ gap: space.xs }}>
          {dialCodes.map((entry) => (
            <Pressable
              key={entry.code}
              accessibilityRole="button"
              accessibilityState={{ selected: entry.code === dialCode }}
              accessibilityLabel={entry.label}
              onPress={() => {
                setDialCode(entry.code);
                setPicking(false);
              }}
              style={({ pressed }) => ({
                minHeight: hit.large,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: space.lg,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.sand : "transparent",
              })}
            >
              <Text variant="body">{entry.label}</Text>
              {entry.code === dialCode ? (
                <Ionicons
                  name="checkmark"
                  size={iconSize.md}
                  color={colors.ember}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </Step>
  );
}
