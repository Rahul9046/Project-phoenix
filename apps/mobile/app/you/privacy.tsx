import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, iconSize, space } from "@/theme/tokens";
import { Screen } from "@/ui/Screen";
import { Card } from "@/ui/Surface";
import { Text } from "@/ui/Text";

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
  "You are introduced to a few people at a time, and appear in theirs. There is no directory and no way to search for you.",
  "Another member sees your first name, age, city, chapter, languages, and whatever you have written about yourself.",
  "Your exact date of birth is never shown — only your age.",
  "Your email address and phone number are never shown to anyone.",
  "If someone passes on your profile, you are never told. If you pass on theirs, they are never told.",
  "Nobody can message you unless you have both expressed interest.",
  "Nobody is told when you last opened a conversation, or whether you have read a message.",
  "Blocking is enforced by Eraya, not just hidden from view — a blocked person cannot load your profile or your photos.",
];

export default function Privacy() {
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
                {point}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card tone="sand" style={{ marginTop: space.xl }}>
        <Text variant="label">Still being built</Text>
        <Text variant="bodySm" tone="muted" style={{ marginTop: space.sm }}>
          Choosing who can see your photos, and browsing without appearing in
          anyone{"\u2019"}s viewers, are both designed and not yet built. We will
          say so here rather than implying they already work.
        </Text>
      </Card>
    </Screen>
  );
}
