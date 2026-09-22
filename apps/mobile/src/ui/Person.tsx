import { useState } from "react";
import { View, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { useT } from "@/features/i18n/LocaleProvider";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * How a person is shown before you know them.
 *
 * Two rules run through everything here.
 *
 * A photo is optional and a monogram is not a fallback for a failure -- it is
 * the normal state. Eraya's members are people who have had a hard few years and
 * many of them will not want a face on a screen straight away, so a profile
 * without a photo has to look considered rather than incomplete. The monogram is
 * tinted deterministically from the name, so the same person is the same colour
 * everywhere in the app and you begin to recognise them before you read the
 * name.
 *
 * A badge is only ever shown for something actually checked. There is no
 * identity verification, no profile review, and phone verification is still
 * mocked -- so none of those appear, whatever the database column says. A trust
 * mark that runs ahead of the system is worse than no trust mark at all, because
 * the person relying on it is a stranger deciding whether to meet someone.
 */

/** Warm, low-saturation grounds drawn from the palette. */
const monogramTones = [
  { bg: colors.emberTint, fg: colors.emberText },
  { bg: colors.sandDeep, fg: colors.brandBrown },
  { bg: "#E9EFE9", fg: colors.positive },
  { bg: "#EFE7DC", fg: colors.inkMuted },
  { bg: "#F1E3DA", fg: colors.brandBrown },
] as const;

function toneFor(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return monogramTones[sum % monogramTones.length]!;
}

export type AvatarSize = "sm" | "md" | "lg" | "xl";

const avatarPx: Record<AvatarSize, number> = {
  sm: 40,
  md: 52,
  lg: 68,
  xl: 92,
};

export function Avatar({
  name,
  photoUrl,
  size = "md",
  style,
}: {
  name: string;
  /** Absent for most members, which is expected rather than exceptional. */
  photoUrl?: string | null;
  size?: AvatarSize;
  style?: ViewStyle & ImageStyle;
}) {
  const [failed, setFailed] = useState(false);
  const px = avatarPx[size];
  const tone = toneFor(name);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  // Typed as both: the same object styles an Image when there is a photo and a
  // View when there is not, and RN's two style types disagree about `overflow`.
  const shape: ViewStyle & ImageStyle = {
    width: px,
    height: px,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  if (photoUrl && !failed) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[shape, { backgroundColor: tone.bg }, style]}
        contentFit="cover"
        // Cached on disk and in memory: a list of connections re-renders often
        // and should never re-download the same faces.
        cachePolicy="memory-disk"
        transition={160}
        onError={() => setFailed(true)}
        accessibilityLabel={`${name}'s photo`}
      />
    );
  }

  return (
    <View
      style={[shape, { backgroundColor: tone.bg }, style]}
      accessible
      accessibilityLabel={name}
    >
      <Text
        style={{
          fontSize: px * 0.4,
          lineHeight: px * 0.5,
          color: tone.fg,
        }}
        variant="headline"
      >
        {initial}
      </Text>
    </View>
  );
}

/**
 * The large photo on a profile.
 *
 * 4:5 rather than square or 16:9 -- it is the aspect a portrait is usually taken
 * in, so it crops least. When there is no photo the same area is filled with the
 * monogram tint and a quiet line saying so, which is honest and looks deliberate
 * rather than like a broken image.
 */
export function ProfilePhoto({
  name,
  photoUrl,
  style,
}: {
  name: string;
  photoUrl?: string | null;
  style?: ViewStyle & ImageStyle;
}) {
  const [failed, setFailed] = useState(false);
  const tone = toneFor(name);

  if (photoUrl && !failed) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[
          { width: "100%", aspectRatio: 4 / 5, borderRadius: radius.xl },
          style,
        ]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        onError={() => setFailed(true)}
        accessibilityLabel={`${name}'s photo`}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: "100%",
          aspectRatio: 4 / 5,
          borderRadius: radius.xl,
          backgroundColor: tone.bg,
          alignItems: "center",
          justifyContent: "center",
          gap: space.md,
        },
        style,
      ]}
      accessible
      accessibilityLabel={`${name} has not added a photo`}
    >
      <Text style={{ fontSize: 64, lineHeight: 76, color: tone.fg }} variant="display">
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
      <Text variant="bodySm" tone="muted">
        No photo yet
      </Text>
    </View>
  );
}

/**
 * What Eraya can actually vouch for.
 *
 * Phone was deliberately absent while verification was mocked -- any six digits
 * were accepted and no SMS was sent, so a "phone verified" mark would have been
 * a safety claim the system could not support, shown to a stranger deciding
 * whether to meet somebody. It is here now because the claim is now true, and
 * it rests on `phoneVerified` from `member_card`, which the database builds
 * with `phone_is_verified()` -- so it requires `phone_verified_via = 'msg91'`
 * and the accounts the stand-in marked still do not qualify.
 *
 * Absence says nothing. Verification is optional and a member may decline it
 * for perfectly good reasons, so there is no "phone unverified" and no empty
 * slot where a mark would be: what is shown is what has been checked, and
 * nothing at all is implied about the rest.
 *
 * Neither mark says "verified profile" or "verified member". Eraya has checked
 * a mailbox and sometimes a handset. It has not checked a person, and no
 * wording here may let a reader believe otherwise.
 */
export function TrustMarks({
  emailVerified,
  phoneVerified = false,
  style,
  /** Set when the mark sits over a photograph rather than on a page. */
  onDark = false,
}: {
  emailVerified: boolean;
  phoneVerified?: boolean;
  style?: ViewStyle;
  onDark?: boolean;
}) {
  const t = useT();

  const marks: string[] = [];
  if (emailVerified) marks.push(t("common.emailVerified"));
  if (phoneVerified) marks.push(t("common.phoneVerified"));

  if (marks.length === 0) return null;

  const tone = onDark ? colors.positiveOnDark : colors.positive;

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: space.md,
        },
        style,
      ]}
    >
      {marks.map((mark) => (
        <View
          key={mark}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.xs,
          }}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={iconSize.sm}
            color={tone}
          />
          <Text variant="caption" style={{ color: tone }}>
            {mark}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The one-line summary of a person: age, city, chapter.
 *
 * Composed here rather than in each screen so the order and the separator are
 * the same on a discovery card, a connection row and a profile header.
 */
export function PersonSummary({
  age,
  city,
  state,
  relationship,
  numberOfLines = 1,
  style,
}: {
  age: number | null;
  city: string | null;
  state?: string | null;
  relationship?: string | null;
  numberOfLines?: number;
  // Styles a Text, not a View -- the two disagree about `userSelect`.
  style?: TextStyle;
}) {
  const parts = [
    age ? `${age}` : null,
    city ? (state ? `${city}, ${state}` : city) : null,
    relationship,
  ].filter(Boolean);

  if (!parts.length) return null;

  return (
    <Text
      variant="bodySm"
      tone="muted"
      numberOfLines={numberOfLines}
      style={style}
    >
      {parts.join("  ·  ")}
    </Text>
  );
}
