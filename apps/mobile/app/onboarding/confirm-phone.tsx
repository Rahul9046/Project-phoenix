import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor } from "@/features/auth/routing";
import {
  confirmCode,
  phoneVerificationIsLive,
  requestCode,
  RESEND_COOLDOWN_SECONDS,
} from "@/features/onboarding/phone";
import { CODE_LENGTH, CodeInput } from "@/ui/CodeInput";
import { Step } from "@/features/onboarding/Step";
import { space } from "@/theme/tokens";
import { Text } from "@/ui/Text";
import { TextButton } from "@/ui/Button";
import { useToast } from "@/ui/Toast";

/**
 * The six digits.
 *
 * The number is shown back in full rather than masked. Masking is for showing
 * someone else's data to a third party; this is a person's own number on their
 * own screen, and the one useful thing this step can still do today is let them
 * notice a wrong digit.
 *
 * The resend control waits before it appears, and the wait is real on both
 * sides: the button counts down, and the server refuses an early request
 * whatever the button says. A cooldown enforced only in the interface is a
 * cooldown that lasts until somebody calls the API directly, and every message
 * costs money.
 */
export default function ConfirmPhoneStep() {
  const { refresh } = useSession();
  const params = useLocalSearchParams<{ dialCode?: string; national?: string }>();

  const toast = useToast();

  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A code was sent by the previous screen, so the wait starts now rather than
  // when this screen first offers to send another.
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const counting = secondsLeft > 0;

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(
      () => setSecondsLeft((remaining) => Math.max(0, remaining - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [counting]);

  async function resend() {
    if (resending || counting || !params.dialCode || !params.national) return;

    setResending(true);
    setError(null);

    const result = await requestCode(params.dialCode, params.national, {
      resend: true,
    });

    setResending(false);

    if (!result.ok) {
      setError(result.message);
      // The server knows how long is left better than the countdown does.
      if (result.retryAfterSeconds) setSecondsLeft(result.retryAfterSeconds);
      return;
    }

    setCode("");
    setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    toast.show("A new code is on its way.", "positive");
  }

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

    // Nothing is written here. The verify function set the profile server-side;
    // this only re-reads it.
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

      <View style={{ marginTop: space.xl, alignItems: "center" }}>
        {counting ? (
          <Text variant="bodySm" tone="subtle" center>
            You can ask for another code in {secondsLeft}s.
          </Text>
        ) : (
          <TextButton
            label={resending ? "Sending…" : "Send another code"}
            tone="muted"
            disabled={resending}
            onPress={() => void resend()}
          />
        )}
      </View>

    </Step>
  );
}
