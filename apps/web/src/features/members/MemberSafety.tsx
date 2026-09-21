"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  REPORT_REASONS,
  reportNeedsDetails,
  reportReasonKey,
  type ReportReasonCode,
} from "@eraya/i18n";

import { useT } from "@/features/i18n/LocaleProvider";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { endConnection } from "@/features/members/actions";
import { reportAndBlockMember } from "@/features/members/report";

/**
 * The way out.
 *
 * `endConnection`, `blockMember` and `reportMember` all existed, all had RLS
 * policies behind them, and none of them could be reached from anywhere in the
 * interface. The copy strings for the three buttons were sitting unused in the
 * content file. So a member in a conversation that had turned unpleasant could
 * do exactly nothing about it except close the tab -- in a product whose whole
 * proposition is meeting strangers safely.
 *
 * It sits on a profile as well as in a conversation, which is why it is no
 * longer called `ConversationSafety`. Reporting only from inside a conversation
 * meant a fake, a stranger's stolen photographs, or somebody plainly under
 * eighteen could be seen in discovery and not reported, because reporting them
 * required first being introduced to them. The app already offered both places;
 * the website offered one.
 *
 * Five deliberate choices about how it behaves:
 *
 * Reporting blocks as well, and the two are one call. `report_and_block_member`
 * writes both rows or neither, so there is no outcome where a member has told
 * us they are frightened of somebody and that somebody can still see them.
 *
 * The reason is chosen from a fixed list rather than typed. Free text cannot be
 * counted or triaged, and "he was weird" and "she asked me for money" need
 * completely different responses. Exactly one reason: a report that claims four
 * things at once is a report nobody can act on first.
 *
 * Written details are optional, except for "Something else" -- every other
 * category says what happened by itself, and that one says nothing at all.
 *
 * The wording never promises a review. There is no moderation team and no
 * queue, so it says the report is recorded and the person is blocked -- both
 * true -- and nothing about anyone reading it. What it does now say, once the
 * report is in, is both of those facts plainly: somebody who has just done a
 * frightening thing should not have to infer from a redirect that it worked.
 *
 * Ending a connection appears only where there is one to end. Reporting and its
 * block need no connection at all, which is the whole point of it being here.
 */

type Mode = "idle" | "end" | "report" | "reported";

