import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { relationshipLabels } from "@/features/auth/types";
import { photoUrlFor } from "@/features/members/data";
import { useMyDetails } from "@/features/members/me";
import { useEntitlements } from "@/features/membership/entitlements";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { Avatar } from "@/ui/Person";
import { Screen } from "@/ui/Screen";
import { Card, Divider } from "@/ui/Surface";
import { Text } from "@/ui/Text";

/**
 * You.
 *
 * The account area, and the one place where everything about a person's own
 * relationship with Eraya lives: their profile, what they are paying, what is
 * private, and how to leave.
 *
 * Logging out is a visible row on this screen, not a setting three levels down.
 * A product that makes leaving hard is telling you what it thinks of you, and
 * this one should not.
 */
export default function You() {
  const { profile } = useSession();
  const { details } = useMyDetails();
  const { entitlements } = useEntitlements();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void photoUrlFor(details.photoPaths[0] ?? null).then((url) => {
        if (active) setPhotoUrl(url);
      });
      return () => {
        active = false;
      };
    }, [details.photoPaths]),
  );

  const age = profile?.dateOfBirth ? ageFrom(profile.dateOfBirth) : null;

  return (
    <Screen topInset>
      <Text variant="title">You</Text>

      <Card
        onPress={() => router.push("/you/profile")}
        accessibilityLabel="Your profile. Opens what other members see."
        style={{ marginTop: space.xxl }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}
        >
          <Avatar
            name={profile?.firstName ?? "You"}
            photoUrl={photoUrl}
            size="lg"
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="title" numberOfLines={1} style={{ fontSize: 21 }}>
              {profile?.firstName ?? "Your profile"}
            </Text>
            <Text variant="bodySm" tone="muted" numberOfLines={1}>
              {[age, details.cityName].filter(Boolean).join("  ·  ") ||
                "Tap to see your profile"}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={iconSize.md}
            color={colors.inkSubtle}
          />
        </View>
      </Card>

      <Group title="Your profile">
        <Row
          icon="create-outline"
          label="Edit profile"
          hint="Your words, city, languages"
          onPress={() => router.push("/you/edit")}
        />
        <Row
          icon="images-outline"
          label="Photos"
          hint={
            details.photoPaths.length === 0
              ? "None yet — optional"
              : details.photoPaths.length === 1
                ? "1 photo"
                : `${details.photoPaths.length} photos`
          }
          onPress={() => router.push("/you/photos")}
        />
        <Row
          icon="shield-checkmark-outline"
          label="Verification"
          hint={profile?.emailVerified ? "Email verified" : "Not yet verified"}
          onPress={() => router.push("/you/verification")}
        />
      </Group>

      <Group title="Membership">
        <Row
          icon="star-outline"
          label={entitlements.tier === "premium" ? "Eraya Premium" : "Membership"}
          hint={
            entitlements.tier === "premium"
              ? "Active"
              : "See what premium adds"
          }
          onPress={() => router.push("/you/membership")}
        />
      </Group>

      <Group title="Privacy and safety">
        <Row
          icon="lock-closed-outline"
          label="Privacy"
          hint="What others can see"
          onPress={() => router.push("/you/privacy")}
        />
        <Row
          icon="hand-left-outline"
          label="Blocked people"
          onPress={() => router.push("/you/blocked")}
        />
        <Row
          icon="help-buoy-outline"
          label="Safety and help"
          onPress={() => router.push("/you/help")}
        />
      </Group>

      <Group title="Account" last>
        <Row
          icon="settings-outline"
          label="Settings"
          onPress={() => router.push("/you/settings")}
        />
        <Row
          icon="log-out-outline"
          label="Log out"
          onPress={() => router.push("/you/logout")}
          tone="danger"
        />
      </Group>

      <Text
        variant="caption"
        tone="subtle"
        center
        style={{ marginTop: space.region }}
      >
        Eraya · A Phoenix Origins product
      </Text>
    </Screen>
  );
}

function Group({
  title,
  children,
  last = false,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const rows = Array.isArray(children) ? children : [children];

  return (
    <View style={{ marginTop: space.section, marginBottom: last ? space.lg : 0 }}>
      <Text variant="eyebrow" tone="subtle" style={{ marginBottom: space.md }}>
        {title}
      </Text>
      <Card padded={false}>
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 ? <Divider inset={space.xl + iconSize.md + space.lg} /> : null}
            {row}
          </View>
        ))}
      </Card>
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
  onPress,
  tone = "default",
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  hint?: string;
  onPress: () => void;
  tone?: "default" | "danger";
}) {
  const color = tone === "danger" ? colors.danger : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: hit.large,
        flexDirection: "row",
        alignItems: "center",
        gap: space.lg,
        paddingHorizontal: space.xl,
        paddingVertical: space.lg,
        borderRadius: radius.xl,
        backgroundColor: pressed ? colors.sand : "transparent",
      })}
    >
      <Ionicons name={icon} size={iconSize.md} color={color} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" style={{ color }}>
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {tone === "default" ? (
        <Ionicons
          name="chevron-forward"
          size={iconSize.md}
          color={colors.inkSubtle}
        />
      ) : null}
    </Pressable>
  );
}

function ageFrom(isoDate: string): number | null {
  const born = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;

  const today = new Date();
  let years = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) {
    years -= 1;
  }

  return years;
}
