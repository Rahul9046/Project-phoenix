import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { routes } from "@/features/auth/routing";
import { colors, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/**
 * Logging out.
 *
 * A screen rather than a menu item that acts immediately, because an accidental
 * logout on a passwordless account means waiting for another email -- a small
 * thing that feels like being locked out.
 *
 * It says what does and does not happen. "Log out" and "delete my account" sound
 * similar to somebody who is upset, and the difference between them is
 * everything.
 */
export default function Logout() {
  const { signOut } = useSession();
  const [pending, setPending] = useState(false);

  async function leave() {
    setPending(true);
    await signOut();
    // Replace rather than push: there is no signed-in screen to go back to.
    router.replace(routes.signIn);
  }

  return (
    <Screen contentStyle={{ flexGrow: 1, justifyContent: "center" }}>
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: 68,
            height: 68,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.sand,
          }}
        >
          <Ionicons
            name="log-out-outline"
            size={28}
            color={colors.inkMuted}
          />
        </View>

        <Text variant="title" center style={{ marginTop: space.xxl }}>
          Log out of Eraya?
        </Text>
        <Text
          variant="body"
          tone="muted"
          center
          style={{ marginTop: space.md, maxWidth: 320 }}
        >
          Your profile, connections and conversations all stay exactly as they
          are. Nothing is deleted, and you can sign back in whenever you like.
        </Text>
      </View>

      <View style={{ marginTop: space.region, gap: space.md }}>
        <Button
          label="Stay signed in"
          variant="secondary"
          disabled={pending}
          onPress={() => router.back()}
        />
        <Button
          label="Log out"
          variant="danger"
          loading={pending}
          onPress={() => void leave()}
        />
      </View>
    </Screen>
  );
}
