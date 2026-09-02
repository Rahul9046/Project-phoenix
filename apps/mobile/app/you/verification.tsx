import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { phoneVerificationIsLive } from "@/features/onboarding/phone";
import { colors, iconSize, space } from "@/theme/tokens";
import { Screen } from "@/ui/Screen";
import { Card, Divider } from "@/ui/Surface";
import { Text } from "@/ui/Text";

/**
 * What Eraya has actually checked.
 *
 * The important rule on this screen is that nothing claims a check that has not
 * happened. Phone shows as "added", not "verified", because no SMS is sent and
 * any six digits are accepted -- and no other member is shown a phone badge at
 * all. Identity and relationship-status verification do not exist, so they are
 * listed as not available rather than as pending, which would imply a queue.
 *
 * A verification badge for something unverified is the worst thing this product
 * could ship: the person relying on it is a stranger deciding whether to meet
 * someone.
 */
type Line = {
  label: string;
  state: "done" | "partial" | "absent";
  detail: string;
};

export default function Verification() {
  const { profile } = useSession();

  const lines: Line[] = [
    {
      label: "Email address",
      state: profile?.emailVerified ? "done" : "absent",
      detail: profile?.emailVerified
        ? "Confirmed. Other members can see this."
        : "Enter the code we sent to confirm your address.",
    },
    {
      label: "Phone number",
      state: profile?.phoneVerifiedAt
        ? phoneVerificationIsLive
          ? "done"
          : "partial"
        : "absent",
      detail: phoneVerificationIsLive
        ? "Confirmed by SMS."
        : "Added, but not verified — checking numbers by SMS is not switched on yet. No member is told your number is verified.",
    },
    {
      label: "Identity",
      state: "absent",
      detail: "Eraya does not verify identity documents. Nobody here has been checked against one.",
    },
    {
      label: "Relationship status",
      state: "absent",
      detail: "Taken on trust, from you and from everyone else. There is no way for us to confirm it.",
    },
  ];

  return (
    <Screen>
      <Text variant="body" tone="muted">
        Eraya only shows a badge for something it has genuinely checked. Where it
        has not, it says so.
      </Text>

      <Card style={{ marginTop: space.xl }} padded={false}>
        {lines.map((line, index) => (
          <View key={line.label}>
            {index > 0 ? <Divider /> : null}
            <View
              style={{
                flexDirection: "row",
                gap: space.lg,
                padding: space.xl,
                alignItems: "flex-start",
              }}
            >
              <Ionicons
                name={
                  line.state === "done"
                    ? "shield-checkmark"
                    : line.state === "partial"
                      ? "shield-outline"
                      : "ellipse-outline"
                }
                size={iconSize.lg}
                color={
                  line.state === "done"
                    ? colors.positive
                    : line.state === "partial"
                      ? colors.inkMuted
                      : colors.lineStrong
                }
              />
              <View style={{ flex: 1 }}>
                <Text variant="label">{line.label}</Text>
                <Text
                  variant="bodySm"
                  tone="muted"
                  style={{ marginTop: space.xxs }}
                >
                  {line.detail}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
