import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { routes } from "@/features/auth/routing";
import { deleteAccount } from "@/features/account/delete";
import { colors, iconSize, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { ConfirmSheet } from "@/ui/Sheet";
import { Card, Divider } from "@/ui/Surface";
import { Text } from "@/ui/Text";
import { useToast } from "@/ui/Toast";

/**
 * Settings, and the way out of Eraya altogether.
 *
 * Account details are read-only here: the email address is the thing someone
 * signs in with, and changing it is an authentication operation rather than a
 * preference. It is shown because people forget which address they used.
 *
 * Notifications appear as an honest "not built yet" rather than a switch that
 * writes a column nothing reads. A toggle that does nothing is worse than no
 * toggle, because someone will turn it on and then trust it.
 */
export default function Settings() {
  const { session, profile, signOut } = useSession();
  const toast = useToast();

  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);

    const result = await deleteAccount();

    if (!result.ok) {
      setPending(false);
      setConfirming(false);
      toast.show(result.message, "danger");
      return;
    }

    await signOut();
    router.replace(routes.signIn);
  }

  return (
    <Screen>
      <Text variant="eyebrow" tone="subtle">
        Account
      </Text>
      <Card style={{ marginTop: space.md }}>
        <Detail label="Email" value={session?.user.email ?? "Not set"} />
        <Divider style={{ marginVertical: space.lg }} />
        <Detail
          label="Signed in with"
          value={describeProvider(session?.user.app_metadata?.provider)}
        />
        <Divider style={{ marginVertical: space.lg }} />
        <Detail
          label="Member since"
          value={
            session?.user.created_at
              ? new Date(session.user.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"
          }
        />
      </Card>

      <Text variant="eyebrow" tone="subtle" style={{ marginTop: space.section }}>
        Notifications
      </Text>
      <Card tone="sand" style={{ marginTop: space.md }}>
        <View style={{ flexDirection: "row", gap: space.lg }}>
          <Ionicons
            name="notifications-off-outline"
            size={iconSize.lg}
            color={colors.inkMuted}
          />
          <View style={{ flex: 1 }}>
            <Text variant="label">Not built yet</Text>
            <Text variant="bodySm" tone="muted" style={{ marginTop: space.xxs }}>
              Eraya does not send push notifications at all, so there is nothing
              here to turn off. We would rather show you this than a switch that
              does nothing.
            </Text>
          </View>
        </View>
      </Card>

      <Text variant="eyebrow" tone="subtle" style={{ marginTop: space.section }}>
        Leaving Eraya
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: space.md }}>
        You can delete your account at any time. It is yours, and you should not
        have to ask us for it back.
      </Text>

      <Button
        label="Delete my account"
        variant="danger"
        onPress={() => setConfirming(true)}
        style={{ marginTop: space.lg }}
      />

      <ConfirmSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title="Delete your account?"
        body={`This removes everything Eraya holds about you${profile?.firstName ? `, ${profile.firstName}` : ""}. It happens immediately and cannot be undone.`}
        points={[
          "Your profile, your answers and your photos.",
          "Every connection you have made.",
          "Every conversation — including for the people you were talking to.",
          "There is no grace period, and we cannot restore it afterwards.",
        ]}
        cancelLabel="Keep my account"
        confirmLabel="Delete everything"
        destructive
        pending={pending}
        onConfirm={() => void remove()}
      />
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="labelSm" tone="subtle">
        {label}
      </Text>
      <Text variant="body" style={{ marginTop: space.xxs }}>
        {value}
      </Text>
    </View>
  );
}

function describeProvider(provider: string | undefined): string {
  switch (provider) {
    case "google":
      return "Google";
    case "facebook":
      return "Facebook";
    case "apple":
      return "Apple";
    case "email":
      return "An emailed link";
    default:
      return "An emailed link";
  }
}
