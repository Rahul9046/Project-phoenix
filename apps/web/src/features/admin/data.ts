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
  /**
   * Decided by the database, not here.
   *
   * `admin_list_reports` returns it, and the same category list drives the
   * ordering in that function -- so "this is a child safety matter" has one
   * definition, next to the thing that depends on it. Re-deriving it in
   * TypeScript would be a second list to keep in step, and the way its drift
   * would show is a report sorted to the top of the queue without the mark that
   * explains why.
   */
  isChildSafety: boolean;
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
    isChildSafety: row.is_child_safety === true,
  }));
}

/**
 * Reports that outlived the account they were about.
 *
 * `member_reports` cascades from `profiles`, so deleting an account used to
 * delete every report filed about it. `profiles_archive_reports` now copies
 * them out before the cascade, and this is the only way to read what it kept.
 *
 * Separate from `listReports` rather than merged into the queue, because these
 * are not actionable: the member is gone, so there is nobody left to suspend or
 * restore. They are a record, and a record of a different kind from a report
 * waiting for a decision.
 *
 * `admin_list_archived_reports` writes a `moderation_actions` row on every
 * call, so this function reading is itself on the record. That is why it is not
 * called on the main queue page -- a read that audits itself should happen
 * because somebody asked for it.
 */
export type ArchivedReportRow = {
  id: string;
  reasonCode: string;
  description: string | null;
  status: string;
  createdAt: string;
  reporterId: string | null;
  reportedId: string | null;
  archivedAt: string;
  archivedFor: string | null;
  isChildSafety: boolean;
};

/**
 * `null` means the archive could not be read, which is not the same as the
 * archive being empty -- and the difference matters enough to be in the type.
 *
 * `listReports` above returns `[]` on failure and the queue says "Nothing
 * waiting", which is the older pattern and a mild lie. Here it would be a
 * confident one: the empty state tells a moderator that no account with a
 * report against it has ever been deleted, and the likeliest reason this call
 * fails is that `admin_list_archived_reports` does not exist yet -- the window
 * between the web deploy and the migration being applied, which is a real
 * window because they are separately approved. Reporting "nothing preserved"
 * then would be the house rule about never showing what Eraya has not checked,
 * broken in the one place where somebody is looking for evidence.
 */
export async function listArchivedReports(): Promise<ArchivedReportRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_archived_reports");

  if (error || !Array.isArray(data)) return null;

  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    reasonCode: String(row.reason_code),
    description: (row.description as string) ?? null,
    status: String(row.status),
    createdAt: String(row.created_at),
    reporterId: (row.reporter_id as string) ?? null,
    reportedId: (row.reported_id as string) ?? null,
    archivedAt: String(row.archived_at),
    archivedFor: (row.archived_for as string) ?? null,
    isChildSafety: row.is_child_safety === true,
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
  csae: "Child sexual abuse or exploitation",
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
