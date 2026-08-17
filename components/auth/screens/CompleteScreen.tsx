"use client";

import Link from "next/link";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { StartOverLink } from "@/components/auth/StartOverLink";
import { SuccessMessage } from "@/components/auth/SuccessMessage";
import { WebAppNote } from "@/components/auth/WebAppNote";
import { secondaryButtonClasses } from "@/components/ui/SecondaryButton";
import { completeStep } from "@/content/auth";
import { authRoutes } from "@/lib/auth/flow";
import { useAuthGuard } from "@/lib/auth/useAuthGuard";

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
          Profile setup is the next phase of work and has no route yet. Rather
          than link to a 404, this returns to Eraya — and the button will point
          at the profile builder the moment it exists.
        */}
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
