"use client";

import Link from "next/link";
import { useEffect } from "react";

import { AuthDivider } from "@/components/auth/AuthDivider";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { secondaryButtonClasses } from "@/components/ui/SecondaryButton";
import { useAuth } from "@/lib/auth/AuthSessionProvider";
import { authRoutes } from "@/lib/auth/flow";
import type { AuthIntent } from "@/lib/auth/types";

/**
 * The block of choices shared by "Welcome back." and "Welcome to Eraya." —
 * identical mechanics, different words around them.
 *
 * Whether someone arrives through login or signup is remembered as `intent`.
 * It changes nothing today, because with no account database a returning member
 * and a new one take the same path; it is recorded so that when accounts exist,
 * the two can diverge without rebuilding these screens.
 */
export function AuthMethods({
  intent,
  emailCta,
  dividerLabel,
  switchPrompt,
  switchCta,
  switchHref,
}: {
  intent: AuthIntent;
  emailCta: string;
  dividerLabel: string;
  switchPrompt: string;
  switchCta: string;
  switchHref: typeof authRoutes.login | typeof authRoutes.signup;
}) {
  const { setIntent } = useAuth();

  useEffect(() => {
    setIntent(intent);
  }, [intent, setIntent]);

  return (
    <div>
      <SocialLoginButtons />

      <AuthDivider label={dividerLabel} />

      {/* A link, wearing the secondary button's skin — never a button inside
          an anchor, which is invalid and confuses assistive technology. */}
      <Link
        href={authRoutes.email}
        className={`${secondaryButtonClasses} w-full`}
      >
        {emailCta}
      </Link>

      <p className="mt-8 text-center text-[0.95rem] text-ink-muted">
        {switchPrompt}{" "}
        <Link
          href={switchHref}
          className="font-medium text-ember-text underline underline-offset-4 hover:text-ember-strong"
        >
          {switchCta}
        </Link>
      </p>
    </div>
  );
}
