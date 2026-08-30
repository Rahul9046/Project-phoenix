import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { contextFor, MemberCard } from "@/features/discovery/MemberCard";
import {
  getInterestsReceived,
  getInterestsReceivedCount,
  withPhotoUrls,
} from "@/features/members/data";
import { useMyDetails } from "@/features/members/me";
import { useEntitlements } from "@/features/membership/entitlements";
import type { Member } from "@/features/members/types";
import { colors, iconSize, space } from "@/theme/tokens";
import { fontFamily } from "@/theme/typography";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Card } from "@/ui/Surface";
import { EmptyState, SkeletonRow } from "@/ui/States";
import { Text } from "@/ui/Text";

/**
 * Who expressed interest in you.
 *
 * The one premium feature that shows real data, and the reason it is worth
 * paying for. The check is in SQL: `interests_received` returns nothing without
 * an active subscription, so an app that lied to itself about being premium
 * would get a nicer screen and exactly the same empty array.
 *
 * What a free member sees here is the honest version: the real count, and a
 * plain statement that seeing who they are is part of premium. Deliberately not
 * blurred faces, not silhouettes, and not an invented number -- each of those is
 * a lie told to sell a subscription, and this product cannot afford one.
 */
type Loaded = Member & { photoUrl: string | null };

export default function Interests() {
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const { details } = useMyDetails();

  const [members, setMembers] = useState<Loaded[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  /*
   * The fetch is written out here rather than hidden behind a callback that
   * setStates on its own. Data functions return data and the component owns its
   * state -- which keeps the cancellation visible at the point it matters and
   * makes the effect's dependencies the actual inputs to the query.
   */
  useEffect(() => {
    let active = true;

    void (async () => {
      const [found, total] = await Promise.all([
        getInterestsReceived(),
        getInterestsReceivedCount(),
      ]);
      const withPhotos = await withPhotoUrls(found);

      if (!active) return;
      setMembers(withPhotos);
      setCount(total);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const me = { city: details.cityName, languages: details.languageNames };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Interested in you",
          headerTitleStyle: {
            fontFamily: fontFamily.serif,
            fontSize: 18,
            color: colors.ink,
          },
          headerStyle: { backgroundColor: colors.canvas },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
        }}
      />

      <Screen>
        {loading || entitlementsLoading ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : !entitlements.canSeeInteresters ? (
          <View>
            <Card tone="accent">
              <View
                style={{ flexDirection: "row", gap: space.lg, alignItems: "center" }}
              >
                <Ionicons
                  name="mail-unread-outline"
                  size={iconSize.xl}
                  color={colors.emberText}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="headline">
                    {count === 0
                      ? "Nobody yet"
                      : count === 1
                        ? "One person is interested in you"
                        : `${count} people are interested in you`}
                  </Text>
                  <Text
                    variant="bodySm"
                    tone="muted"
                    style={{ marginTop: space.xs }}
                  >
                    {count === 0
                      ? "When someone expresses interest, the number appears here whether or not you have premium."
                      : "That is a real number, not an estimate. Seeing who they are is part of Eraya Premium."}
                  </Text>
                </View>
              </View>
            </Card>

            {count > 0 ? (
              <Button
                label="See what premium adds"
                onPress={() => router.push("/you/membership")}
                style={{ marginTop: space.xl }}
              />
            ) : null}

            <Text
              variant="caption"
              tone="subtle"
              style={{ marginTop: space.section }}
            >
              You can keep using everything else exactly as you are. Expressing
              interest, connecting and messaging are free and always will be
              &mdash; if one of these people is someone you would also choose,
              you will find each other through your introductions anyway.
            </Text>
          </View>
        ) : members.length === 0 ? (
          <EmptyState
            icon="mail-outline"
            title="Nobody yet"
            body="When someone expresses interest in you, they appear here. Nothing is hidden from you — this is genuinely empty."
          />
        ) : (
          <View style={{ gap: space.lg }}>
            <Text variant="body" tone="muted">
              These people have already said yes to you. If you feel the same,
              you will connect straight away.
            </Text>

            {members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                photoUrl={member.photoUrl}
                onPress={() => router.push(`/member/${member.id}`)}
                context={contextFor(member, me)}
              />
            ))}
          </View>
        )}
      </Screen>
    </>
  );
}
