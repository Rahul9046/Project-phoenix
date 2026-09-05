import { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { relationshipLabels } from "@/features/auth/types";
import { getConversations, withPhotoUrls } from "@/features/members/data";
import type { Conversation } from "@/features/members/types";
import { colors, iconSize, space } from "@/theme/tokens";
import { Avatar, PersonSummary } from "@/ui/Person";
import { Screen } from "@/ui/Screen";
import { Card, SectionHeader } from "@/ui/Surface";
import { EmptyState, SkeletonRow } from "@/ui/States";
import { Text } from "@/ui/Text";

/**
 * Connections.
 *
 * People you have both said yes to, whether or not anything has been said. The
 * word "connection" is used throughout rather than "match": a match is something
 * a system declares about two people, and a connection is something two people
 * made.
 *
 * Split into three, because the three need different things from you. New ones
 * are waiting for a first word. Ongoing ones are conversations. Ended ones stay
 * visible and readable -- deleting them would rewrite what happened, and someone
 * may want to look back at it.
 */
type Loaded = Conversation & { photoUrl: string | null };

export default function Connections() {
  const [conversations, setConversations] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const rows = await getConversations();
    const withPhotos = await withPhotoUrls(rows.map((row) => row.member));

    setConversations(
      rows.map((row, index) => ({
        ...row,
        photoUrl: withPhotos[index]?.photoUrl ?? null,
      })),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void load().then(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const fresh = conversations.filter((c) => !c.lastMessageAt && !c.endedAt);
  const ongoing = conversations.filter((c) => c.lastMessageAt && !c.endedAt);
  const ended = conversations.filter((c) => c.endedAt);

  if (loading) {
    return (
      <Screen topInset>
        <Text variant="title">Connections</Text>
        <View style={{ marginTop: space.section }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </Screen>
    );
  }

  return (
    <Screen topInset onRefresh={() => void refresh()} refreshing={refreshing}>
      <Text variant="title">Connections</Text>

      {conversations.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No connections yet"
          body="When you and someone else both express interest, they appear here. Nobody is told you were interested unless they feel the same."
          actionLabel="See who is here"
          onAction={() => router.push("/(tabs)/discover")}
        />
      ) : null}

      {fresh.length > 0 ? (
        <Group
          title="New"
          lede="You chose each other. Nothing has been said yet."
          conversations={fresh}
        />
      ) : null}

      {ongoing.length > 0 ? (
        <Group title="Talking" conversations={ongoing} />
      ) : null}

      {ended.length > 0 ? (
        <Group
          title="Ended"
          lede="Still readable. Nothing further can be sent."
          conversations={ended}
          muted
        />
      ) : null}
    </Screen>
  );
}

function Group({
  title,
  lede,
  conversations,
  muted = false,
}: {
  title: string;
  lede?: string;
  conversations: Loaded[];
  muted?: boolean;
}) {
  return (
    <View style={{ marginTop: space.section }}>
      <SectionHeader title={title} lede={lede} />

      <View style={{ marginTop: space.lg, gap: space.md }}>
        {conversations.map((conversation) => (
          <Card
            key={conversation.connectionId}
            tone={muted ? "sand" : "surface"}
            onPress={() => router.push(`/messages/${conversation.connectionId}`)}
            accessibilityLabel={`${conversation.member.firstName}. Opens your conversation.`}
            padded={false}
            style={{ padding: space.lg }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.lg,
              }}
            >
              <Avatar
                name={conversation.member.firstName}
                photoUrl={conversation.photoUrl}
                size="md"
              />

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  variant="headline"
                  numberOfLines={1}
                  tone={muted ? "muted" : "default"}
                >
                  {conversation.member.firstName}
                </Text>
                <PersonSummary
                  age={conversation.member.age}
                  city={conversation.member.city}
                  relationship={
                    conversation.member.relationshipStatus
                      ? relationshipLabels[conversation.member.relationshipStatus]
                      : null
                  }
                  style={{ marginTop: space.xxs }}
                />
              </View>

              <Ionicons
                name="chevron-forward"
                size={iconSize.md}
                color={colors.inkSubtle}
              />
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}
