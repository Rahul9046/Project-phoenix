import { Linking, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, iconSize, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Card } from "@/ui/Surface";
import { Text } from "@/ui/Text";
import { useT } from "@/features/i18n/LocaleProvider";
import type { TranslationKey } from "@eraya/i18n";

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
    title: "help.takeTimeTitle",
    body: "help.takeTimeBody",
  },
  {
    icon: "cafe-outline",
    title: "help.meetPublicTitle",
    body: "help.meetPublicBody",
  },
  {
    icon: "wallet-outline",
    title: "help.neverSendMoneyTitle",
    body: "help.neverSendMoneyBody",
  },
  {
    icon: "hand-left-outline",
    title: "help.blockTitle",
    body: "help.blockBody",
  },
] as const satisfies readonly {
  icon: string;
  title: TranslationKey;
  body: TranslationKey;
}[];

export default function Help() {
  const t = useT();
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
                <Text variant="label">{t(item.title)}</Text>
                <Text
                  variant="bodySm"
                  tone="muted"
                  style={{ marginTop: space.xxs }}
                >
                  {t(item.body)}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <Card tone="sand" style={{ marginTop: space.section }}>
        <Text variant="label">{t("help.limitsTitle")}</Text>
        <Text variant="bodySm" tone="muted" style={{ marginTop: space.sm }}>
          {t("help.limitsBody")}
        </Text>
      </Card>

      <Text variant="eyebrow" tone="subtle" style={{ marginTop: space.section }}>
        Contact
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: space.sm }}>
        A person reads this address.
      </Text>
      <Button
        label="Write to support@eraya.app"
        variant="secondary"
        onPress={() => void Linking.openURL("mailto:support@eraya.app")}
        style={{ marginTop: space.lg }}
      />
    </Screen>
  );
}
