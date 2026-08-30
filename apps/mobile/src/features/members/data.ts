import { supabase } from "@/lib/supabase/client";
import type {
  Conversation,
  DiscoveryFilters,
  Member,
  Message,
} from "@/features/members/types";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Reading and writing the things members do to each other.
 *
 * Everything goes through a database function. There is no `select * from
 * profiles` anywhere in this app and there must not be: `member_card` is the
 * privacy boundary, it is enforced by `security definer` functions, and a client
 * that queried the table directly would be relying on RLS to hide columns rather
 * than on a function to never return them.
 *
 * The same functions serve the web app. Neither client owns a rule.
 */

type RawCard = Database["public"]["CompositeTypes"]["member_card"];

function toMember(row: RawCard): Member {
  return {
    id: row.id ?? "",
    firstName: row.first_name ?? "",
    age: row.age,
    city: row.city,
    state: row.state,
    relationshipStatus: row.relationship_status,
    gender: row.gender,
    languages: row.languages ?? [],
    about: row.about,
    lookingFor: row.looking_for,
    photoPath: row.photo_path,
    photoCount: row.photo_count ?? 0,
    phoneVerified: Boolean(row.phone_verified),
    emailVerified: Boolean(row.email_verified),
  };
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/**
 * A short-lived URL for a stored photo.
 *
 * The bucket is private, so a path is not an image: it has to be signed, and the
 * signature is checked against the storage policies -- which refuse if either
 * person has blocked the other. An hour is long enough that scrolling a list
 * never re-signs, and short enough that a URL copied out of the app stops
 * working the same afternoon.
 *
 * Results are memoised for the process lifetime because a discovery list
 * re-renders often and each render would otherwise be a network call per face.
 */
const signedUrls = new Map<string, { url: string; expires: number }>();
const SIGNED_URL_TTL_SECONDS = 3600;

export async function photoUrlFor(
  path: string | null,
): Promise<string | null> {
  if (!path) return null;

  const cached = signedUrls.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from("profile-photos")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;

  signedUrls.set(path, {
    url: data.signedUrl,
    // Re-sign a minute early rather than handing out a URL about to expire.
    expires: Date.now() + (SIGNED_URL_TTL_SECONDS - 60) * 1000,
  });

  return data.signedUrl;
}

/** Signs a page of results in one pass, so a list is one round of requests. */
export async function withPhotoUrls(
  members: Member[],
): Promise<(Member & { photoUrl: string | null })[]> {
  const urls = await Promise.all(
    members.map((member) => photoUrlFor(member.photoPath)),
  );
  return members.map((member, index) => ({
    ...member,
    photoUrl: urls[index] ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export const DISCOVERY_PAGE_SIZE = 10;

export async function getIntroductions(
  filters: DiscoveryFilters,
  page = 0,
): Promise<Member[]> {
  const { data, error } = await supabase.rpc("discover_members", {
    max_results: DISCOVERY_PAGE_SIZE,
    page_offset: page * DISCOVERY_PAGE_SIZE,
    /*
     * An unset filter is omitted rather than sent as null. PostgREST types its
     * arguments as optional, and leaving one out lets the function's own default
     * apply -- which is where "no filter" is defined, in SQL, once.
     */
    min_age: filters.minAge ?? undefined,
    max_age: filters.maxAge ?? undefined,
    city_ids: filters.cityIds.length ? filters.cityIds : undefined,
    language_ids: filters.languageIds.length ? filters.languageIds : undefined,
    relationship_statuses: filters.relationshipStatuses.length
      ? filters.relationshipStatuses
      : undefined,
  });

  if (error || !data) return [];
  return (data as RawCard[]).map(toMember);
}

export async function getMember(id: string): Promise<Member | null> {
  const { data, error } = await supabase.rpc("member_profile", {
    member_id: id,
  });

  if (error || !data) return null;
  const rows = data as RawCard[];
  return rows[0] ? toMember(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Interest
// ---------------------------------------------------------------------------

export type InterestOutcome =
  | { ok: true; connectionId: string | null }
  | { ok: false; message: string };

/**
 * Expressing interest, or passing.
 *
 * One database call does both the record and the connection, atomically. Doing
 * it in two -- insert the interest, then check whether theirs exists, then
 * create the connection -- has a race in it where two people tap at the same
 * moment and either get two connections or none.
 *
 * The returned id is non-null exactly when this decision completed a mutual
 * pair, which is what the screen uses to show the connection moment.
 */
export async function expressInterest(
  targetId: string,
  decision: "interested" | "passed",
): Promise<InterestOutcome> {
  const { data, error } = await supabase.rpc("express_interest", {
    target_id: targetId,
    decision,
  });

  if (error) {
    return {
      ok: false,
      message: "That did not go through. Please try again in a moment.",
    };
  }

  return { ok: true, connectionId: (data as string | null) ?? null };
}

/**
 * Undoing the last pass.
 *
 * Returns the id that came back, or null when there was nothing to undo or the
 * daily allowance is spent. The allowance lives in the entitlements table and is
 * counted in the database, so a client cannot award itself more.
 */
export async function revertLastPass(): Promise<string | null> {
  const { data, error } = await supabase.rpc("revert_last_pass");
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function revertsRemaining(): Promise<number> {
  const { data, error } = await supabase.rpc("reverts_remaining");
  if (error || typeof data !== "number") return 0;
  return data;
}

// ---------------------------------------------------------------------------
// Interest received
// ---------------------------------------------------------------------------

/** Premium. Returns nothing for a free member -- checked in SQL, not here. */
export async function getInterestsReceived(): Promise<Member[]> {
  const { data, error } = await supabase.rpc("interests_received");
  if (error || !data) return [];
  return (data as RawCard[]).map(toMember);
}

/**
 * The real number of people waiting, available to everyone.
 *
 * A free member is told the truth and told that seeing who they are is what
 * premium is for. No blurred faces, no invented count -- both of which are lies
 * told to sell a subscription.
 */
export async function getInterestsReceivedCount(): Promise<number> {
  const { data, error } = await supabase.rpc("interests_received_count");
  if (error || typeof data !== "number") return 0;
  return data;
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

type RawConversation =
  Database["public"]["CompositeTypes"]["conversation_row"];

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc("my_conversations");

  if (error || !data) return [];

  return (data as RawConversation[])
    .filter((row) => row.member?.id)
    .map((row) => ({
      connectionId: row.connection_id ?? "",
      member: toMember(row.member as RawCard),
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      lastMessageFromMe: Boolean(row.last_message_from_me),
      unread: Boolean(row.unread),
      endedAt: row.ended_at,
      endedByMe: Boolean(row.ended_by_me),
    }));
}

export const MESSAGE_PAGE_SIZE = 40;

/**
 * A conversation's messages, newest page first.
 *
 * Paged from the end: a long conversation should open at the bottom without
 * downloading two years of it. `before` walks backwards when someone scrolls up.
 */
export async function getMessages(
  connectionId: string,
  myId: string,
  before?: string,
): Promise<Message[]> {
  let query = supabase
    .from("messages")
    .select("id, body, created_at, sender_id")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;

  if (error || !data) return [];

  // Reversed here so the caller always has oldest-first, which is the order a
  // conversation reads in.
  return data
    .map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      fromMe: row.sender_id === myId,
    }))
    .reverse();
}

export type SendResult = { ok: true } | { ok: false; message: string };

export async function sendMessage(
  connectionId: string,
  body: string,
): Promise<SendResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: "Write something first." };

  const { data: auth } = await supabase.auth.getUser();
  const senderId = auth.user?.id;

  if (!senderId) {
    return { ok: false, message: "Your session has expired. Please sign in again." };
  }

  const { error } = await supabase
    .from("messages")
    .insert({ connection_id: connectionId, sender_id: senderId, body: trimmed });

  if (error) {
    /*
     * The insert policy refuses when the connection has ended or was never
     * mutual. That is the product rule doing its job rather than a fault, so it
     * gets a sentence that explains rather than "something went wrong".
     */
    if (error.code === "42501") {
      return {
        ok: false,
        message: "This conversation has ended. Nothing further can be sent.",
      };
    }
    return { ok: false, message: "That did not send. Please try again." };
  }

  return { ok: true };
}

/** Records that the caller opened a conversation. Writes only their own marker. */
export async function markConversationRead(
  connectionId: string,
): Promise<void> {
  await supabase.rpc("mark_conversation_read", { connection_id: connectionId });
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

export async function endConnection(connectionId: string): Promise<boolean> {
  const { error } = await supabase
    .from("connections")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", connectionId);

  return !error;
}

export async function blockMember(targetId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return false;

  const { error } = await supabase
    .from("member_blocks")
    .insert({ blocker_id: me, blocked_id: targetId });

  return !error;
}

export type ReportReason = Database["public"]["Enums"]["report_reason"];

export const reportReasons: readonly {
  value: ReportReason;
  label: string;
}[] = [
  { value: "fake_profile", label: "Fake profile" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "scam", label: "Scam or suspicious behaviour" },
  {
    value: "incorrect_relationship_status",
    label: "Their chapter is not what they say",
  },
  { value: "other", label: "Something else" },
];

export async function reportMember(
  targetId: string,
  reason: ReportReason,
  description: string,
): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return false;

  const { error } = await supabase.from("member_reports").insert({
    reporter_id: me,
    reported_id: targetId,
    reason_code: reason,
    description: description.trim() || null,
  });

  return !error;
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export type HomeSummary = {
  introductions: number;
  newConnections: number;
  unreadConversations: number;
  interestsReceived: number;
};

/** Four counts in one call, all of them real. */
export async function getHomeSummary(): Promise<HomeSummary> {
  const { data, error } = await supabase.rpc("home_summary");

  const row = Array.isArray(data) ? data[0] : null;

  if (error || !row) {
    return {
      introductions: 0,
      newConnections: 0,
      unreadConversations: 0,
      interestsReceived: 0,
    };
  }

  return {
    introductions: row.introductions ?? 0,
    newConnections: row.new_connections ?? 0,
    unreadConversations: row.unread_conversations ?? 0,
    interestsReceived: row.interests_received ?? 0,
  };
}
