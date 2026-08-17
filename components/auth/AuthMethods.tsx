"use client";

import Link from "next/link";

import { AuthDivider } from "@/components/auth/AuthDivider";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { secondaryButtonClasses } from "@/components/ui/SecondaryButton";
import { authRoutes } from "@/lib/auth/flow";
import type { SocialProviderId } from "@/lib/auth/types";

/**
 * The block of choices shared by "Welcome back." and "Welcome to Eraya." —
 * identical mechanics, different words around them.
 *
 * With no account database there is still no difference between signing in and
 * signing up: Supabase creates the account on first sign-in either way. Which
 * door someone came through is carried in the email link's `from` parameter,
 * purely so the back button returns them to it.
 */
export function AuthMethods({
  providers,
  emailHref,
  emailCta,
  dividerLabel,
  switchPrompt,
  switchCta,
  switchHref,
}: {
  /** Social providers Supabase actually has configured. May be empty. */
  providers: readonly SocialProviderId[];
  emailHref: string;
  emailCta: string;
  dividerLabel: string;
  switchPrompt: string;
  switchCta: string;
  switchHref: typeof authRoutes.login | typeof authRoutes.signup;
}) {
  return (
    <div>
      {/*
        Only offer what works. With no configured provider the social block and
        its "or" divider disappear entirely, leaving email as the single, whole
        choice — rather than three buttons that would throw someone out of the
        site onto a Supabase error page.
      */}
      {providers.length > 0 ? (
        <>
          <SocialLoginButtons providers={providers} />
          <AuthDivider label={dividerLabel} />
        </>
      ) : null}

      {/* A link, wearing the secondary button's skin — never a button inside
          an anchor, which is invalid and confuses assistive technology. */}
      <Link href={emailHref} className={`${secondaryButtonClasses} w-full`}>
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
