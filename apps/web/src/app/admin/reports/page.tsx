import type { Metadata } from "next";
import Link from "next/link";

import { requireModerator } from "@/features/admin/access";
import { ReportActions } from "@/features/admin/ReportActions";
import {
  listArchivedReports,
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
 * Child safety reports are marked and come first. The ordering is
 * `admin_list_reports`'s, not this screen's -- but the mark is here, because a
 * list whose only signal is its order stops signalling the moment somebody
 * filters or scrolls it.
 *
 * "Preserved" is a fourth view rather than a fourth screen. It reads reports
 * that outlived the account they were about, which `profiles_archive_reports`
 * copies out before the ON DELETE CASCADE removes them. They carry no actions:
 * the member is gone, so there is nobody left to suspend. And the function
 * behind it records every read in `moderation_actions`, which is why it runs
 * only when this view is asked for and never as part of the main queue.
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

/**
 * `archived` is not a `ReportFilter`: it reads a different table through a
 * different function, so it is deliberately not passed to `admin_list_reports`.
 */
type View = ReportFilter | "archived";

const FILTERS: { key: View; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
  { key: "archived", label: "Preserved" },
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
  const view: View =
    raw === "resolved" || raw === "all" || raw === "archived" ? raw : "open";

  // Only one of the two is fetched. `listArchivedReports` writes an audit row
  // every time it runs, so calling it to render a tab nobody opened would put
  // reads in the record that never happened.
  const reports = view === "archived" ? [] : await listReports(view);
  // `null` is "could not be read", which this screen must not render as
  // "nothing has been preserved" -- see listArchivedReports.
  const archived = view === "archived" ? await listArchivedReports() : [];

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
            aria-current={view === f.key ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-label transition-colors ${
              view === f.key
                ? "bg-ember text-surface"
                : "border border-line text-ink-muted hover:border-line-strong"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {view === "archived" ? (
        <>
          <p className="mt-8 rounded-2xl border border-line bg-sand px-5 py-4 text-[0.95rem] leading-relaxed text-ink-muted">
            Reports about members whose accounts have since been deleted, kept
            so that deleting an account cannot delete the reports about it.
            There is nothing to action here — the account is gone. Names are
            not kept; the identifiers are, and the reporter&rsquo;s own words.
            Opening this view is recorded.
          </p>

          {archived === null ? (
            <div className="mt-6 rounded-2xl border border-ember bg-surface p-8 text-center">
              <p className="text-ink-muted">
                The preserved reports could not be read, so this view is not
                telling you there are none. If the archive has only just been
                deployed, check that the migration ran.
              </p>
            </div>
          ) : archived.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-line bg-surface p-8 text-center">
              <p className="text-ink-muted">
                Nothing preserved. No account with a report against it has been
                deleted.
              </p>
            </div>
          ) : (
            <ul className="mt-6 space-y-4">
              {archived.map((row) => (
                <li
                  key={row.id}
                  className={`rounded-2xl border bg-surface p-6 ${
                    row.isChildSafety
                      ? "border-ember ring-1 ring-ember/30"
                      : "border-line"
                  }`}
                >
                  {row.isChildSafety ? (
                    <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-ember px-3 py-1 text-meta font-medium uppercase tracking-wide text-surface">
                      Child safety · read first
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div>
                      <p className="text-meta uppercase tracking-wide text-ink-subtle">
                        Reason
                      </p>
                      <p className="mt-0.5 text-name text-ink">
                        {reasonLabels[row.reasonCode] ?? row.reasonCode}
                      </p>
                      <p className="mt-0.5 font-mono text-meta text-ink-subtle">
                        {row.reasonCode}
                      </p>
                    </div>
                    <p className="text-meta text-ink-subtle">
                      Filed {when(row.createdAt)}
                      <br />
                      Preserved {when(row.archivedAt)}
                    </p>
                  </div>

                  <p className="mt-2 font-mono text-meta text-ink-subtle">
                    reporter {row.reporterId ?? "—"} · reported{" "}
                    {row.reportedId ?? "—"}
                    {row.archivedFor ? (
                      <>
                        {" · "}
                        {row.archivedFor === row.reportedId
                          ? "the reported member deleted their account"
                          : "the reporter deleted their account"}
                      </>
                    ) : null}
                  </p>

                  <div className="mt-4">
                    <p className="text-meta uppercase tracking-wide text-ink-subtle">
                      Details
                    </p>
                    {row.description ? (
                      <p className="mt-1.5 whitespace-pre-wrap rounded-xl bg-sand px-4 py-3 text-[0.95rem] leading-relaxed text-ink-muted">
                        {row.description}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[0.95rem] italic text-ink-subtle">
                        None given.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : reports.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-ink-muted">
            {view === "open"
              ? "Nothing waiting. Every report has been looked at."
              : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {reports.map((report) => (
            <li
              key={report.id}
              className={`rounded-2xl border bg-surface p-6 ${
                report.isChildSafety
                  ? "border-ember ring-1 ring-ember/30"
                  : "border-line"
              }`}
            >
              {/*
                The mark, not just the position.
                `admin_list_reports` sorts these to the top, but a list whose
                order is the only signal is a list that stops signalling the
                moment somebody filters it or scrolls. So the row says what it
                is, and `is_child_safety` comes from the database -- the same
                category list that produced the ordering.
              */}
              {report.isChildSafety ? (
                <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-ember px-3 py-1 text-meta font-medium uppercase tracking-wide text-surface">
                  Child safety · read first
                </p>
              ) : null}

              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="text-meta uppercase tracking-wide text-ink-subtle">
                    Reason
                  </p>
                  <p className="mt-0.5 text-name text-ink">
                    {reasonLabels[report.reasonCode] ?? report.reasonCode}
                  </p>
                  {/* The stored identifier as well as its label. A category
                      added to the enum before this map catches up would
                      otherwise show a moderator nothing they could act on. */}
                  <p className="mt-0.5 font-mono text-meta text-ink-subtle">
                    {report.reasonCode}
                  </p>
                </div>
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

              <div className="mt-4">
                <p className="text-meta uppercase tracking-wide text-ink-subtle">
                  Details
                </p>
                {report.description ? (
                  <p className="mt-1.5 whitespace-pre-wrap rounded-xl bg-sand px-4 py-3 text-[0.95rem] leading-relaxed text-ink-muted">
                    {report.description}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[0.95rem] italic text-ink-subtle">
                    None given. Optional for every reason except “Something
                    else”, which cannot be filed without them.
                  </p>
                )}
              </div>

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
