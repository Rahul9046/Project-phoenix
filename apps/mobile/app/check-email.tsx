import { useState } from "react";
import { View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor, routes } from "@/features/auth/routing";
import { sendEmailLink } from "@/features/auth/sign-in";
import { colors, radius, space } from "@/theme/tokens";
import { Button, TextButton } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { useToast } from "@/ui/Toast";

/**
 * Waiting for the emailed link.
 *
 * The screen stays mounted while someone leaves for their mail app, so when the
 * link opens Eraya the session provider picks up the new session and this
 * redirects out on its own. Nothing here polls.
 *
 * It says which address the link went to. The single most common failure in a
 * passwordless flow is a typo in the address, and the person is the only one who
 * can spot it -- so the address is shown, and changing it is one tap away rather
 * than buried behind a back gesture.
 */
export default function CheckEmail() {
  const { session, profile } = useSession();
  const params = useLocalSearchParams<{ email?: string }>();
  const toast = useToast();
  const [resending, setResending] = useState(false);

  const email = params.email ?? "";

  if (session) return <Redirect href={nextRouteFor(profile)} />;

  async function resend() {
    if (!email) return;
    setResending(true);

    const result = await sendEmailLink(email);

    toast.show(
      result.ok ? "Link sent again." : result.message,
      result.ok ? "positive" : "danger",
    );
    setResending(false);
  }

  return (
    <Screen topInset contentStyle={{ flexGrow: 1, justifyContent: "center" }}>
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.emberTint,
          }}
        >
          <Ionicons name="mail-outline" size={30} color={colors.emberText} />
        </View>

        <Text variant="title" center style={{ marginTop: space.xxl }}>
          Check your email.
        </Text>

        <Text
          variant="body"
          tone="muted"
          center
          style={{ marginTop: space.md, maxWidth: 330 }}
        >
          {email
            ? `We have sent a sign-in link to ${email}. Open it on this phone and Eraya will take it from there.`
            : "We have sent you a sign-in link. Open it on this phone and Eraya will take it from there."}
        </Text>

        <Text
          variant="bodySm"
          tone="subtle"
          center
          style={{ marginTop: space.xl, maxWidth: 330 }}
        >
          Links take a minute or two sometimes, and occasionally land in spam.
        </Text>
      </View>

      <View style={{ marginTop: space.region, gap: space.md }}>
        <Button
          label="Send it again"
          variant="secondary"
          loading={resending}
          disabled={!email}
          onPress={() => void resend()}
        />
        <View style={{ alignItems: "center" }}>
          <TextButton
            label="Use a different address"
            tone="muted"
            onPress={() => router.replace(routes.signIn)}
          />
        </View>
      </View>
    </Screen>
  );
}
