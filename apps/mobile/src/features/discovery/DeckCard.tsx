import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { PhotoOrMonogram } from "@/features/discovery/MemberCard";
import { relationshipLabels } from "@/features/auth/types";
import type { Member } from "@/features/members/types";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { TrustMarks } from "@/ui/Person";
import { Chip } from "@/ui/Selection";
import { Text } from "@/ui/Text";

/**
 * One person, filling the screen.
 *
 * The list card in `MemberCard` is a row in something you scroll; this is the
 * whole screen, and the difference is the point. A deck asks one question at a
 * time and will not let the next person be compared against this one at a
 * glance, which is a slower way to look at somebody even though the gesture is
 * borrowed from products that are anything but.
 *
 * The photo takes the height it can and the words sit over the foot of it. The
 * scrim is a gradient rather than a bar, so the part of the picture the person
 * chose is still visible behind their own name.
 *
 * Their own words are here rather than only on the profile. Deciding from a face
 * alone is the thing this product exists to avoid, so three lines of `about` are
 * on the card itself, and the profile is one tap away for the rest.
 */
export function DeckCard({
  member,
  photoUrl,
  context,
}: {
  member: Member;
  photoUrl?: string | null;
  /** A short line explaining why this person is here, when there is one. */
  context?: string;
}) {
  const chapter = member.relationshipStatus
    ? relationshipLabels[member.relationshipStatus]
    : null;

  return (
    <View
      style={{
        flex: 1,
        borderRadius: radius.xxl,
        overflow: "hidden",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <PhotoOrMonogram name={member.firstName} photoUrl={photoUrl} />

      <LinearGradient
        colors={[
          "transparent",
          "rgba(26,18,14,0.10)",
          "rgba(26,18,14,0.72)",
          "rgba(26,18,14,0.92)",
        ]}
        locations={[0, 0.4, 0.78, 1]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "flex-end",
          paddingHorizontal: space.xl,
          paddingTop: space.region,
          paddingBottom: space.xl,
          gap: space.sm,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: space.md,
          }}
        >
          <Text
            variant="display"
            numberOfLines={1}
            style={{ fontSize: 30, lineHeight: 36, color: "#FFFFFF", flexShrink: 1 }}
          >
            {member.firstName}
            {member.age ? (
              <Text
                variant="display"
                style={{
                  fontSize: 30,
                  lineHeight: 36,
                  color: "rgba(255,255,255,0.82)",
                }}
              >
                , {member.age}
              </Text>
            ) : null}
          </Text>

          <TrustMarks emailVerified={member.emailVerified} onDark />
        </View>

        {member.city ? (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}
          >
            <Ionicons
              name="location-outline"
              size={iconSize.sm}
              color="rgba(255,255,255,0.9)"
            />
            <Text
              variant="bodySm"
              numberOfLines={1}
              style={{ color: "rgba(255,255,255,0.9)", flexShrink: 1 }}
            >
              {member.city}
              {member.state ? `, ${member.state}` : ""}
            </Text>
          </View>
        ) : null}

        {chapter ? (
          <View style={{ flexDirection: "row" }}>
            <Chip label={chapter} tone="quiet" />
          </View>
        ) : null}

        {member.about ? (
          <Text
            variant="bodySm"
            numberOfLines={3}
            style={{ color: "rgba(255,255,255,0.92)", marginTop: space.xxs }}
          >
            {member.about}
          </Text>
        ) : null}

        {context ? (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}
          >
            <Ionicons name="sparkles-outline" size={iconSize.sm} color={colors.emberTint} />
            <Text
              variant="caption"
              numberOfLines={1}
              style={{ color: colors.emberTint, flexShrink: 1 }}
            >
              {context}
            </Text>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}
