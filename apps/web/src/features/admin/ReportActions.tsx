"use client";

import { useState, useTransition } from "react";

import { dismissReport, restoreMember, suspendMember } from "@/features/admin/actions";

/**
 * The three decisions, and nothing else.
 *
 * Suspending asks for confirmation because it stops a real person using the
 * product and they are not told why by the system -- somebody has to decide that
 * is warranted, and a single click is too cheap for it. Dismissing does not:
 * it is reversible in the sense that matters, since the report stays readable
 * under "Resolved" and the member is unaffected.
 *
 * No "Warn" button. A warning nobody sends is a button that lies about what
 * happened, and the product has not decided what warning someone would mean.
 */
export function ReportActions({
  reportId,
  reportedId,
  reportedName,
  suspended,
  resolved,
}: {
  reportId: string;
  reportedId: string;
  reportedName: string | null;
  suspended: boolean;
  resolved: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function run(work: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    start(async () => {
      const result = await work();
      if (!result.ok) setError(result.message ?? "That did not go through.");
      setConfirming(false);
    });
  }

  const who = reportedName ?? "this member";

  return (
    <div className="mt-5 border-t border-line pt-4">
      {confirming ? (
        <div>
          <p className="text-[0.95rem] leading-relaxed text-ink-muted">
            Suspend {who}? They stop appearing in discovery and cannot express
            interest or send messages. Their account and data stay, and you can
            restore them.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => suspendMember(reportedId, "Reviewed after a report", reportId))}
              className="rounded-full bg-ember px-4 py-2 text-label text-surface disabled:opacity-60"
            >
              {pending ? "Suspending…" : "Yes, suspend"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-full border border-line px-4 py-2 text-label text-ink-muted disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!resolved ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => dismissReport(reportId))}
              className="rounded-full border border-line px-4 py-2 text-label text-ink-muted disabled:opacity-60"
            >
              {pending ? "Working…" : "Dismiss"}
            </button>
          ) : null}

          {suspended ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => restoreMember(reportedId))}
              className="rounded-full border border-line px-4 py-2 text-label text-ink-muted disabled:opacity-60"
            >
              {pending ? "Working…" : `Restore ${who}`}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(true)}
              className="rounded-full border border-line px-4 py-2 text-label text-ember-text disabled:opacity-60"
            >
              Suspend {who}
            </button>
          )}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-[0.9rem] text-ember-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
