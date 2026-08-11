"use client";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { AuthMethods } from "@/components/auth/AuthMethods";
import { WebAppNote } from "@/components/auth/WebAppNote";
import { login } from "@/content/auth";
import { authRoutes } from "@/lib/auth/flow";
import { useAuthGuard } from "@/lib/auth/useAuthGuard";

export function LoginScreen() {
  const { allowed } = useAuthGuard(authRoutes.login);
  if (!allowed) return <AuthLoading />;

  return (
    <AuthLayout showLegal footer={<WebAppNote />}>
      <AuthHeader title={login.title} lede={login.lede} />
      <div className="mt-9">
        <AuthMethods
          intent="login"
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
