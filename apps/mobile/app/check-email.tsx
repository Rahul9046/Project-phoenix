import { useState } from "react";
import { View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor, routes } from "@/features/auth/routing";
import { sendEmailSignIn, verifyEmailCode } from "@/features/auth/sign-in";
import { colors, radius, space } from "@/theme/tokens";
import { Button, TextButton } from "@/ui/Button";
import { CODE_LENGTH, CodeInput } from "@/ui/CodeInput";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { useToast } from "@/ui/Toast";

/**
 * Finishing an email sign-in.
 *
 * The code is the primary path, and the link is the fallback -- which is the
 * opposite of how this started, for a reason worth writing down.
 *
 * Tapping the link on a phone opens a browser, which then has to hand
 * `eraya://` back to the app. Chrome blocks launching an external app from a
 * server redirect without a user gesture, and is stricter still in incognito.
 * The result is a blank tab: no error, nothing to tap, no way to tell whether
 * anything happened. It works often enough to look fine in testing and fails
 * often enough to be unusable.
 *
 * Typing six digits works in every mail client on every platform, needs no
 * browser, and cannot be swallowed by another app claiming the scheme. It is
 * also the only version of this that works when mail is read on a different
 * device from the one holding the app.
 *
 * The screen stays mounted while someone leaves for their inbox, so if the link
 * does work the session provider notices and this redirects out on its own.
 */
export default function CheckEmail() {
  const { loading, session, profile } = useSession();
  const params = useLocalSearchParams<{ email?: string }>();
  const toast = useToast();

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = params.email ?? "";

  /*
   * Not until the profile has resolved, and the wait is the point.
   *
   * `Redirect` calls `router.replace` from a `useFocusEffect` whose callback is
   * a fresh closure on every render, so it fires again each time this screen
   * re-renders while focused. Redirecting on `session` alone meant it rendered
   * once the moment the session arrived -- profile still null, so the fallback
   * route -- and again a few hundred milliseconds later when the profile landed.
   * Two replaces, the second one while the first transition was still animating,
   * and Android tried to mount the same screen twice:
   *
   *   addViewAt: failed to insert view into parent
   *   Caused by: The specified child already has a parent
   *
   * That is a native crash. The error boundary in the root layout cannot catch
   * it, which is why the app simply closed after signing in.
   *
   * Waiting for `loading` makes this render once, with the destination already
   * known. Every other screen that redirects does the same; this one was the
   * exception, and it is the screen someone is on at the exact moment they
   * sign in.
   */
  if (!loading && session) return <Redirect href={nextRouteFor(profile)} />;

  async function submit() {
    if (!email) return;
    setVerifying(true);
    setError(null);

    const result = await verifyEmailCode(email, code);

    if (!result.ok) {
      setError(result.message);
      setVerifying(false);
      return;
    }

    // The session provider is subscribed to auth state and will route from
    // here, so this screen does not navigate itself.
    setVerifying(false);
  }

  async function resend() {
    if (!email) return;
    setResending(true);
    setError(null);

    const result = await sendEmailSignIn(email);

    toast.show(
      result.ok ? "Sent. Use the newest email." : result.message,
      result.ok ? "positive" : "danger",
    );
    setResending(false);
  }

  return (
    <Screen topInset>
      <View style={{ alignItems: "center", marginTop: space.section }}>
        <View
          style={{
            width: 68,
            height: 68,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.emberTint,
          }}
        >
          <Ionicons name="mail-outline" size={28} color={colors.emberText} />
        </View>

        <Text variant="title" center style={{ marginTop: space.xl }}>
          Check your email.
        </Text>
        <Text
          variant="body"
          tone="muted"
          center
          style={{ marginTop: space.md, maxWidth: 330 }}
        >
          {email
            ? `We sent a ${CODE_LENGTH}-digit code to ${email}. Enter it below.`
            : `We sent you a ${CODE_LENGTH}-digit code. Enter it below.`}
        </Text>
      </View>

      <View style={{ marginTop: space.section }}>
        <CodeInput
          value={code}
          onChange={(next) => {
            setCode(next);
            if (error) setError(null);
          }}
          disabled={verifying}
        />
      </View>

      {error ? (
        <Text
          variant="bodySm"
          tone="danger"
          accessibilityLiveRegion="polite"
          style={{ marginTop: space.lg }}
        >
          {error}
        </Text>
      ) : null}

      <Button
        label="Sign in"
        loading={verifying}
        disabled={code.length !== CODE_LENGTH}
        onPress={() => void submit()}
        style={{ marginTop: space.xl }}
      />

      <View
        style={{
          marginTop: space.section,
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.sand,
        }}
      >
        <Text variant="caption" tone="muted">
          The same email has a button you can tap instead. On some phones the
          browser will not hand the link back to the app, which is why the code
          is here &mdash; it always works.
        </Text>
      </View>

      <View style={{ marginTop: space.xxl, alignItems: "center", gap: space.sm }}>
        <TextButton
          label={resending ? "Sending…" : "Send another email"}
          tone="muted"
          disabled={resending || !email}
          onPress={() => void resend()}
        />
        <TextButton
          label="Use a different address"
          tone="muted"
          onPress={() => router.replace(routes.signIn)}
        />
      </View>
    </Screen>
  );
}
