import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import type { Member } from "@/features/members/types";
import { relationshipLabels } from "@/features/auth/types";
import { colors, iconSize, space } from "@/theme/tokens";
import { TrustMarks } from "@/ui/Person";
import { Card } from "@/ui/Surface";
import { Chip, ChipGroup } from "@/ui/Selection";
import { Text } from "@/ui/Text";

/**
 * A person, in a list.
 *
 * Photo-forward: a large portrait with the name and age set over the foot of it,
 * and the supporting detail beneath. The previous version put a small avatar
 * beside a column of facts, which read as a database row and looked unfinished
 * -- especially with no photo, which was every member until photos were seeded.
 *
 * Two things it still deliberately does not do, because they are the difference
 * between this and the products it now resembles:
 *
 * There is no like or pass control on the card. Deciding about a person from a
 * thumbnail is the interaction Eraya exists to avoid; the whole card is one
 * control and it opens their profile, where the decision is made after their own
 * words have been read.
 *
 * Nothing swipes. The list runs out.
 *
 * The photo is a fixed 4:5 portrait rather than filling the card to the screen's
 * height. A full-bleed image with a name at the bottom is a deck of cards to be
 * dealt through; this is a card in a list you scroll, which is a different
 * gesture and a different frame of mind.
 */
export function MemberCard({
  member,
  photoUrl,
  onPress,
  /** A short line explaining why this person is here, when there is one. */
  context,
}: {
  member: Member;
  photoUrl?: string | null;
  onPress: () => void;
  context?: string;
}) {
  const languages = member.languages.slice(0, 3);
  const moreLanguages = member.languages.length - languages.length;
  const chapter = member.relationshipStatus
    ? relationshipLabels[member.relationshipStatus]
    : null;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${member.firstName}, ${member.age ?? "age unknown"}, ${member.city ?? "city unknown"}. Opens their profile.`}
      padded={false}
    >
      <View style={{ width: "100%", aspectRatio: 4 / 5 }}>
        <PhotoOrMonogram name={member.firstName} photoUrl={photoUrl} />

        {/*
          A scrim, not a slab. The name has to stay legible over whatever the
          photo happens to be, and a flat black bar would hide the part of the
          picture people actually chose.
        */}
        <LinearGradient
          colors={["transparent", "rgba(26,18,14,0.05)", "rgba(26,18,14,0.78)"]}
          locations={[0, 0.45, 1]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "55%",
            justifyContent: "flex-end",
            padding: space.xl,
          }}
        >
          <Text
            variant="display"
            numberOfLines={1}
            style={{ fontSize: 27, lineHeight: 33, color: "#FFFFFF" }}
          >
            {member.firstName}
            {member.age ? (
              <Text
                variant="display"
                style={{
                  fontSize: 27,
                  lineHeight: 33,
                  color: "rgba(255,255,255,0.82)",
                }}
              >
                , {member.age}
              </Text>
            ) : null}
          </Text>

          {member.city ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.xs,
                marginTop: space.xxs,
              }}
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
        </LinearGradient>
      </View>

      <View style={{ padding: space.xl }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.md,
          }}
        >
          {chapter ? <Chip label={chapter} tone="quiet" /> : <View />}
          <TrustMarks emailVerified={member.emailVerified} />
        </View>

        {/*
          A line or two of their own words. This is what stops the card being a
          specification, and why `about` was added to the profile at all.
        */}
        {member.about ? (
          <Text
            variant="bodySm"
            tone="muted"
            numberOfLines={3}
            style={{ marginTop: space.lg }}
          >
            {member.about}
          </Text>
        ) : null}

        {languages.length > 0 ? (
          <ChipGroup style={{ marginTop: space.lg }}>
            {languages.map((language) => (
              <Chip key={language} label={language} tone="quiet" />
            ))}
            {moreLanguages > 0 ? (
              <Chip label={`+${moreLanguages}`} tone="quiet" />
            ) : null}
          </ChipGroup>
        ) : null}

        {context ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              marginTop: space.lg,
            }}
          >
            <Ionicons
              name="sparkles-outline"
              size={iconSize.sm}
              color={colors.emberText}
            />
            <Text variant="caption" tone="accent" style={{ flex: 1 }}>
              {context}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: space.xs,
            marginTop: space.lg,
          }}
        >
          <Text variant="labelSm" tone="accent">
            View profile
          </Text>
          <Ionicons
            name="chevron-forward"
            size={iconSize.sm}
            color={colors.emberText}
          />
        </View>
      </View>
    </Card>
  );
}

/**
 * The picture, or a considered stand-in for it.
 *
 * A monogram on a warm ground rather than a grey silhouette. Plenty of members
 * here will not want a face on a screen for a long time, and the card has to
 * look deliberate for them rather than broken.
 */
export function PhotoOrMonogram({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl?: string | null;
}) {
  /*
   * Absolutely filled, not `height: "100%"`.
   *
   * The parent sizes itself from `aspectRatio`, so its height is derived rather
   * than declared -- and a percentage height against a derived height does not
   * resolve. The image loaded, reported its natural 1200x1500, and drew at zero
   * height: a blank card with a working photo behind it. Filling the parent's
   * box directly does not depend on how that box got its size.
   */
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={180}
        accessibilityLabel={`${name}'s photo`}
      />
    );
  }

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: colors.sandDeep,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <Text
        variant="display"
        style={{ fontSize: 76, lineHeight: 90, color: colors.brandBrown }}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

/**
 * What the two people have in common, said plainly.
 *
 * Only ever computed from facts both have already shared -- a city, a language.
 * It is not a compatibility score, there is no algorithm behind it, and it never
 * appears when there is nothing true to say.
 */
export function contextFor(
  member: Member,
  me: { cityId?: string | null; city?: string | null; languages?: string[] },
): string | undefined {
  const shared: string[] = [];

  if (me.city && member.city && me.city === member.city) {
    shared.push(`also in ${member.city}`);
  }

  const commonLanguages = (me.languages ?? []).filter((language) =>
    member.languages.includes(language),
  );
  if (commonLanguages.length > 0) {
    shared.push(`speaks ${commonLanguages.slice(0, 2).join(" and ")}`);
  }

  if (shared.length === 0) return undefined;

  const sentence = shared.join(", ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
