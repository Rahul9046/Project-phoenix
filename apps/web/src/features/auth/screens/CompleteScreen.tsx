"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { StartOverLink } from "@/features/auth/components/StartOverLink";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { secondaryButtonClasses } from "@/shared/ui/SecondaryButton";
import { completeOnboarding } from "@/features/auth/actions";
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
  return <Complete firstName={session.profile.firstName} />;
}

function Complete({ firstName }: { firstName: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  /*
   * The stage is written here rather than by the last question, so somebody who
   * closes the tab on the languages screen is not silently marked complete --
   * and so the optional photo step still has somewhere to sit. It runs once, on
   * arrival.
   */
  useEffect(() => {
    void completeOnboarding().then(() => router.refresh());
  }, [router]);

  /*
   * Wait for that write before leaving.
   *
   * The signed-in shell sends an unfinished profile back to where it belongs,
   * which is this screen. So a link that navigates regardless means anybody who
   * reads the sentence quickly arrives at the shell before their profile says
   * they have finished, and is bounced straight back here -- the page twice,
   * looking as though the product has lost its place.
   *
   * Awaited rather than disabling the button: the write has almost always landed
   * by the time anyone presses, and on a slow connection a button that thinks
   * for a moment is better than one that cannot be pressed at all.
   */
  async function enter() {
    setPending(true);
    await completeOnboarding();
    router.push(appRoutes.home);
  }

  return (
    <AuthLayout>
      <div className="animate-rise text-center">
        <div className="flex justify-center">
          <ErayaMark className="h-20 w-20" />
        </div>

        <p className="mt-8 text-xs font-medium uppercase tracking-[0.22em] text-ember-text">
          {completeStep.eyebrow}
        </p>

        <h1 className="mt-5 text-heading text-ink">
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
        <PrimaryButton
          type="button"
          loading={pending}
          loadingLabel="Just a moment…"
          onClick={() => void enter()}
        >
          {completeStep.cta}
        </PrimaryButton>

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
