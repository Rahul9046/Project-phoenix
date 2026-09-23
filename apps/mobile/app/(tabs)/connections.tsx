import { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { relationshipLabelKeys } from "@/features/auth/types";
import { useT } from "@/features/i18n/LocaleProvider";
import { ScreenTitle } from "@/ui/ScreenTitle";
import { useActivity } from "@/features/activity/ActivityProvider";
import {
  getConversations,
  markConnectionsSeen,
  withPhotoUrls,
} from "@/features/members/data";
import type { Conversation } from "@/features/members/types";
import { colors, iconSize, space } from "@/theme/tokens";
import { Avatar, PersonSummary } from "@/ui/Person";
import { Screen } from "@/ui/Screen";
import { Card, SectionHeader } from "@/ui/Surface";
import { EmptyState, ErrorState, SkeletonRow } from "@/ui/States";
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
  const t = useT();
  const { refresh: refreshActivity } = useActivity();
  const [conversations, setConversations] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { conversations: rows, failed: fetchFailed } = await getConversations();

    if (fetchFailed) {
      setFailed(true);
      return;
    }

    setFailed(false);
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

      /*
       * Opening this tab is what makes these connections no longer new.
       *
       * All of them at once, because the screen shows them all at once -- there
       * is no per-connection state, only a watermark on the member's own row.
       * Marked on focus rather than on mount so that coming back to the tab
       * after connecting with somebody clears it too.
       *
       * The refresh afterwards is what takes the number off the tab bar; the
       * badge is read from the database and nothing else would tell it.
       */
      void markConnectionsSeen().then(() => {
        if (active) void refreshActivity();
      });

      return () => {
        active = false;
      };
    }, [load, refreshActivity]),
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
        <ScreenTitle title={t("shell.navConnections")} />
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
      <ScreenTitle title={t("shell.navConnections")} />

      {failed ? (
        /*
         * Before the empty state, because both end with no rows and only one is
         * true. t("connections.emptyTitle") is a discouraging thing to tell somebody
         * who has connections and a bad network.
         */
        <ErrorState
          onRetry={() => {
            setLoading(true);
            void load().finally(() => setLoading(false));
          }}
        />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={t("connections.emptyTitle")}
          body={t("mobileMessages.noConnectionsBody")}
          actionLabel={t("connections.seeWhoIsHere")}
          onAction={() => router.push("/(tabs)/discover")}
        />
      ) : null}

      {fresh.length > 0 ? (
        <Group
          title={t("mobileMessages.groupNew")}
          lede={t("home.waitingLedeMany")}
          conversations={fresh}
        />
      ) : null}

      {ongoing.length > 0 ? (
        <Group title={t("mobileMessages.groupTalking")} conversations={ongoing} />
      ) : null}

      {ended.length > 0 ? (
        <Group
          title={t("mobileMessages.groupEnded")}
          lede={t("mobileMessages.stillReadable")}
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
  const t = useT();

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
                      ? t(relationshipLabelKeys[conversation.member.relationshipStatus])
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