export function MemberSafety({
  memberId,
  otherName,
  connectionId,
  ended = false,
  doneHref,
}: {
  memberId: string;
  otherName: string;
  /** Absent on the profile of somebody this member is not connected to. */
  connectionId?: string;
  /** An ended connection can still be blocked and reported, just not ended. */
  ended?: boolean;
  /**
   * Where "Done" goes once the report is filed. Named by the caller rather
   * than guessed from the connection, because the page a member came from is
   * the one they expect to land back on.
   */
  doneHref: string;
}) {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [reason, setReason] = useState<ReportReasonCode | null>(null);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const reasonGroup = useId();

  const detailsRequired = reason !== null && reportNeedsDetails(reason);

  function reset() {
    setMode("idle");
    setReason(null);
    setDetails("");
    setError(null);
    setDetailsError(null);
  }

  async function run(work: () => Promise<{ ok: boolean }>, after: () => void) {
    if (pending) return;
    setPending(true);
    setError(null);

    // Wrapped: a server action can reject rather than return, and an unhandled
    // rejection here would leave the button stuck mid-sentence.
    let result: { ok: boolean };
    try {
      result = await work();
    } catch {
      result = { ok: false };
    }

    if (!result.ok) {
      setError(
        "We could not do that just now. Please try again in a moment, or write to us.",
      );
      setPending(false);
      return;
    }

    setPending(false);
    after();
  }

  async function submitReport() {
    if (pending || reason === null) return;

    // Checked before the request so the member is told what is missing rather
    // than being handed a failure. The database checks it too.
    if (reportNeedsDetails(reason) && !details.trim()) {
      setDetailsError(t("report.detailsMissing"));
      return;
    }

    setPending(true);
    setError(null);
    setDetailsError(null);

    let outcome: Awaited<ReturnType<typeof reportAndBlockMember>>;
    try {
      outcome = await reportAndBlockMember(memberId, reason, details);
    } catch {
      outcome = { ok: false, problem: "failed" };
    }

    setPending(false);

    if (!outcome.ok) {
      if (outcome.problem === "details") {
        setDetailsError(t("report.detailsMissing"));
        return;
      }
      setError(
        outcome.problem === "reason"
          ? t("report.reasonMissing")
          : t("report.failed"),
      );
      return;
    }

    /*
     * Nothing is refreshed here, deliberately. On a profile, re-rendering the
     * page the member is standing on turns the confirmation into a 404 -- the
     * profile exists only while `member_profile` returns the member, and it
     * has just stopped doing so. See `report.ts` for why the call itself is
     * made from the browser for the same reason.
     */
    setMode("reported");
  }

  return (
    <section aria-label="Safety" className="mt-14 border-t border-line pt-6">
      {mode === "idle" ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {connectionId && !ended ? (
            <SafetyButton onClick={() => setMode("end")}>
              {t("messages.endCta")}
            </SafetyButton>
          ) : null}
          <SafetyButton onClick={() => setMode("report")}>
            {t("messages.reportCta")}
          </SafetyButton>
        </div>
      ) : null}

      {mode === "end" && connectionId ? (
        <Confirm
          title={`End your connection with ${otherName}?`}
          body="Neither of you will be able to send anything further. What has already been said stays readable to you both. This cannot be undone."
          cancel="Keep the connection"
          confirm={t("messages.endCta")}
          pending={pending}
          pendingLabel="Ending…"
          error={error}
          onCancel={reset}
          onConfirm={() =>
            run(
              () => endConnection(connectionId),
              () => {
                reset();
                router.refresh();
              },
            )
          }
        />
      ) : null}

      {mode === "report" ? (
        <Confirm
          title={t("report.title", { name: otherName })}
          body={t("report.body", { name: otherName })}
          cancel={t("report.cancel")}
          confirm={t("report.submit", { name: otherName })}
          pending={pending}
          pendingLabel={t("report.submitting")}
          error={error}
          disabled={reason === null}
          onCancel={reset}
          onConfirm={() => void submitReport()}
        >
          <p className="mt-4 rounded-xl bg-sand px-4 py-3 text-meta leading-relaxed text-ink-subtle">
            {t("report.note")}
          </p>

          <fieldset className="mt-6">
            <legend className="text-[0.95rem] font-medium text-ink">
              {t("report.reasonLabel", { name: otherName })}
            </legend>

            <div className="mt-3 space-y-2">
              {REPORT_REASONS.map((code) => (
                <label
                  key={code}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-[0.95rem] transition-colors ${
                    reason === code
                      ? "border-ember bg-surface text-ink"
                      : "border-line-strong bg-canvas text-ink-muted hover:border-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name={reasonGroup}
                    value={code}
                    checked={reason === code}
                    disabled={pending}
                    onChange={() => {
                      setReason(code);
                      setDetailsError(null);
                    }}
                    className="h-4 w-4 accent-ember-text"
                  />
                  {t(reportReasonKey(code))}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-6 block">
            <span className="text-[0.95rem] font-medium text-ink">
              {t("report.detailsLabel")}
            </span>
            <span className="mt-1 block text-meta text-ink-subtle">
              {detailsRequired
                ? t("report.detailsRequired")
                : t("report.detailsOptional")}
            </span>
            <textarea
              value={details}
              onChange={(event) => {
                setDetails(event.target.value);
                if (detailsError) setDetailsError(null);
              }}
              rows={4}
              maxLength={2000}
              disabled={pending}
              required={detailsRequired}
              aria-invalid={detailsError ? true : undefined}
              className="mt-2 w-full resize-y rounded-2xl border border-line-strong bg-canvas p-4 text-[0.95rem] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink disabled:opacity-60"
              placeholder={t("report.detailsPlaceholder")}
            />
            {detailsError ? (
              <ErrorMessage className="mt-2">{detailsError}</ErrorMessage>
            ) : null}
          </label>
        </Confirm>
      ) : null}

      {mode === "reported" ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-ember/40 bg-sand/40 p-5 sm:p-6"
        >
          <p className="text-name text-ink">
            {t("report.doneTitle", { name: otherName })}
          </p>
          <p className="mt-2.5 leading-relaxed text-ink-muted">
            {t("report.doneBody", { name: otherName })}
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                reset();
                // No refresh: every destination is a dynamic route, so it is
                // rendered afresh on arrival and already knows about the block.
                router.push(doneHref);
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-line-strong bg-surface px-6 text-[0.95rem] font-medium text-ink transition-colors hover:border-ink hover:bg-sand"
            >
              {t("report.doneCta")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SafetyButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center text-[0.9rem] text-ink-subtle underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink"
    >
      {children}
    </button>
  );
}

/**
 * Expands in place rather than opening a modal, matching account deletion.
 * The calm option comes first, and is the one a thumb finds by habit.
 */
function Confirm({
  title,
  body,
  cancel,
  confirm,
  pending,
  pendingLabel,
  error,
  disabled = false,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  body: string;
  cancel: string;
  confirm: string;
  pending: boolean;
  pendingLabel: string;
  error: string | null;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={title}
      className="rounded-2xl border border-ember/40 bg-sand/40 p-5 sm:p-6"
    >
      <p className="text-name text-ink">{title}</p>
      <p className="mt-2.5 leading-relaxed text-ink-muted">{body}</p>

      {children}

      {error ? <ErrorMessage className="mt-5">{error}</ErrorMessage> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-line-strong bg-surface px-5 text-[0.95rem] font-medium text-ink transition-colors hover:border-ink hover:bg-sand disabled:opacity-60"
        >
          {cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending || disabled}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-ember-text px-5 text-[0.95rem] font-medium text-canvas transition-colors hover:bg-ember-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? pendingLabel : confirm}
        </button>
      </div>
    </div>
  );
}
