import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Member } from "@/features/members/types";
import { relationshipLabels } from "@/features/auth/types";
import { colors, iconSize, space } from "@/theme/tokens";
import { Avatar, PersonSummary, TrustMarks } from "@/ui/Person";
import { Card } from "@/ui/Surface";
import { Chip, ChipGroup } from "@/ui/Selection";
import { Text } from "@/ui/Text";

/**
 * A person, in a list.
 *
 * The brief for this card was to say who someone is, roughly where they are and
 * what Eraya can vouch for, without opening a profile -- and without reducing
 * them to an item in a catalogue. Two decisions follow from the second half of
 * that.
 *
 * There is no like button on the card. Deciding about a person from a thumbnail
 * and a row of facts is exactly the interaction Eraya exists to avoid; interest
 * is expressed on the profile, after reading it. The whole card is one control,
 * and it does one thing: opens them.
 *
 * The photo is a portrait beside the text rather than a full-bleed image behind
 * it. A photo that fills the card makes the picture the content and everything
 * else a caption, which is how a product ends up ranking people by appearance
 * whatever its ordering says.
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

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${member.firstName}, ${member.age ?? "age unknown"}, ${member.city ?? "city unknown"}. Opens their profile.`}
      padded={false}
      style={{ padding: space.xl }}
    >
      <View style={{ flexDirection: "row", gap: space.lg }}>
        <Avatar name={member.firstName} photoUrl={photoUrl} size="xl" />

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="title" numberOfLines={1} style={{ fontSize: 21 }}>
            {member.firstName}
          </Text>

          <PersonSummary
            age={member.age}
            city={member.city}
            state={member.state}
            relationship={
              member.relationshipStatus
                ? relationshipLabels[member.relationshipStatus]
                : null
            }
            numberOfLines={2}
            style={{ marginTop: space.xs }}
          />

          <TrustMarks
            emailVerified={member.emailVerified}
            style={{ marginTop: space.sm }}
          />
        </View>
      </View>

      {/*
        A line or two of their own words, if they wrote any. This is what stops
        the card being a specification -- and why `about` was added to the
        profile at all.
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
    </Card>
  );
}

/**
 * What the two people have in common, said plainly.
 *
 * Only ever computed from facts both have already shared -- a city, a language,
 * a chapter. It is not a compatibility score, there is no algorithm behind it,
 * and it never appears when there is nothing true to say.
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
