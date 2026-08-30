"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * The things one member can do about another.
 *
 * All of them go through the database, which re-checks who is calling. Nothing
 * here trusts the id it was handed: `express_interest` verifies the caller,
 * refuses self-targeting, and honours blocks before writing anything.
 */

export type ActionResult =
  | { ok: true; connected: boolean }
  | { ok: false; message: string };

const GENERIC =
  "Something went wrong on our side. Please try again in a moment.";

export async function expressInterest(targetId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("express_interest", {
    target_id: targetId,
    decision: "interested",
  });

  if (error) return { ok: false, message: GENERIC };

  // A connection id comes back only when the interest was already returned.
  const connected = typeof data === "string" && data.length > 0;

  revalidatePath("/discovery");
  revalidatePath("/connections");
  revalidatePath("/home");

  return { ok: true, connected };
}

/**
 * "Not for me."
 *
 * Recorded rather than ignored, so the same person is not offered again
 * tomorrow. It tells them nothing — there is no notification, and no way for
 * them to learn they were passed over.
 */
export async function passOnMember(targetId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("express_interest", {
    target_id: targetId,
    decision: "passed",
  });

  if (error) return { ok: false, message: GENERIC };

  revalidatePath("/discovery");
  return { ok: true, connected: false };
}

export async function sendMessage(
  connectionId: string,
  body: string,
): Promise<{ ok: boolean; message?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: "Write something first." };
  if (trimmed.length > 4000) {
    return { ok: false, message: "That message is too long." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: GENERIC };

  // The insert policy also requires the connection to be open, so a message
  // cannot be sent into a conversation either person has ended.
  const { error } = await supabase.from("messages").insert({
    connection_id: connectionId,
    sender_id: user.id,
    body: trimmed,
  });

  if (error) return { ok: false, message: GENERIC };

  revalidatePath(`/connections/${connectionId}`);
  revalidatePath("/connections");
  return { ok: true };
}

/** Ends a connection. The conversation stays; nothing more can be sent. */
export async function endConnection(
  connectionId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("connections")
    .update({ ended_at: new Date().toISOString(), ended_by: user.id })
    .eq("id", connectionId);

  revalidatePath("/connections");
  return { ok: !error };
}

export async function blockMember(
  targetId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("member_blocks")
    .insert({ blocker_id: user.id, blocked_id: targetId });

  revalidatePath("/discovery");
  revalidatePath("/connections");
  return { ok: !error };
}

export async function reportMember(
  targetId: string,
  reason: string,
): Promise<{ ok: boolean }> {
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("member_reports")
    .insert({ reporter_id: user.id, reported_id: targetId, reason: trimmed });

  return { ok: !error };
}
