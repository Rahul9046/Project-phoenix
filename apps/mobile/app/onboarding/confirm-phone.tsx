import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { completePhoneStep } from "@/features/onboarding/data";
import {
  CODE_LENGTH,
  confirmCode,
  phoneVerificationIsLive,
} from "@/features/onboarding/phone";
import { Step } from "@/features/onboarding/Step";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { text } from "@/theme/typography";
import { Text } from "@/ui/Text";

/**
 * The six digits.
 *
 * The number is shown back in full rather than masked. Masking is for showing
 * someone else's data to a third party; this is a person's own number on their
 * own screen, and the one useful thing this step can still do today is let them
 * notice a wrong digit.
 *
 * There is no resend control while nothing is being sent. A "resend code" button
 * that sends nothing and then reports success is a small lie in a product whose
 * whole proposition is that it does not tell them.
 */
export default function ConfirmPhoneStep() {
  const { refresh } = useSession();
  const params = useLocalSearchParams<{ dialCode?: string; national?: string }>();

  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const number =
    params.dialCode && params.national
      ? `${params.dialCode} ${params.national}`
      : null;

  async function submit() {
    setPending(true);
    setError(null);

    const checked = await confirmCode(code);

    if (!checked.ok) {
      setError(checked.message);
      setPending(false);
      return;
    }

    const saved = await completePhoneStep();

    if (!saved.ok) {
      setError(saved.message);
      setPending(false);
      return;
    }

    const next = await refresh();
    setPending(false);
    router.replace(nextRouteFor(next));
  }

  return (
    <Step
      step="phone"
      title="Confirm your number."
      lede={
        phoneVerificationIsLive
          ? `We sent a ${CODE_LENGTH}-digit code to ${number ?? "your phone"}.`
          : `Checking codes by SMS is not switched on yet, so any ${CODE_LENGTH} digits will do for now. Your number is ${number ?? "saved"}.`
      }
      continueLabel="Continue"
      onContinue={() => void submit()}
      canContinue={code.length === CODE_LENGTH}
      pending={pending}
      error={error}
    >
      {/*
        One hidden field behind six drawn boxes. Six real inputs means six
        focus targets, six places for the keyboard to jump, and autofill that
        works on none of them -- and it is the usual reason a code screen feels
        broken on Android.
      */}
      <View>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(next) => {
            setCode(next.replace(/[^\d]/g, "").slice(0, CODE_LENGTH));
            if (error) setError(null);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={CODE_LENGTH}
          autoFocus
          accessibilityLabel={`${CODE_LENGTH} digit code`}
          style={{
            position: "absolute",
            opacity: 0,
            height: hit.large,
            width: "100%",
          }}
        />

        {/* The drawn boxes are one control: tapping any of them focuses the
            single hidden field behind them. */}
        <Pressable
          accessibilityRole="none"
          onPress={() => inputRef.current?.focus()}
          style={{ flexDirection: "row", gap: space.sm }}
        >
          {Array.from({ length: CODE_LENGTH }).map((_, index) => {
            const digit = code[index];
            const active = index === code.length;

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
                }}
              >
                <Text style={[text.title, { fontSize: 26 }]}>{digit ?? ""}</Text>
              </View>
            );
          })}
        </Pressable>
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
            Development only. Because nothing was sent, no code is correct or
            incorrect &mdash; any six digits continue. Other members are never
            told your number is verified.
          </Text>
        </View>
      ) : null}
    </Step>
  );
}
