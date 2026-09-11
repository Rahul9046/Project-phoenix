import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Reading the moderation queue.
 *
 * Everything goes through `admin_list_reports`, which checks `is_moderator()`
 * inside the database. There is deliberately no direct table read here: a query
 * against `member_reports` would work for a service-role client and silently
 * become a way to bypass the check the moment somebody reached for one.
 */

export type ReportFilter = "open" | "resolved" | "all";

export type ReportRow = {
  id: string;
  status: "received" | "reviewing" | "actioned" | "dismissed";
  reasonCode: string;
  description: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reporterId: string;
  reporterName: string | null;
  reportedId: string;
  reportedName: string | null;
  reportedSuspendedAt: string | null;
  reportsAgainstReported: number;
};

export async function listReports(filter: ReportFilter): Promise<ReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_reports", { p_filter: filter });

  if (error || !Array.isArray(data)) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    status: row.status as ReportRow["status"],
    reasonCode: String(row.reason_code),
    description: (row.description as string) ?? null,
    createdAt: String(row.created_at),
    reviewedAt: (row.reviewed_at as string) ?? null,
    reporterId: String(row.reporter_id),
    reporterName: (row.reporter_name as string) ?? null,
    reportedId: String(row.reported_id),
    reportedName: (row.reported_name as string) ?? null,
    reportedSuspendedAt: (row.reported_suspended_at as string) ?? null,
    reportsAgainstReported: Number(row.reports_against_reported ?? 0),
  }));
}

/** The fixed categories, in the reporter's language rather than the column's. */
export const reasonLabels: Record<string, string> = {
  fake_profile: "Fake profile",
  harassment: "Harassment",
  inappropriate_content: "Inappropriate content",
  scam: "Scam or money request",
  incorrect_relationship_status: "Relationship status looks wrong",
  other: "Something else",
};

export const statusLabels: Record<ReportRow["status"], string> = {
  received: "Open",
  reviewing: "Being looked at",
  actioned: "Actioned",
  dismissed: "Dismissed",
};
