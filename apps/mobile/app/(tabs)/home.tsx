import { useCallback, useRef, useState } from "react";
import { View, type ScrollView } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { greetingKey } from "@eraya/i18n";

import { HomeMark } from "@/brand/HomeMark";
import { useSession } from "@/features/auth/SessionProvider";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { useT } from "@/features/i18n/LocaleProvider";
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
  const t = useT();

  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Held so the mark can send this screen back to the top; see HomeMark.
  const scroller = useRef<ScrollView | null>(null);

  const load = useCallback(async () => {
    const [nextSummary, nextConversations] = await Promise.all([
      getHomeSummary(),
      getConversations(),
    ]);
    setSummary(nextSummary);
    // The home tab has no error state of its own: it is a summary, and a strip
    // of recent conversations that briefly does not appear is a smaller wrong
    // than an error card on the screen someone opens first.
    setConversations(nextConversations.conversations);
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

  /*
   * No stand-in for a missing name.
   *
   * This used to fall back to "there", which was a sixth language appearing
   * under a Bengali greeting. The name is collected in onboarding and nobody
   * reaches this tab without it, so the fallback was for a case that does not
   * happen -- and the honest version of that case is the greeting alone rather
   * than a translated guess at what to call somebody.
   */
  const name = profile?.firstName ?? null;
  const recent = conversations
    .filter((conversation) => conversation.lastMessageAt)
    .slice(0, 3);
  const waiting = conversations.filter(
    (conversation) => !conversation.lastMessageAt && !conversation.endedAt,
  );

  /*
   * The headline and the line under it, worked out once so the card and its
   * accessibility label cannot drift apart -- they used to be two separate
   * ladders of conditionals saying the same thing in different words.
   */
  const introductions = summary?.introductions ?? 0;

  const introductionsHeadline =
    introductions === 0
      ? t("home.introductionsNone")
      : introductions === 1
        ? t("home.introductionsOne")
        : t("home.introductionsMany", { count: introductions });

  const introductionsBody =
    introductions === 0
      ? t("home.introductionsNoneBody")
      : t("home.introductionsSomeBody");

  return (
    <Screen
      topInset
      scrollRef={scroller}
      onRefresh={() => void refresh()}
      refreshing={refreshing}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="eyebrow" tone="accent">
            {t(greetingKey(new Date().getHours()))}
          </Text>
          {name ? (
            <Text variant="display" style={{ marginTop: space.sm }}>
              {name}.
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: space.sm }}>
          <HomeMark
            size={40}
            /*
              The mark is a link to My Eraya, and this is My Eraya -- so there
              is nowhere for the tap to go, and it has to answer some other way.
              
              It scrolled to the top and refreshed, and all of that was
              invisible: a new member's home is shorter than the screen so there
              is nothing to scroll, and the refresh finishes faster than the
              spinner registers. A control that responds in ways nobody can see
              is a control that does not work, which is exactly how it was
              reported.
            */
            onAtHome={() => {
              scroller.current?.scrollTo({ y: 0, animated: true });
              void refresh();
            }}
          />
          <LanguageSwitcher />
        </View>
      </View>

      {/* Today's introductions. */}
      <Card
        tone="sand"
        onPress={() => router.push(routes.discover)}
        accessibilityLabel={
          summary === null
            ? t("home.introductionsLoading")
            : `${introductionsHeadline}. ${introductionsBody}`
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
              {t("home.today")}
            </Text>
            {summary === null ? (
              <Skeleton height={22} width="70%" style={{ marginTop: space.md }} />
            ) : (
              <Text variant="headline" style={{ marginTop: space.sm }}>
                {introductionsHeadline}
              </Text>
            )}
            <Text variant="bodySm" tone="muted" style={{ marginTop: space.xs }}>
              {introductionsBody}
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
            title={t("home.waitingTitle")}
            lede={
              waiting.length === 1
                ? t("home.waitingLedeOne")
                : t("home.waitingLedeMany")
            }
          />
          <View style={{ marginTop: space.lg, gap: space.md }}>
            {waiting.slice(0, 3).map((conversation) => (
              <Card
                key={conversation.connectionId}
                onPress={() =>
                  router.push(`/messages/${conversation.connectionId}`)
                }
                accessibilityLabel={t("home.startConversation", {
                  name: conversation.member.firstName,
                })}
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
                      {t("home.sayHello")}
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
            title={t("home.recentTitle")}
            action={
              <TextButton
                label={t("home.allMessages")}
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
                  accessibilityLabel={t("home.conversationWith", {
                    name: conversation.member.firstName,
                  })}
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
                        {conversation.lastMessageFromMe
                          ? `${t("home.fromYou")} `
                          : ""}
                        {conversation.lastMessage}
                      </Text>
                    </View>
                    {conversation.unread ? (
                      <View
                        accessibilityLabel={t("home.unread")}
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
          accessibilityLabel={`${
            summary.interestsReceived === 1
              ? t("home.interestOne")
              : t("home.interestMany", { count: summary.interestsReceived })
          }. ${
            entitlements.canSeeInteresters
              ? t("home.interestSeeWho")
              : t("home.interestPremium")
          }`}
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
                  ? t("home.interestOne")
                  : t("home.interestMany", {
                      count: summary.interestsReceived,
                    })}
              </Text>
              <Text variant="bodySm" tone="muted" style={{ marginTop: space.xs }}>
                {entitlements.canSeeInteresters
                  ? t("home.interestSeeWho")
                  : t("home.interestPremium")}
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
  const t = useT();
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
          <Text variant="label">{t("home.promptTitle")}</Text>
          <Text variant="bodySm" tone="muted" style={{ marginTop: space.xs }}>
            {t("home.promptBody")}
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
              label={t("home.promptCta")}
              onPress={() => router.push("/you/edit")}
            />
            <TextButton
              label={t("home.promptLater")}
              tone="muted"
              onPress={() => setDismissed(true)}
            />
          </View>
        </View>
      </View>
    </Card>
  );
}
