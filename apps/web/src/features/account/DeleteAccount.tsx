"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { account } from "@/features/account/content";
import { deleteAccount } from "@/features/account/actions";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";

/**
 * Deleting an account, with a confirmation that is actually read.
 *
 * The confirmation expands in place rather than opening a modal. A modal over a
 * dimmed page is the same shape as a cookie banner or a newsletter prompt — the
 * thing people have been trained to dismiss without reading — and this is the
 * one message in the product that must not be dismissed reflexively.
 *
 * Two further deliberate choices:
 *
 * "Keep my account" comes first and is the visually calmer option. On an
 * irreversible action the safe path should be the easy one, and the destructive
 * button should not be where a thumb lands by habit.
 *
 * The consequences are listed, not summarised. "All your data will be deleted"
 * is a sentence people skim; naming the conversations that vanish for the other
 * person is the part somebody may genuinely not have considered.
 */
export function DeleteAccount() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  // Move focus into the confirmation when it opens, so it is announced rather
  // than silently appearing below the button that was just pressed.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  async function handleDelete() {
    if (pending) return;
    setPending(true);
    setError(null);

    /*
     * Wrapped, because a server action can throw rather than return -- a missing
     * environment variable does exactly that. Without this the rejection is
     * unhandled, `pending` never clears, and the button sits on "Deleting…"
     * forever with nothing explaining why. That is a worse failure than the one
     * it was hiding.
     */
    let result;
    try {
      result = await deleteAccount();
    } catch {
      setError(
        "We could not delete your account just now. Please try again, or write to us and a person will do it for you.",
      );
      setPending(false);
      return;
    }

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    // The account is gone. Show the farewell briefly, then leave — going
    // straight to the marketing site would feel like being ejected.
    setDone(true);
    setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 2600);
  }

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-name text-ink">{account.deletedTitle}</p>
        <p className="mt-2.5 leading-relaxed text-ink-muted">
          {account.deletedBody}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="max-w-2xl leading-relaxed text-ink-muted">
        {account.dangerBody}
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full border border-line-strong bg-surface px-6 text-[0.95rem] font-medium text-ember-text transition-colors hover:border-ember-text hover:bg-sand"
        >
          {account.dangerCta}
        </button>
      ) : (
        <div
          ref={confirmRef}
          tabIndex={-1}
          role="group"
          aria-label={account.confirmTitle}
          className="mt-5 rounded-2xl border border-ember/40 bg-sand/40 p-5 focus:outline-none sm:p-6"
        >
          <p className="text-name text-ink">{account.confirmTitle}</p>
          <p className="mt-2.5 leading-relaxed text-ink-muted">
            {account.confirmBody}
          </p>

          <ul className="mt-4 grid gap-2">
            {account.confirmList.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-[0.95rem] leading-relaxed text-ink-muted"
              >
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-subtle" />
                {item}
              </li>
            ))}
          </ul>

          {error ? <ErrorMessage className="mt-5">{error}</ErrorMessage> : null}

          {/* Keep first, and calmer. The safe option should be the easy one. */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={pending}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-line-strong bg-surface px-5 text-[0.95rem] font-medium text-ink transition-colors hover:border-ink hover:bg-sand disabled:opacity-60"
            >
              {account.confirmCancel}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-ember-text px-5 text-[0.95rem] font-medium text-canvas transition-colors hover:bg-ember-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? account.confirmPending : account.confirmCta}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
