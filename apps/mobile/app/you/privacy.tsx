import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, iconSize, space } from "@/theme/tokens";
import { Screen } from "@/ui/Screen";
import { Card } from "@/ui/Surface";
import { Text } from "@/ui/Text";
import { useT } from "@/features/i18n/LocaleProvider";
import type { TranslationKey } from "@eraya/i18n";

/**
 * What other members can see.
 *
 * Every line is a fact about the system as it stands, not an intention. Each one
 * is enforced by a policy or by the shape of `member_card` -- there is no
 * cross-member read on `profiles`, no directory, and no way to message someone
 * who has not agreed -- which is why they can be stated this plainly.
 *
 * When something here stops being true, this screen changes on the same day.
 */
const POINTS = [
  "account.privacyPoint1",
  "mobileAccount.privacyPointProfileFields",
  "account.privacyPoint3",
  "mobileAccount.privacyPointContact",
  "mobileAccount.privacyPointPassing",
  "account.privacyPoint6",
  "mobileAccount.privacyPointReceipts",
  "mobileAccount.privacyPointBlocking",
] as const satisfies readonly TranslationKey[];

export default function Privacy() {
  const t = useT();
  return (
    <Screen>
      <Text variant="body" tone="muted">
        What follows is what Eraya does today, not what it intends to do.
      </Text>

      <Card style={{ marginTop: space.xl }}>
        <View style={{ gap: space.lg }}>
          {POINTS.map((point) => (
            <View
              key={point}
              style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={iconSize.md}
                color={colors.positive}
                style={{ marginTop: 1 }}
              />
              <Text variant="bodySm" tone="muted" style={{ flex: 1 }}>
                {t(point)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card tone="sand" style={{ marginTop: space.xl }}>
        <Text variant="label">{t("mobileAccount.stillBuildingTitle")}</Text>
        <Text variant="bodySm" tone="muted" style={{ marginTop: space.sm }}>
          {t("mobileAccount.stillBuildingBody")}
        </Text>
      </Card>
    </Screen>
  );
}
