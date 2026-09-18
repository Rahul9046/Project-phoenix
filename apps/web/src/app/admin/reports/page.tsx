import type { Metadata } from "next";
import Link from "next/link";

import { requireModerator } from "@/features/admin/access";
import { ReportActions } from "@/features/admin/ReportActions";
import {
  listReports,
  reasonLabels,
  statusLabels,
  type ReportFilter,
} from "@/features/admin/data";

/**
 * The moderation queue.
 *
 * Members could already report each other; nothing read the rows. This is the
 * screen that makes the report button mean something, and it is deliberately
 * plain: a list, three actions, and enough context to decide. No charts, no
 * counts to optimise, no queue-clearing pressure. Somebody described being made
 * uncomfortable by a stranger, and the job is to read it and act.
 *
 * Not part of the signed-in shell and not linked from anywhere. Reached by
 * typing the address, guarded server-side, and invisible to anyone else --
 * `requireModerator()` answers with a 404 rather than a 403 so the page does not
 * confirm its own existence to someone probing.
 */

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

const FILTERS: { key: ReportFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

function when(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/*
 * Typed explicitly rather than with `PageProps<"/admin/reports">`. Next derives
 * that union from routes it has already built, so a brand-new route cannot
 * reference its own type until after a build has produced it -- which makes the
 * first typecheck of any new page fail for a reason that has nothing to do with
 * the page.
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModerator();

  const params = await searchParams;
  const raw = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const filter: ReportFilter = raw === "resolved" || raw === "all" ? raw : "open";

  const reports = await listReports(filter);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-heading text-ink">Reports</h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-muted">
        Someone took the trouble to tell us about another member. Read what they
        said before deciding.
      </p>

      <nav className="mt-8 flex gap-2" aria-label="Filter reports">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/reports?filter=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-label transition-colors ${
              filter === f.key
                ? "bg-ember text-surface"
                : "border border-line text-ink-muted hover:border-line-strong"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {reports.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-ink-muted">
            {filter === "open"
              ? "Nothing waiting. Every report has been looked at."
              : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {reports.map((report) => (
            <li
              key={report.id}
              className="rounded-2xl border border-line bg-surface p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-name text-ink">
                  {reasonLabels[report.reasonCode] ?? report.reasonCode}
                </p>
                <p className="text-meta text-ink-subtle">{when(report.createdAt)}</p>
              </div>

              <p className="mt-2 text-meta text-ink-subtle">
                {report.reporterName ?? "A member"} reported{" "}
                <span className="text-ink-muted">{report.reportedName ?? "a member"}</span>
                {report.reportsAgainstReported > 1 ? (
                  <>
                    {" · "}
                    <strong className="text-ember-text">
                      {report.reportsAgainstReported} reports against this member
                    </strong>
                  </>
                ) : null}
                {report.reportedSuspendedAt ? " · currently suspended" : null}
                {" · "}
                {statusLabels[report.status]}
              </p>

              {report.description ? (
                <p className="mt-4 whitespace-pre-wrap rounded-xl bg-sand px-4 py-3 text-[0.95rem] leading-relaxed text-ink-muted">
                  {report.description}
                </p>
              ) : (
                <p className="mt-4 text-[0.95rem] italic text-ink-subtle">
                  No description was given.
                </p>
              )}

              <ReportActions
                reportId={report.id}
                reportedId={report.reportedId}
                reportedName={report.reportedName}
                suspended={Boolean(report.reportedSuspendedAt)}
                resolved={report.status === "actioned" || report.status === "dismissed"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
