"use client";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { AuthMethods } from "@/features/auth/components/AuthMethods";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { WebAppNote } from "@/features/auth/components/WebAppNote";

import { authRoutes } from "@/features/auth/flow";
import type { SocialProviderId } from "@/features/auth/types";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import { useT } from "@/features/i18n/LocaleProvider";

export function LoginScreen({
  providers,
  problem,
}: {
  providers: readonly SocialProviderId[];
  /** Explains a failed sign-in the person was redirected back from. */
  problem?: string | null;
}) {
  const t = useT();
  const { allowed } = useAuthGuard(authRoutes.login);
  if (!allowed) return <AuthLoading />;

  return (
    <AuthLayout showLegal footer={<WebAppNote />}>
      <AuthHeader title={t("auth.login.title")} lede={t("auth.login.lede")} />

      {/*
        ErrorMessage already carries role="alert", which is what this needs: the
        person acted, it did not work, and they are looking at the screen
        wondering why.
      */}
      {problem ? (
        <ErrorMessage className="mt-7">{problem}</ErrorMessage>
      ) : null}

      <div className="mt-9">
        <AuthMethods

          providers={providers}
          emailHref={authRoutes.email}
          emailCta={t("auth.login.emailCta")}
          dividerLabel={t("common.or")}
          switchPrompt={t("auth.login.switchPrompt")}
          switchCta={t("auth.login.switchCta")}
          switchHref={authRoutes.signup}
        />
      </div>
    </AuthLayout>
  );
}
