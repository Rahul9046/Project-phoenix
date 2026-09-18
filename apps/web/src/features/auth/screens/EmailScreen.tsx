"use client";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { EmailAuthForm } from "@/features/auth/components/EmailAuthForm";

import { authRoutes, type AuthRoute } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import { useT } from "@/features/i18n/LocaleProvider";

export function EmailScreen({ backHref }: { backHref: AuthRoute }) {
  const t = useT();
  const { allowed } = useAuthGuard(authRoutes.email);
  if (!allowed) return <AuthLoading />;

  return (
    <AuthLayout backHref={backHref} showLegal>
      <AuthHeader title={t("auth.email.title")} lede={t("auth.email.lede")} />
      <div className="mt-9">
        <EmailAuthForm />
      </div>
    </AuthLayout>
  );
}
