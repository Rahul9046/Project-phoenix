"use client";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { emailStep } from "@/content/auth";
import { authRoutes } from "@/lib/auth/flow";
import { useAuthGuard } from "@/lib/auth/useAuthGuard";

export function EmailScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.email);
  if (!allowed) return <AuthLoading />;

  // Back goes to whichever door they came through.
  const backHref =
    session.intent === "signup" ? authRoutes.signup : authRoutes.login;

  return (
    <AuthLayout backHref={backHref} showLegal>
      <AuthHeader title={emailStep.title} lede={emailStep.lede} />
      <div className="mt-9">
        <EmailAuthForm />
      </div>
    </AuthLayout>
  );
}
