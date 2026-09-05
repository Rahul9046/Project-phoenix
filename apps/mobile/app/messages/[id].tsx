import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "@/features/auth/SessionProvider";
import { SafetyActions } from "@/features/connections/SafetyActions";
import {
  getConversations,
  getMessages,
  markConversationRead,
  MESSAGE_PAGE_SIZE,
  photoUrlFor,
  sendMessage,
} from "@/features/members/data";
import type { Conversation, Message } from "@/features/members/types";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { text } from "@/theme/typography";
import { IconButton } from "@/ui/Button";
import { Avatar } from "@/ui/Person";
import { BottomSheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";
import { LoadingState } from "@/ui/States";
import { useToast } from "@/ui/Toast";

/**
 * A conversation.
 *
 * What is absent is the design. No read receipts, no typing indicator, no "seen
 * at 21:04", no unread badge shown to the sender, no streak, no nudge to reply.
 * Each of those exists to make one person feel owed and the other feel watched,
 * and this is a product for people who have recently had enough of both. The
 * database has no `read_at` column on a message precisely so none of it can be
 * added carelessly later.
 *
 * There is also no polling and no realtime subscription. Messages arrive when
 * the screen is opened, when one is sent, and when the app comes back to it. A
 * conversation that updates under you every few seconds is asking to be sat in;
 * this one is asking to be visited.
 *
 * Messaging is free, permanently. It is the point of the product, and paywalling
 * it would mean two people who chose each other cannot speak.
 */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const toast = useToast();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const listRef = useRef<FlatList<Message>>(null);
  const myId = session?.user.id ?? "";

  /*
   * The fetch is written out here rather than hidden behind a callback that
   * setStates on its own. Data functions return data and the component owns its
   * state -- which keeps the cancellation visible at the point it matters and
   * makes the effect's dependencies the actual inputs to the query.
   */
  useEffect(() => {
    if (!id || !myId) return;
    let active = true;

    void (async () => {
      const [all, history] = await Promise.all([
        getConversations(),
        getMessages(id, myId),
      ]);

      const found = all.find((entry) => entry.connectionId === id) ?? null;
      const url = await photoUrlFor(found?.member.photoPath ?? null);

      if (!active) return;
      setConversation(found);
      setPhotoUrl(url);
      setMessages(history);
      setExhausted(history.length < MESSAGE_PAGE_SIZE);
      setLoading(false);

      // Opening a conversation marks it read -- for this person only. There is
      // no query, from any client, that tells the other person this happened.
      void markConversationRead(id);
    })();

    return () => {
      active = false;
    };
  }, [id, myId]);

  async function loadOlder() {
    const oldest = messages[0];
    if (!id || !oldest || loadingOlder || exhausted) return;

    setLoadingOlder(true);
    const older = await getMessages(id, myId, oldest.createdAt);
    setExhausted(older.length < MESSAGE_PAGE_SIZE);
    setMessages((current) => [...older, ...current]);
    setLoadingOlder(false);
  }

  async function send() {
    const trimmed = body.trim();
    if (!id || !trimmed || sending) return;

    setSending(true);
    const result = await sendMessage(id, trimmed);

    if (!result.ok) {
      toast.show(result.message, "danger");
      setSending(false);
      return;
    }

    setBody("");
    const history = await getMessages(id, myId);
    setMessages(history);
    setSending(false);
    listRef.current?.scrollToEnd({ animated: true });
  }

  const ended = Boolean(conversation?.endedAt);
  const name = conversation?.member.firstName ?? "";

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ paddingTop: insets.top }} />
        <LoadingState label="Loading conversation" />
      </View>
    );
  }

  if (!conversation) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.gutter,
        }}
      >
        <IconButton
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          icon={
            <Ionicons name="chevron-back" size={iconSize.lg} color={colors.ink} />
          }
          style={{ marginLeft: -space.md }}
        />
        <Text variant="headline" style={{ marginTop: space.xxl }}>
          This conversation is not available
        </Text>
        <Text variant="body" tone="muted" style={{ marginTop: space.sm }}>
          They may have left Eraya, or you are no longer able to see each other.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      // On iOS the header sits above the keyboard-avoided area; this offset is
      // what stops the composer hiding behind the keyboard by exactly the
      // header's height.
      keyboardVerticalOffset={0}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      {/* Header. Their name and photo open their profile -- the most common
          thing anyone wants mid-conversation. */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.md,
          paddingBottom: space.md,
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          backgroundColor: colors.canvas,
        }}
      >
        <IconButton
          accessibilityLabel="Back to messages"
          onPress={() => router.back()}
          icon={
            <Ionicons name="chevron-back" size={iconSize.lg} color={colors.ink} />
          }
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}. Opens their profile.`}
          onPress={() => router.push(`/member/${conversation.member.id}`)}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
            // Clears the touch-target floor on its own: the avatar beside it is
            // 40pt, which would leave the whole row four points short.
            minHeight: hit.min,
          }}
        >
          <Avatar name={name} photoUrl={photoUrl} size="sm" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="headline" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" tone="subtle">
              {ended ? "Connection ended" : "View profile"}
            </Text>
          </View>
        </Pressable>

        <IconButton
          accessibilityLabel="Conversation options"
          onPress={() => setMenuOpen(true)}
          icon={
            <Ionicons
              name="ellipsis-horizontal"
              size={iconSize.lg}
              color={colors.ink}
            />
          }
        />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => message.id}
        contentContainerStyle={{
          paddingHorizontal: space.gutter,
          paddingVertical: space.xl,
          gap: space.sm,
          flexGrow: 1,
          justifyContent: messages.length ? "flex-end" : "center",
        }}
        onEndReachedThreshold={0.2}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => {
          // Older messages load when someone scrolls up, not automatically:
          // opening a two-year conversation should not download two years.
          void loadOlder();
        }}
        renderItem={({ item, index }) => (
          <Bubble
            message={item}
            showDay={showsDayBreak(messages, index)}
          />
        )}
        ListHeaderComponent={
          loadingOlder ? <LoadingState label="Loading earlier messages" /> : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingHorizontal: space.xl }}>
            <Text variant="headline" center>
              You chose each other.
            </Text>
            <Text
              variant="body"
              tone="muted"
              center
              style={{ marginTop: space.sm, maxWidth: 300 }}
            >
              Say hello when you are ready. There is no hurry, and nobody is
              waiting on a timer.
            </Text>
          </View>
        }
      />

      {ended ? (
        <View
          style={{
            paddingHorizontal: space.gutter,
            paddingTop: space.lg,
            paddingBottom: insets.bottom + space.lg,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.sand,
          }}
        >
          <Text variant="bodySm" tone="muted" center>
            This connection has ended. You can still read what was said, and
            nothing further can be sent.
          </Text>
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: space.md,
            paddingHorizontal: space.gutter,
            paddingTop: space.md,
            paddingBottom: insets.bottom + space.md,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.canvas,
          }}
        >
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={`Write to ${name}`}
            placeholderTextColor={colors.inkSubtle}
            selectionColor={colors.ember}
            multiline
            maxLength={4000}
            accessibilityLabel={`Write a message to ${name}`}
            style={[
              text.body,
              {
                flex: 1,
                color: colors.ink,
                minHeight: hit.compact,
                // Grows with the text and then stops, so a long message never
                // pushes the send button off the screen.
                maxHeight: 120,
                paddingTop: space.md,
                paddingBottom: space.md,
                paddingHorizontal: space.lg,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: colors.lineStrong,
                backgroundColor: colors.surface,
              },
            ]}
          />

          <IconButton
            accessibilityLabel="Send"
            disabled={!body.trim() || sending}
            onPress={() => void send()}
            icon={
              <Ionicons
                name="arrow-up"
                size={iconSize.lg}
                color={colors.inkInverse}
              />
            }
            style={{
              backgroundColor: body.trim() ? colors.ember : colors.lineStrong,
              width: hit.compact,
              height: hit.compact,
            }}
          />
        </View>
      )}

      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={name}
      >
        <MenuRow
          icon="person-outline"
          label="View profile"
          onPress={() => {
            setMenuOpen(false);
            router.push(`/member/${conversation.member.id}`);
          }}
        />

        <SafetyActions
          memberId={conversation.member.id}
          memberName={name}
          connectionId={ended ? undefined : conversation.connectionId}
          onDone={() => {
            setMenuOpen(false);
            router.replace("/(tabs)/messages");
          }}
          style={{ marginTop: space.xl }}
        />
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: hit.large,
        flexDirection: "row",
        alignItems: "center",
        gap: space.lg,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={iconSize.md} color={colors.ink} />
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

/**
 * A message.
 *
 * Mine sit right on terracotta, theirs left on white. The timestamp is the hour
 * and minute and nothing finer, and it appears under every message rather than
 * on hover -- there is no hover on a phone, and a time that has to be revealed
 * is a time nobody reads.
 */
function Bubble({
  message,
  showDay,
}: {
  message: Message;
  showDay: boolean;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View>
      {showDay ? (
        <Text
          variant="caption"
          tone="subtle"
          center
          style={{ marginVertical: space.lg }}
        >
          {dayLabel(message.createdAt)}
        </Text>
      ) : null}

      <View
        style={{
          alignSelf: message.fromMe ? "flex-end" : "flex-start",
          maxWidth: "82%",
        }}
      >
        <View
          style={{
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            borderRadius: radius.xl,
            // The corner nearest the sender is squared off, which is what makes
            // the direction readable without a colour cue.
            borderBottomRightRadius: message.fromMe ? radius.xs : radius.xl,
            borderBottomLeftRadius: message.fromMe ? radius.xl : radius.xs,
            backgroundColor: message.fromMe ? colors.ember : colors.surface,
            borderWidth: message.fromMe ? 0 : 1,
            borderColor: colors.line,
          }}
        >
          <Text
            variant="body"
            tone={message.fromMe ? "inverse" : "default"}
            selectable
          >
            {message.body}
          </Text>
        </View>

        <Text
          variant="caption"
          tone="subtle"
          style={{
            marginTop: space.xxs,
            textAlign: message.fromMe ? "right" : "left",
          }}
        >
          {time}
        </Text>
      </View>
    </View>
  );
}

function showsDayBreak(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const previous = messages[index - 1];
  const current = messages[index];
  if (!previous || !current) return false;
  return (
    new Date(previous.createdAt).toDateString() !==
    new Date(current.createdAt).toDateString()
  );
}

function dayLabel(iso: string): string {
  const then = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (then.toDateString() === today.toDateString()) return "Today";
  if (then.toDateString() === yesterday.toDateString()) return "Yesterday";

  return then.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year:
      then.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}
