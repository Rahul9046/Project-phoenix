"use client";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { AuthMethods } from "@/features/auth/components/AuthMethods";
import { WebAppNote } from "@/features/auth/components/WebAppNote";
import { signup } from "@/features/auth/content";
import { authRoutes } from "@/features/auth/flow";
import type { SocialProviderId } from "@/features/auth/types";
import { useAuthGuard } from "@/features/auth/useAuthGuard";

export function SignupScreen({
  providers,
}: {
  providers: readonly SocialProviderId[];
}) {
  const { allowed } = useAuthGuard(authRoutes.signup);
  if (!allowed) return <AuthLoading />;

  return (
    <AuthLayout showLegal footer={<WebAppNote />}>
      <AuthHeader title={signup.title} lede={signup.lede} />
      <div className="mt-9">
        <AuthMethods

          providers={providers}
          // Carries which door they came through, so Back returns them to it.
          emailHref={`${authRoutes.email}?from=signup`}
          emailCta={signup.emailCta}
          dividerLabel={signup.dividerLabel}
          switchPrompt={signup.switchPrompt}
          switchCta={signup.switchCta}
          switchHref={authRoutes.login}
        />
      </div>
    </AuthLayout>
  );
}
