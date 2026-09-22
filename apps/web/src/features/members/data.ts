import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Everything the signed-in product knows about other people.
 *
 * Every read here goes through a database function that returns a fixed set of
 * fields — see the discovery migration. `profiles` itself is still readable only
 * by its owner, which is what keeps a date of birth from leaving the server when
 * only an age was meant to.
 */

export type RelationshipStatus =
  Database["public"]["Enums"]["relationship_status"];

export type MemberCard = {
  id: string;
  firstName: string;
  age: number;
  city: string | null;
  state: string | null;
  relationshipStatus: RelationshipStatus | null;
  gender: string | null;
  languages: string[];
  /** Only states the system can actually stand behind. */
  phoneVerified: boolean;
  emailVerified: boolean;
  /**
   * A short-lived signed URL for the member's first photo, or null.
   *
   * The signed URL and never the storage path. The path is a capability -- the
   * storage policy grants read to any signed-in member who is not blocked, so
   * knowing a path is most of knowing the photo -- and it has no business
   * crossing into a component. Signing happens here, on the server, against the
   * viewer's own session, so a URL is only ever minted for a photo that viewer
   * was already allowed to load.
   */
  photoUrl: string | null;
  photoCount: number;
};

type RawCard = {
  id: string;
  first_name: string | null;
  age: number | null;
  city: string | null;
  state: string | null;
  relationship_status: RelationshipStatus | null;
  gender: string | null;
  languages: string[] | null;
  phone_verified: boolean | null;
  email_verified: boolean | null;
  photo_path: string | null;
  photo_count: number | null;
};

function toCard(row: RawCard): MemberCard {
  return {
    id: row.id,
    firstName: row.first_name ?? "",
    age: row.age ?? 0,
    city: row.city,
    state: row.state,
    relationshipStatus: row.relationship_status,
    gender: row.gender,
    languages: row.languages ?? [],
    phoneVerified: Boolean(row.phone_verified),
    emailVerified: Boolean(row.email_verified),
    // Filled in by `toCards`, which is the only way a card is built.
    photoUrl: null,
    photoCount: row.photo_count ?? 0,
  };
}

/** An hour. Long enough for a page to be read, short enough to expire. */
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Cards, with their photos signed.
 *
 * One batched call for the whole list rather than one per row: a discovery
 * screen or an inbox would otherwise mint URLs in a loop, and the round trips
 * are the slow part.
 *
 * The bucket is private and there is no public URL, so a signed one is the only
 * way a browser can load these. It expires, which is the point -- a URL copied
 * out of Eraya stops working rather than outliving a block, a deletion or a
 * closed account. The storage policy refuses to sign a blocked member's object
 * at all, so blocking is enforced on the file and not merely on the screen.
 *
 * A failure to sign leaves `photoUrl` null, and null renders the monogram. A
 * member is shown as themselves-without-a-picture rather than as a broken image.
 */
async function toCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: RawCard[],
): Promise<MemberCard[]> {
  const cards = rows.map(toCard);

  const paths = rows
    .map((row) => row.photo_path)
    .filter((path): path is string => Boolean(path));

  if (paths.length === 0) return cards;

  const { data: signed } = await supabase.storage
    .from("profile-photos")
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  const urls = new Map(
    (signed ?? [])
      .filter((entry) => entry.signedUrl && !entry.error)
      .map((entry) => [entry.path, entry.signedUrl] as const),
  );

  return cards.map((card, index) => {
    const path = rows[index].photo_path;
    return path ? { ...card, photoUrl: urls.get(path) ?? null } : card;
  });
}

/**
 * The considered few.
 *
 * Three by default, and the database returns the same three all day for the same
 * viewer. That is the point: a set that changes on every refresh is a feed with
 * extra steps, and refreshing until something better appears is exactly the
 * behaviour Eraya is trying not to produce.
 */
