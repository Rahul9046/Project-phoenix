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

/**
 * The fixed categories, in the reporter's language rather than the column's.
 *
 * Every value the `report_reason` enum has ever held, including the two the
 * clients no longer offer. A moderator reading a report filed eighteen months
 * ago needs it to say what the person chose at the time, not `reason_code`
 * rendered raw because the picker moved on. Nothing is ever removed from here
 * for the same reason nothing is removed from the enum.
 *
 * Deliberately not translated. This screen is read by the two or three people
 * on the allowlist, in English, and a moderation queue that renders in the
 * moderator's chosen language would make two admins describe the same report
 * differently to each other.
 */
export const reasonLabels: Record<string, string> = {
  harassment: "Harassment or abusive behaviour",
  inappropriate_content: "Inappropriate or sexual content",
  fake_profile: "Fake or misleading profile",
  scam: "Scam or asking for money",
  spam: "Spam or unwanted promotion",
  safety_threat: "Threats or safety concern",
  underage: "Under 18",
  other: "Something else",

  // No longer offered by either client. Kept so the reports filed under it
  // still read as a sentence.
  incorrect_relationship_status: "Relationship status looks wrong",
};

export const statusLabels: Record<ReportRow["status"], string> = {
  received: "Open",
  reviewing: "Being looked at",
  actioned: "Actioned",
  dismissed: "Dismissed",
};
