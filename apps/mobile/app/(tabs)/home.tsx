import { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ErayaMark } from "@/brand/ErayaMark";
import { useSession } from "@/features/auth/SessionProvider";
import { routes } from "@/features/auth/routing";
import {
  getConversations,
  getHomeSummary,
  type HomeSummary,
} from "@/features/members/data";
import { useEntitlements } from "@/features/membership/entitlements";
import type { Conversation } from "@/features/members/types";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { TextButton } from "@/ui/Button";
import { Avatar } from "@/ui/Person";
import { Screen } from "@/ui/Screen";
import { Card, Divider, SectionHeader } from "@/ui/Surface";
import { Skeleton } from "@/ui/States";
import { Text } from "@/ui/Text";

/**
 * My Eraya.
 *
 * The person's own space, and the answer to one question: what is worth my
 * attention today. Not a feed of faces -- that is what Discover is for -- and
 * not a dashboard of metrics, which would turn a slow, human thing into a
 * performance review.
 *
 * Every number on this screen is real, and most of them will be zero for a long
 * time. Eraya is new. A screen of honest zeroes with a sentence explaining what
 * will change is better than one padded with invented activity, and the moment
 * this product shows someone a face or a count that is not there, nothing else
 * it says can be believed.
 */
export default function Home() {
  const { profile } = useSession();
  const { entitlements } = useEntitlements();

  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [nextSummary, nextConversations] = await Promise.all([
      getHomeSummary(),
      getConversations(),
    ]);
    setSummary(nextSummary);
    setConversations(nextConversations);
  }, []);

  // Refetched when the tab regains focus rather than on an interval: coming back
  // from a conversation should show it moved, and nothing else needs to be live.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void load().then(() => {
        if (!active) return;
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

  const name = profile?.firstName ?? "there";
  const recent = conversations
    .filter((conversation) => conversation.lastMessageAt)
    .slice(0, 3);
  const waiting = conversations.filter(
    (conversation) => !conversation.lastMessageAt && !conversation.endedAt,
  );

  return (
    <Screen topInset onRefresh={() => void refresh()} refreshing={refreshing}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="eyebrow" tone="accent">
            {greeting()}
          </Text>
          <Text variant="display" style={{ marginTop: space.sm }}>
            {name}.
          </Text>
        </View>
        <ErayaMark size={40} />
      </View>

      {/* Today's introductions. */}
      <Card
        tone="sand"
        onPress={() => router.push(routes.discover)}
        accessibilityLabel={
          summary === null
            ? "Introductions, loading"
            : summary.introductions > 0
              ? `${summary.introductions} introductions waiting. Opens Discover.`
              : "No introductions today. Opens Discover."
        }
        style={{ marginTop: space.section }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.lg,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="eyebrow" tone="accent">
              Today
            </Text>
            {summary === null ? (
              <Skeleton height={22} width="70%" style={{ marginTop: space.md }} />
            ) : (
              <Text variant="headline" style={{ marginTop: space.sm }}>
                {summary.introductions === 0
                  ? "No new introductions today"
                  : summary.introductions === 1
                    ? "One person to meet"
                    : `${summary.introductions} people to meet`}
              </Text>
            )}
            <Text variant="bodySm" tone="muted" style={{ marginTop: space.xs }}>
              {summary?.introductions === 0
                ? "More arrive as the community grows around you."
                : "A few at a time, chosen without a ranking."}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={iconSize.lg}
            color={colors.inkSubtle}
          />
        </View>
      </Card>

      {/* Connections with nothing said yet -- the thing most worth doing. */}
      {waiting.length > 0 ? (
        <View style={{ marginTop: space.section }}>
          <SectionHeader
            title="Waiting for a first word"
            lede={
              waiting.length === 1
                ? "You chose each other. Neither of you has said anything yet."
                : "You chose each other. Nothing has been said yet."
            }
          />
          <View style={{ marginTop: space.lg, gap: space.md }}>
            {waiting.slice(0, 3).map((conversation) => (
              <Card
                key={conversation.connectionId}
                onPress={() =>
                  router.push(`/messages/${conversation.connectionId}`)
                }
                accessibilityLabel={`Start a conversation with ${conversation.member.firstName}`}
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
                  <Avatar name={conversation.member.firstName} size="md" />
                  <View style={{ flex: 1 }}>
                    <Text variant="headline">
                      {conversation.member.firstName}
                    </Text>
                    <Text variant="bodySm" tone="muted">
                      Say hello when you are ready.
                    </Text>
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
      ) : null}

      {/* Recent conversations. */}
      {recent.length > 0 ? (
        <View style={{ marginTop: space.section }}>
          <SectionHeader
            title="Recent"
            action={
              <TextButton
                label="All messages"
                onPress={() => router.push(routes.messages)}
              />
            }
          />
          <Card style={{ marginTop: space.lg }} padded={false}>
            {recent.map((conversation, index) => (
              <View key={conversation.connectionId}>
                {index > 0 ? <Divider inset={space.xl + 52 + space.lg} /> : null}
                <Card
                  padded={false}
                  onPress={() =>
                    router.push(`/messages/${conversation.connectionId}`)
                  }
                  accessibilityLabel={`Conversation with ${conversation.member.firstName}`}
                  style={{
                    borderWidth: 0,
                    borderRadius: 0,
                    padding: space.xl,
                    backgroundColor: "transparent",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.lg,
                    }}
                  >
                    <Avatar name={conversation.member.firstName} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text variant="headline" numberOfLines={1}>
                        {conversation.member.firstName}
                      </Text>
                      <Text
                        variant="bodySm"
                        tone={conversation.unread ? "default" : "muted"}
                        numberOfLines={1}
                      >
                        {conversation.lastMessageFromMe ? "You: " : ""}
                        {conversation.lastMessage}
                      </Text>
                    </View>
                    {conversation.unread ? (
                      <View
                        accessibilityLabel="Unread"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: radius.pill,
                          backgroundColor: colors.ember,
                        }}
                      />
                    ) : null}
                  </View>
                </Card>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {/* Interest received. Real numbers, and an honest reason to upgrade. */}
      {summary && summary.interestsReceived > 0 ? (
        <Card
          tone={entitlements.canSeeInteresters ? "surface" : "accent"}
          onPress={() =>
            router.push(
              entitlements.canSeeInteresters
                ? "/interests"
                : "/you/membership",
            )
          }
          accessibilityLabel={
            entitlements.canSeeInteresters
              ? `${summary.interestsReceived} people have expressed interest. See who.`
              : `${summary.interestsReceived} people have expressed interest. Seeing who is part of premium.`
          }
          style={{ marginTop: space.section }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.lg,
            }}
          >
            <Ionicons
              name="mail-unread-outline"
              size={iconSize.lg}
              color={colors.emberText}
            />
            <View style={{ flex: 1 }}>
              <Text variant="headline">
                {summary.interestsReceived === 1
                  ? "Someone is interested in you"
                  : `${summary.interestsReceived} people are interested in you`}
              </Text>
              <Text variant="bodySm" tone="muted" style={{ marginTop: space.xs }}>
                {entitlements.canSeeInteresters
                  ? "See who they are."
                  : "Seeing who they are is part of Eraya Premium."}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={iconSize.md}
              color={colors.inkSubtle}
            />
          </View>
        </Card>
      ) : null}

      <ProfilePrompt />
    </Screen>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * A single nudge, shown only when there is something genuinely worth adding.
 *
 * Not a completeness percentage. A progress ring on a person's profile turns
 * "tell us about yourself" into a chore with a score, and the number is never
 * quite 100 because there is always one more field -- which is the point of the
 * pattern, and the reason it is not used here.
 */
function ProfilePrompt() {
  const { profile } = useSession();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !profile) return null;

  return (
    <Card tone="sand" style={{ marginTop: space.section }}>
      <View style={{ flexDirection: "row", gap: space.lg }}>
        <Ionicons
          name="create-outline"
          size={iconSize.lg}
          color={colors.inkMuted}
        />
        <View style={{ flex: 1 }}>
          <Text variant="label">Say a little more about yourself</Text>
          <Text variant="bodySm" tone="muted" style={{ marginTop: space.xs }}>
            A few lines in your own words is the difference between a profile and
            a person. It takes a minute, and you can change it whenever you like.
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: space.lg,
              marginTop: space.md,
              alignItems: "center",
            }}
          >
            <TextButton
              label="Add it now"
              onPress={() => router.push("/you/edit")}
            />
            <TextButton
              label="Later"
              tone="muted"
              onPress={() => setDismissed(true)}
            />
          </View>
        </View>
      </View>
    </Card>
  );
}
