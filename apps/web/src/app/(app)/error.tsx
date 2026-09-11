"use client";

import { useEffect } from "react";

import { errorState } from "@/features/app-shell/content";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";

/**
 * When a signed-in page throws.
 *
 * There was no error boundary anywhere in the app, which meant any failure in a
 * server component — the database unreachable, an RPC changing shape — replaced
 * the whole product with Next's default error page. On a relationship product
 * that is worse than it sounds: a stack-trace page in the middle of what someone
 * was doing reads as "this company is not really running", and the person it
 * happens to is often mid-conversation with a stranger.
 *
 * `reset()` re-renders the segment rather than reloading the browser, so trying
 * again keeps the member where they were.
 *
 * Deliberately not a 404 or an empty state. Those are ordinary outcomes that say
 * something true about the product; this says something went wrong on our side,
 * and conflating the two makes the product look empty when it is broken.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /*
     * The browser console is the only sink that exists today — there is no error
     * reporting service, deliberately, because adding one means sending members'
     * activity to a third party. `digest` is the server-side identifier Next
     * logs alongside the real stack, which is the thread to pull in the
     * Cloudflare logs. The message itself is not shown to the member: it can
     * carry internals, and none of it helps them.
     */
    console.error("Unhandled error in the signed-in app", error.digest ?? error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <h1 className="text-name text-ink">{errorState.title}</h1>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-ink-muted">
          {errorState.body}
        </p>

        <div className="mt-6 flex justify-center">
          <PrimaryButton fullWidth={false} onClick={reset}>{errorState.retry}</PrimaryButton>
        </div>

        <p className="mt-6 text-[0.9rem] leading-relaxed text-ink-subtle">
          {errorState.persists}
        </p>
      </div>
    </div>
  );
}