export async function getIntroductions(count = 3): Promise<MemberCard[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("discover_members", {
    max_results: count,
  });

  /*
   * Counted here rather than in the page, so a fetch is the unit and a re-render
   * is not. `discover_members` is STABLE and cannot write, hence the separate
   * call. Never awaited: a funnel measurement must not delay the screen, and if
   * it fails the member should never know.
   */
  void supabase.rpc("record_discovery_view").then(undefined, () => {});

  return toCards(supabase, (data ?? []) as RawCard[]);
}

export async function getMember(id: string): Promise<MemberCard | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("member_profile", { member_id: id });
  const rows = (data ?? []) as RawCard[];
  if (!rows[0]) return null;
  return (await toCards(supabase, [rows[0]]))[0];
}

/**
 * How many people have expressed interest. Never who.
 *
 * There is no companion function returning the identities, at any tier — the
 * one that used to was deleted rather than gated, so this is not a summary of
 * something richer a client could ask for instead. See
 * `supabase/migrations/20260920100100_interest_awareness.sql`.
 *
 * Zero when the call fails, because zero is the value that renders nothing. The
 * alternative is inventing a number on a page whose whole claim is that its
 * numbers are real.
 */
export async function getInterestsReceivedCount(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("interests_received_count");
  return typeof data === "number" ? data : 0;
}

export type Connection = {
  id: string;
  member: MemberCard;
  connectedAt: string;
  endedAt: string | null;
  lastMessage: { body: string; at: string; fromMe: boolean } | null;
  /**
   * Something here this member has not read.
   *
   * Computed from their own marker and the last message, exactly as
   * `my_conversations` does it in SQL -- newest message is the other person's,
   * and it arrived after the last time this member opened the conversation.
   * Never true of your own message: the sender is not waiting on themselves.
   *
   * It is on the row so the list can say *which* conversations the badge in the
   * navigation is counting. A number on the nav that a member cannot resolve to
   * a row is a number that makes them open every conversation to find it.
   */
  unread: boolean;
};

/**
 * People this member has connected with, most recently active first.
 *
 * Ordered by the last thing said rather than when the connection formed —
 * a conversation from this morning matters more than one that opened in March
 * and went quiet.
 */
export async function getConnections(): Promise<Connection[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows } = await supabase
    .from("connections")
    // The two read markers come along for the ride. They cost nothing here --
    // the row is already being fetched -- and save a query per connection to
    // work out which rows the navigation badge is counting.
    .select(
      "id, member_a, member_b, created_at, ended_at, member_a_read_at, member_b_read_at",
    )
    .order("created_at", { ascending: false });

  if (!rows?.length) return [];

  const connections = await Promise.all(
    rows.map(async (row) => {
      const otherId = row.member_a === user.id ? row.member_b : row.member_a;
      const member = await getMember(otherId);
      if (!member) return null;

      const { data: last } = await supabase
        .from("messages")
        .select("body, created_at, sender_id")
        .eq("connection_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const myReadAt =
        row.member_a === user.id ? row.member_a_read_at : row.member_b_read_at;

      return {
        id: row.id,
        member,
        connectedAt: row.created_at,
        endedAt: row.ended_at,
        lastMessage: last
          ? {
              body: last.body,
              at: last.created_at,
              fromMe: last.sender_id === user.id,
            }
          : null,
        unread: Boolean(
          last &&
            last.sender_id !== user.id &&
            (!myReadAt ||
              Date.parse(last.created_at) > Date.parse(myReadAt)),
        ),
      } satisfies Connection;
    }),
  );

  return connections
    .filter((c): c is Connection => c !== null)
    .sort((a, b) => {
      const aAt = a.lastMessage?.at ?? a.connectedAt;
      const bAt = b.lastMessage?.at ?? b.connectedAt;
      return bAt.localeCompare(aAt);
    });
}

export type Message = {
  id: string;
  body: string;
  at: string;
  fromMe: boolean;
};

