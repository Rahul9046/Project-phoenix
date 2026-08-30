"use client";

import Link from "next/link";

import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { StartOverLink } from "@/features/auth/components/StartOverLink";
import { primaryButtonClasses } from "@/shared/ui/PrimaryButton";
import { secondaryButtonClasses } from "@/shared/ui/SecondaryButton";
import { completeStep } from "@/features/auth/content";
import { appRoutes } from "@/features/app-shell/nav";
import { authRoutes } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import { ErayaMark } from "@/shared/brand/Logo";

/**
 * The end of signup.
 *
 * Given more room and less furniture than any other screen in the flow: no
 * progress marks, no back link, no "account created" receipt. Someone has just
 * answered questions about a divorce or a death in order to try again, and the
 * moment is worth a breath.
 *
 * The mark appears here at a size it takes nowhere else in the product. It is
 * the approved lockup exactly as supplied — rounded square, solid ground, no
 * surrounding circle — used once, where the phoenix actually means what the page
 * is saying, rather than sprinkled through the app as decoration.
 */
export function CompleteScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.complete);
  if (!allowed) return <AuthLoading />;

  const firstName = session.profile.firstName;

  return (
    <AuthLayout>
      <div className="animate-rise text-center">
        <div className="flex justify-center">
          <ErayaMark className="h-20 w-20" />
        </div>

        <p className="mt-8 text-xs font-medium uppercase tracking-[0.22em] text-ember-text">
          {completeStep.eyebrow}
        </p>

        <h1 className="mt-5 font-serif text-[2.1rem] leading-[1.15] tracking-[-0.02em] text-ink sm:text-[2.5rem]">
          {firstName
            ? `You're ready, ${firstName}.`
            : completeStep.title}
        </h1>

        <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-ink-muted">
          {completeStep.lede}
        </p>
      </div>

      {/*
        Two ways forward, and "not just yet" is a real one. A completion screen
        with a single insistent button treats leaving as a failure state; this is
        a product whose whole claim is that nothing is urgent.
      */}
      <div className="mt-11 grid gap-3">
        <Link href={appRoutes.home} className={`${primaryButtonClasses} w-full`}>
          {completeStep.cta}
        </Link>

        <Link href="/" className={`${secondaryButtonClasses} w-full`}>
          {completeStep.secondaryCta}
        </Link>
      </div>

      <p className="mt-9 text-center text-[0.95rem] text-ink-subtle">
        Not {firstName ?? "you"}? <StartOverLink label="Sign out" />
      </p>
    </AuthLayout>
  );
}
