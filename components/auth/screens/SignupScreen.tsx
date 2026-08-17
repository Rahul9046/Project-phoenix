"use client";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { AuthMethods } from "@/components/auth/AuthMethods";
import { WebAppNote } from "@/components/auth/WebAppNote";
import { signup } from "@/content/auth";
import { authRoutes } from "@/lib/auth/flow";
import type { SocialProviderId } from "@/lib/auth/types";
import { useAuthGuard } from "@/lib/auth/useAuthGuard";

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
