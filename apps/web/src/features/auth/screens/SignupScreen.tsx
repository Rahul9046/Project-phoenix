"use client";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { AuthMethods } from "@/features/auth/components/AuthMethods";
import { WebAppNote } from "@/features/auth/components/WebAppNote";
import { authRoutes } from "@/features/auth/flow";
import type { SocialProviderId } from "@/features/auth/types";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import { useT } from "@/features/i18n/LocaleProvider";

export function SignupScreen({
  providers,
}: {
  providers: readonly SocialProviderId[];
}) {
  const t = useT();
  const { allowed } = useAuthGuard(authRoutes.signup);
  if (!allowed) return <AuthLoading />;

  return (
    <AuthLayout showLegal footer={<WebAppNote />}>
      <AuthHeader title={t("auth.signup.title")} lede={t("auth.signup.lede")} />
      <div className="mt-9">
        <AuthMethods

          providers={providers}
          // Carries which door they came through, so Back returns them to it.
          emailHref={`${authRoutes.email}?from=signup`}
          emailCta={t("auth.signup.emailCta")}
          dividerLabel={t("common.or")}
          switchPrompt={t("auth.signup.switchPrompt")}
          switchCta={t("auth.signup.switchCta")}
          switchHref={authRoutes.login}
        />
      </div>
    </AuthLayout>
  );
}
