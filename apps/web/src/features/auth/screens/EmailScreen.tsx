"use client";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { EmailAuthForm } from "@/features/auth/components/EmailAuthForm";
import { emailStep } from "@/features/auth/content";
import { authRoutes, type AuthRoute } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";

export function EmailScreen({ backHref }: { backHref: AuthRoute }) {
  const { allowed } = useAuthGuard(authRoutes.email);
  if (!allowed) return <AuthLoading />;

  return (
    <AuthLayout backHref={backHref} showLegal>
      <AuthHeader title={emailStep.title} lede={emailStep.lede} />
      <div className="mt-9">
        <EmailAuthForm />
      </div>
    </AuthLayout>
  );
}
