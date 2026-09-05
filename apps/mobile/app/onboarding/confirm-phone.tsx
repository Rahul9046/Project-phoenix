import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { completePhoneStep } from "@/features/onboarding/data";
import { confirmCode, phoneVerificationIsLive } from "@/features/onboarding/phone";
import { CODE_LENGTH, CodeInput } from "@/ui/CodeInput";
import { Step } from "@/features/onboarding/Step";
import { colors, iconSize, radius, space } from "@/theme/tokens";
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

    /*
     * A frame between the profile arriving and the stack being rewritten.
     *
     * This is the one step in onboarding that replaces rather than pushes --
     * deliberately, so that back does not return to a code screen that has
     * already been accepted. A replace removes this screen and mounts the next
     * one in a single mount transaction, and doing that in the same frame as
     * `refresh` re-rendering every screen under the session provider is what
     * produced:
     *
     *   addViewAt: failed to insert view into parent
     *   Caused by: The specified child already has a parent
     *
     * A native crash, so nothing in JavaScript could catch it, and the app
     * simply closed. Every other step pushes and none of them do this.
     *
     * One frame is enough: the profile update paints, and the navigation is then
     * the only thing in its own commit.
     */
    requestAnimationFrame(() => router.replace(nextRouteFor(next)));
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
      <CodeInput
        value={code}
        onChange={(next) => {
          setCode(next);
          if (error) setError(null);
        }}
        disabled={pending}
        accessibilityLabel={`${CODE_LENGTH} digit code`}
      />

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
