import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getConversations, withPhotoUrls } from "@/features/members/data";
import type { Conversation } from "@/features/members/types";
import { colors, layout, radius, space } from "@/theme/tokens";
import { Avatar } from "@/ui/Person";
import { Card } from "@/ui/Surface";
import { EmptyState, SkeletonRow } from "@/ui/States";
import { Text } from "@/ui/Text";

/**
 * The inbox.
 *
 * Only real connections appear here. There is no way for a stranger to reach
 * this screen -- the insert policy on `messages` refuses anyone who is not in an
 * open connection -- so an inbox in Eraya cannot contain an unsolicited message.
 * That is the single biggest difference between this and every other inbox its
 * members will have used.
 *
 * The unread mark is a dot rather than a count, and it is computed from the
 * reader's own marker. Nothing on this screen, or anywhere else, tells the other
 * person when you last opened a conversation.
 */
type Loaded = Conversation & { photoUrl: string | null };

export default function Messages() {
  const insets = useSafeAreaInsets();
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View
        style={{
          paddingTop: insets.top + space.md,
          paddingHorizontal: space.gutter,
          paddingBottom: space.md,
        }}
      >
        <Text variant="title">Messages</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.connectionId}
        contentContainerStyle={{
          paddingHorizontal: space.gutter,
          paddingBottom: insets.bottom + space.region,
          gap: space.sm,
          maxWidth: layout.maxContentWidth,
          width: "100%",
          alignSelf: "center",
          flexGrow: 1,
        }}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <Row conversation={item} />}
        ListEmptyComponent={
          loading ? (
            <View>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title="No conversations yet"
              body="Conversations begin after you and someone else have both expressed interest. Nobody can message you before that."
              actionLabel="See who is here"
              onAction={() => router.push("/(tabs)/discover")}
            />
          )
        }
      />
    </View>
  );
}

function Row({ conversation }: { conversation: Loaded }) {
  const preview = conversation.endedAt
    ? "This connection has ended."
    : conversation.lastMessage
      ? `${conversation.lastMessageFromMe ? "You: " : ""}${conversation.lastMessage}`
      : "Say hello when you are ready.";

  return (
    <Card
      onPress={() => router.push(`/messages/${conversation.connectionId}`)}
      accessibilityLabel={
        `${conversation.member.firstName}. ${preview}` +
        (conversation.unread ? " Unread." : "")
      }
      padded={false}
      tone={conversation.endedAt ? "sand" : "surface"}
      style={{ padding: space.lg }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}
      >
        <Avatar
          name={conversation.member.firstName}
          photoUrl={conversation.photoUrl}
          size="md"
        />

        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: space.md,
            }}
          >
            <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
              {conversation.member.firstName}
            </Text>
            {conversation.lastMessageAt ? (
              <Text variant="caption" tone="subtle">
                {relativeTime(conversation.lastMessageAt)}
              </Text>
            ) : null}
          </View>

          <Text
            variant="bodySm"
            tone={conversation.unread ? "default" : "muted"}
            numberOfLines={1}
            style={{ marginTop: space.xxs }}
          >
            {preview}
          </Text>
        </View>

        {conversation.unread ? (
          <View
            accessibilityLabel="Unread"
            style={{
              width: 9,
              height: 9,
              borderRadius: radius.pill,
              backgroundColor: colors.ember,
            }}
          />
        ) : null}
      </View>
    </Card>
  );
}

/**
 * How long ago, roughly.
 *
 * Deliberately coarse. "3m" counts the minutes since somebody replied, which is
 * the sort of precision that makes a person feel watched; "Today" and "Tuesday"
 * say enough to place a conversation without turning it into a clock.
 */
export function relativeTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const days = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) /
      86_400_000,
  );

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) {
    return then.toLocaleDateString("en-IN", { weekday: "long" });
  }
  return then.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
