"use client";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { AuthMethods } from "@/features/auth/components/AuthMethods";
import { WebAppNote } from "@/features/auth/components/WebAppNote";
import { login } from "@/features/auth/content";
import { authRoutes } from "@/features/auth/flow";
import type { SocialProviderId } from "@/features/auth/types";
import { useAuthGuard } from "@/features/auth/useAuthGuard";

export function LoginScreen({
  providers,
}: {
  providers: readonly SocialProviderId[];
}) {
  const { allowed } = useAuthGuard(authRoutes.login);
  if (!allowed) return <AuthLoading />;

  return (
    <AuthLayout showLegal footer={<WebAppNote />}>
      <AuthHeader title={login.title} lede={login.lede} />
      <div className="mt-9">
        <AuthMethods

          providers={providers}
          emailHref={authRoutes.email}
          emailCta={login.emailCta}
          dividerLabel={login.dividerLabel}
          switchPrompt={login.switchPrompt}
          switchCta={login.switchCta}
          switchHref={authRoutes.signup}
        />
      </div>
    </AuthLayout>
  );
}
