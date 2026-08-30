"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { conversation } from "@/features/app-shell/content";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import {
  blockMember,
  endConnection,
  reportMember,
} from "@/features/members/actions";

/**
 * The way out of a conversation.
 *
 * `endConnection`, `blockMember` and `reportMember` all existed, all had RLS
 * policies behind them, and none of them could be reached from anywhere in the
 * interface. The copy strings for the three buttons were sitting unused in the
 * content file. So a member in a conversation that had turned unpleasant could
 * do exactly nothing about it except close the tab -- in a product whose whole
 * proposition is meeting strangers safely.
 *
 * Three deliberate choices about how it behaves:
 *
 * Reporting blocks as well. A report on its own would be a button that files
 * something into a table nobody is reading yet, which is an affordance that
 * looks like protection and is not. Blocking is immediate and enforced by
 * `discover_members`, so the report is recorded *and* something real happens.
 *
 * The wording never promises a review. There is no moderation team and no queue,
 * so it says the report is recorded and the person is blocked -- both true --
 * and nothing about anyone reading it.
 *
 * It sits quietly at the foot of the page, small and grey. Someone who needs it
 * must be able to find it instantly; everyone else should be able to forget it
 * is there.
 */

type Mode = "idle" | "end" | "report";

export function ConversationSafety({
  connectionId,
  memberId,
  otherName,
  ended,
}: {
  connectionId: string;
  memberId: string;
  otherName: string;
  /** An ended connection can still be blocked and reported, just not ended. */
  ended: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("idle");
    setReason("");
    setError(null);
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

  return (
    <section
      aria-label="Safety"
      className="mt-14 border-t border-line pt-6"
    >
      {mode === "idle" ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {!ended ? (
            <SafetyButton onClick={() => setMode("end")}>
              {conversation.endCta}
            </SafetyButton>
          ) : null}
          <SafetyButton onClick={() => setMode("report")}>
            {conversation.reportCta}
          </SafetyButton>
        </div>
      ) : null}

      {mode === "end" ? (
        <Confirm
          title={`End your connection with ${otherName}?`}
          body="Neither of you will be able to send anything further. What has already been said stays readable to you both. This cannot be undone."
          cancel="Keep the connection"
          confirm={conversation.endCta}
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
          title={`Report and block ${otherName}?`}
          body={`${otherName} will be blocked immediately — no messages, and neither of you will be shown to the other again. Your report is recorded with what you write below. Please tell us what happened; it is the only thing we will have to go on.`}
          cancel="Cancel"
          confirm={`Block ${otherName}`}
          pending={pending}
          pendingLabel="Blocking…"
          error={error}
          disabled={!reason.trim()}
          onCancel={reset}
          onConfirm={() =>
            run(
              async () => {
                const reported = await reportMember(memberId, reason);
                if (!reported.ok) return reported;
                // The block is what actually protects them, so it runs even if
                // the report somehow failed to record.
                return blockMember(memberId);
              },
              () => {
                reset();
                router.push("/connections");
                router.refresh();
              },
            )
          }
        >
          <label className="mt-5 block">
            <span className="text-[0.95rem] font-medium text-ink">
              What happened?
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              autoFocus
              disabled={pending}
              className="mt-2 w-full resize-y rounded-2xl border border-line-strong bg-canvas p-4 text-[0.95rem] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink disabled:opacity-60"
              placeholder="In your own words. A sentence is enough."
            />
          </label>
        </Confirm>
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
      <p className="font-serif text-xl text-ink">{title}</p>
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
