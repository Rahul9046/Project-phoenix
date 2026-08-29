"use client";

import Link from "next/link";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { StartOverLink } from "@/features/auth/components/StartOverLink";
import { SuccessMessage } from "@/features/auth/components/SuccessMessage";
import { WebAppNote } from "@/features/auth/components/WebAppNote";
import { primaryButtonClasses } from "@/shared/ui/PrimaryButton";
import { secondaryButtonClasses } from "@/shared/ui/SecondaryButton";
import { completeStep } from "@/features/auth/content";
import { appRoutes } from "@/features/app-shell/nav";
import { authRoutes } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";

/**
 * The handover out of signup.
 *
 * Profile building itself is not part of this task, so the primary action is
 * honest about being a boundary rather than pretending to open a screen that
 * does not exist yet.
 */
export function CompleteScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.complete);
  if (!allowed) return <AuthLoading />;

  const firstName = session.profile.firstName;

  return (
    <AuthLayout footer={<WebAppNote />}>
      <SuccessMessage className="mb-7 justify-start">
        Account created
      </SuccessMessage>

      <AuthHeader
        title={
          firstName ? `You're all set, ${firstName}.` : completeStep.title
        }
        lede={completeStep.lede}
        showLogo={false}
      />

      <div className="mt-9 grid gap-3">
        {/*
          The handover into the product. This used to point at "/" because the
          signed-in application did not exist; it does now, so the primary
          action goes there and the marketing site becomes the secondary way out.
        */}
        <Link href={appRoutes.home} className={`${primaryButtonClasses} w-full`}>
          {completeStep.cta}
        </Link>

        <Link href="/" className={`${secondaryButtonClasses} w-full`}>
          {completeStep.secondaryCta}
        </Link>
      </div>

      {/*
        Without this, a finished account is a one-way door: every entry screen
        redirects a signed-in person back here, so there would be no way to
        sign in as anyone else.
      */}
      <p className="mt-8 text-center text-[0.95rem] text-ink-muted">
        Not {firstName ?? "you"}? <StartOverLink label="Sign out" />
      </p>
    </AuthLayout>
  );
}
