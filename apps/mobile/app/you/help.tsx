import { Linking, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, iconSize, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Card } from "@/ui/Surface";
import { Text } from "@/ui/Text";

/**
 * Safety and help.
 *
 * Practical advice rather than reassurance. Everyone reading this is meeting
 * strangers, and the honest version of safety is a few specific things to do --
 * not a paragraph about how much we care.
 *
 * It also says plainly what Eraya cannot do. There is no moderation team, so
 * telling somebody their report will be reviewed would be worse than useless: it
 * would stop them taking the step that actually protects them.
 */
const ADVICE = [
  {
    icon: "chatbubbles-outline",
    title: "Take your time in the conversation",
    body: "There is no hurry here and nobody is counting. Somebody pushing to move to another app or to meet immediately is telling you something.",
  },
  {
    icon: "cafe-outline",
    title: "Meet somewhere public, the first few times",
    body: "A café in the middle of the afternoon. Tell someone you trust where you are going and when you expect to be back.",
  },
  {
    icon: "wallet-outline",
    title: "Never send money",
    body: "No genuine person you met here will ask. An emergency that needs a transfer today is the oldest pattern there is.",
  },
  {
    icon: "hand-left-outline",
    title: "Block without explaining yourself",
    body: "You owe nobody a reason. Blocking is immediate, it is enforced by Eraya rather than hidden from view, and they are never told.",
  },
] as const;

export default function Help() {
  return (
    <Screen>
      <Text variant="title">Staying safe</Text>

      <View style={{ marginTop: space.xl, gap: space.md }}>
        {ADVICE.map((item) => (
          <Card key={item.title}>
            <View style={{ flexDirection: "row", gap: space.lg }}>
              <Ionicons
                name={item.icon}
                size={iconSize.lg}
                color={colors.emberText}
              />
              <View style={{ flex: 1 }}>
                <Text variant="label">{item.title}</Text>
                <Text
                  variant="bodySm"
                  tone="muted"
                  style={{ marginTop: space.xxs }}
                >
                  {item.body}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <Card tone="sand" style={{ marginTop: space.section }}>
        <Text variant="label">What Eraya can and cannot do</Text>
        <Text variant="bodySm" tone="muted" style={{ marginTop: space.sm }}>
          Blocking works immediately and is enforced by the system. Reports are
          recorded, but Eraya is small and has no moderation team yet, so we
          cannot promise that anyone will read one or reply to you. If something
          serious happens, please contact the police as well as us.
        </Text>
      </Card>

      <Text variant="eyebrow" tone="subtle" style={{ marginTop: space.section }}>
        Contact
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: space.sm }}>
        A person reads this address.
      </Text>
      <Button
        label="Write to hello@eraya.app"
        variant="secondary"
        onPress={() => void Linking.openURL("mailto:hello@eraya.app")}
        style={{ marginTop: space.lg }}
      />
    </Screen>
  );
}
