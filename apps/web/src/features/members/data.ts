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
  };
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
  return ((data ?? []) as RawCard[]).map(toCard);
}

export async function getMember(id: string): Promise<MemberCard | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("member_profile", { member_id: id });
  const rows = (data ?? []) as RawCard[];
  return rows[0] ? toCard(rows[0]) : null;
}

/**
 * Who has expressed interest. Premium.
 *
 * The database checks the subscription, not this function — so an empty array
 * genuinely means "not premium, or nobody yet", and cannot be argued with by
 * calling the API directly.
 */
export async function getInterestsReceived(): Promise<MemberCard[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("interests_received");
  return ((data ?? []) as RawCard[]).map(toCard);
}

export type Connection = {
  id: string;
  member: MemberCard;
  connectedAt: string;
  endedAt: string | null;
  lastMessage: { body: string; at: string; fromMe: boolean } | null;
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
    .select("id, member_a, member_b, created_at, ended_at")
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
    { label: "Phone verified", done: Boolean(profile?.phone_verified_at) },
  ];

  return {
    done: checks.filter((c) => c.done).length,
    total: checks.length,
    missing: checks.filter((c) => !c.done).map((c) => c.label),
  };
}