export async function getConversation(
  connectionId: string,
): Promise<{ connection: Connection; messages: Message[] } | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS limits this to connections the caller is part of, so a guessed id
  // returns nothing rather than someone else's conversation.
  const { data: row } = await supabase
    .from("connections")
    .select("id, member_a, member_b, created_at, ended_at")
    .eq("id", connectionId)
    .maybeSingle();

  if (!row) return null;

  const otherId = row.member_a === user.id ? row.member_b : row.member_a;
  const member = await getMember(otherId);
  if (!member) return null;

  const { data: rows } = await supabase
    .from("messages")
    .select("id, body, created_at, sender_id")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: true });

  const messages: Message[] = (rows ?? []).map((m) => ({
    id: m.id,
    body: m.body,
    at: m.created_at,
    fromMe: m.sender_id === user.id,
  }));

  return {
    connection: {
      id: row.id,
      member,
      connectedAt: row.created_at,
      endedAt: row.ended_at,
      lastMessage: null,
      /*
       * False on the conversation screen, always.
       *
       * Opening it is what marks it read, so by the time anything renders this
       * there is nothing unread left in it. The field exists for the list,
       * which is the only place the distinction does any work.
       */
      unread: false,
    },
    messages,
  };
}

/** How complete this member's own profile is, for the quiet nudge on home. */
export async function getProfileCompleteness(): Promise<{
  done: number;
  total: number;
  missing: string[];
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { done: 0, total: 0, missing: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "first_name, date_of_birth, gender, city_id, other_city, relationship_status, languages_undisclosed, phone_verified_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  const { data: languages } = await supabase
    .from("profile_languages")
    .select("language_id")
    .eq("profile_id", user.id);

  const checks: { label: string; done: boolean }[] = [
    { label: "Your name", done: Boolean(profile?.first_name) },
    { label: "Your age", done: Boolean(profile?.date_of_birth) },
    { label: "Your city", done: Boolean(profile?.city_id ?? profile?.other_city) },
    { label: "Your chapter", done: Boolean(profile?.relationship_status) },
    {
      label: "Languages",
      done: Boolean(profile?.languages_undisclosed) || (languages?.length ?? 0) > 0,
    },
    { label: "Phone number added", done: Boolean(profile?.phone_verified_at) },
  ];

  return {
    done: checks.filter((c) => c.done).length,
    total: checks.length,
    missing: checks.filter((c) => !c.done).map((c) => c.label),
  };
}

// ---------------------------------------------------------------------------
// Activity indicators
// ---------------------------------------------------------------------------

export type ActivitySummary = {
  /** Connections made since this member last opened the Connections list. */
  newConnections: number;
  /** Conversations with something unread. Conversations, never messages. */
  unreadConversations: number;
  /**
   * The union of the two, without double-counting a new connection that has
   * already said something.
   *
   * The web has four destinations and conversations live inside Connections, so
   * one badge has to speak for both kinds of thing -- see `nav.ts` on why there
   * is no Messages tab here. The app, which has both tabs, uses the two numbers
   * above and ignores this one.
   */
  connectionsNeedingAttention: number;
};

const NO_ACTIVITY: ActivitySummary = {
  newConnections: 0,
  unreadConversations: 0,
  connectionsNeedingAttention: 0,
};

/**
 * What is waiting for this member, as three integers.
 *
 * Zero on any failure, deliberately. A badge is a hint, and the honest
 * behaviour when the hint cannot be fetched is to show nothing -- an error
 * state on the navigation of every page would be a far larger wrong than a
 * badge that appears a moment later, and a stale non-zero count would send
 * somebody to a screen with nothing on it.
 */
export async function getActivitySummary(): Promise<ActivitySummary> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("activity_summary");
  const row = Array.isArray(data) ? data[0] : null;

  if (error || !row) return NO_ACTIVITY;

  return {
    newConnections: row.new_connections ?? 0,
    unreadConversations: row.unread_conversations ?? 0,
    connectionsNeedingAttention: row.connections_needing_attention ?? 0,
  };
}
