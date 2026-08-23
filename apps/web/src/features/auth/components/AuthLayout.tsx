import Link from "next/link";

import { legal } from "@/features/auth/content";
import type { AuthRoute } from "@/features/auth/flow";

/**
 * The frame every auth and onboarding screen sits in.
 *
 * On a phone it fills the viewport and the content starts near the top, so the
 * heading is above the keyboard when a field takes focus. From `sm` up it
 * becomes a centred card-less column with real space around it — a desktop
 * layout in its own right rather than a stretched phone screen.
 */
export function AuthLayout({
  children,
  backHref,
  backLabel = "Back",
  progress,
  footer,
  showLegal = false,
}: {
  children: React.ReactNode;
  /** Renders a back link. Explicit routes beat `history.back()` — a person who
   *  deep-links into a screen still gets a working, predictable way out. */
  backHref?: AuthRoute | "/";
  backLabel?: string;
  progress?: React.ReactNode;
  footer?: React.ReactNode;
  showLegal?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col px-5 pb-10 pt-6 sm:items-center sm:justify-center sm:px-8 sm:py-14">
      <div className="mx-auto flex w-full max-w-[27rem] flex-1 flex-col sm:flex-none">
        {backHref ? (
          <div className="mb-6">
            <Link
              href={backHref}
              className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M12 4.5 6.5 10l5.5 5.5" />
              </svg>
              {backLabel}
            </Link>
          </div>
        ) : null}

        {progress ? <div className="mb-8">{progress}</div> : null}

        {children}

        {footer ? <div className="mt-10">{footer}</div> : null}

        {showLegal ? (
          <p className="mt-10 text-center text-sm leading-relaxed text-ink-subtle">
            {legal.prefix}{" "}
            <Link
              href={legal.terms.href}
              className="text-ember-text underline underline-offset-4 hover:text-ember-strong"
            >
              {legal.terms.label}
            </Link>{" "}
            {legal.and}{" "}
            <Link
              href={legal.privacy.href}
              className="text-ember-text underline underline-offset-4 hover:text-ember-strong"
            >
              {legal.privacy.label}
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
