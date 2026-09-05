import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { relationshipLabels } from "@/features/auth/types";
import { photoUrlFor } from "@/features/members/data";
import { useMyDetails } from "@/features/members/me";
import { colors, iconSize, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { ProfilePhoto, TrustMarks } from "@/ui/Person";
import { Screen } from "@/ui/Screen";
import { Chip, ChipGroup } from "@/ui/Selection";
import { Card, Divider } from "@/ui/Surface";
import { Text } from "@/ui/Text";

/**
 * Your profile, as another member sees it.
 *
 * A preview rather than a second editor. The thing people actually want to know
 * is "what does this look like to someone else", and answering it with the same
 * components the discovery screen uses means the answer cannot drift from the
 * truth.
 *
 * The banner at the top says what is deliberately not here -- the email address,
 * the phone number, the exact date of birth -- because that reassurance is worth
 * more than another row of the same information.
 */
export default function MyProfile() {
  const { profile } = useSession();
  const { details } = useMyDetails();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  /*
   * Cancellation on unmount, and on any change that starts a newer fetch.
   * Without it a slow response can land after the screen has gone, or after a
   * newer one for different data -- both of which write state that is no longer
   * true.
   */
  useEffect(() => {
    let active = true;

    void photoUrlFor(details.photoPaths[0] ?? null).then((url) => {
      if (active) setPhotoUrl(url);
    });

    return () => {
      active = false;
    };
  }, [details.photoPaths]);

  const age = profile?.dateOfBirth ? ageFrom(profile.dateOfBirth) : null;

  return (
    <Screen>
      <Card tone="sand" padded={false} style={{ padding: space.lg }}>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <Ionicons
            name="eye-outline"
            size={iconSize.md}
            color={colors.inkMuted}
          />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            This is everything another member can see. Your email address, your
            phone number and your date of birth are never shown &mdash; only the
            age worked out from it.
          </Text>
        </View>
      </Card>

      <ProfilePhoto
        name={profile?.firstName ?? "You"}
        photoUrl={photoUrl}
        style={{ marginTop: space.xl }}
      />

      <Text variant="display" style={{ marginTop: space.xxl }}>
        {profile?.firstName ?? "You"}
        {age ? (
          <Text variant="display" tone="muted">
            , {age}
          </Text>
        ) : null}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          marginTop: space.sm,
        }}
      >
        <Ionicons
          name="location-outline"
          size={iconSize.sm}
          color={colors.inkSubtle}
        />
        <Text variant="body" tone="muted">
          {[details.cityName, details.stateName].filter(Boolean).join(", ") ||
            "Not set"}
        </Text>
      </View>

      <TrustMarks
        emailVerified={Boolean(profile?.emailVerified)}
        style={{ marginTop: space.md }}
      />

      {details.about ? (
        <View style={{ marginTop: space.section }}>
          <Divider style={{ marginBottom: space.xl }} />
          <Text variant="eyebrow" tone="subtle" style={{ marginBottom: space.md }}>
            About
          </Text>
          <Text variant="body" tone="muted">
            {details.about}
          </Text>
        </View>
      ) : null}

      {details.lookingFor ? (
        <View style={{ marginTop: space.section }}>
          <Divider style={{ marginBottom: space.xl }} />
          <Text variant="eyebrow" tone="subtle" style={{ marginBottom: space.md }}>
            What you are hoping for
          </Text>
          <Text variant="body" tone="muted">
            {details.lookingFor}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: space.section }}>
        <Divider style={{ marginBottom: space.xl }} />
        <Text variant="eyebrow" tone="subtle" style={{ marginBottom: space.md }}>
          Details
        </Text>

        {profile?.relationshipStatus ? (
          <View style={{ marginBottom: space.lg }}>
            <Text variant="labelSm" tone="subtle">
              Chapter
            </Text>
            <Text variant="body" style={{ marginTop: space.xxs }}>
              {relationshipLabels[profile.relationshipStatus]}
            </Text>
          </View>
        ) : null}

        <Text variant="labelSm" tone="subtle">
          Languages
        </Text>
        {details.languageNames.length ? (
          <ChipGroup style={{ marginTop: space.sm }}>
            {details.languageNames.map((language) => (
              <Chip key={language} label={language} tone="quiet" />
            ))}
          </ChipGroup>
        ) : (
          <Text variant="body" tone="subtle" style={{ marginTop: space.xxs }}>
            Prefer not to say
          </Text>
        )}
      </View>

      <Button
        label="Edit profile"
        variant="secondary"
        onPress={() => router.push("/you/edit")}
        style={{ marginTop: space.section }}
      />
    </Screen>
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
