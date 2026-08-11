"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { ErrorMessage } from "@/components/auth/ErrorMessage";
import { OTPInput, OTP_LENGTH } from "@/components/auth/OTPInput";
import { SuccessMessage } from "@/components/auth/SuccessMessage";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { otpStep } from "@/content/auth";
import { useAuth } from "@/lib/auth/AuthSessionProvider";
import { describeAuthError } from "@/lib/auth/describeAuthError";
import { authRoutes, nextRoute } from "@/lib/auth/flow";
import { useAuthGuard } from "@/lib/auth/useAuthGuard";
import { maskPhone } from "@/lib/auth/types";

/** Long enough to register as confirmation, short enough not to be a wait. */
const SUCCESS_PAUSE_MS = 1100;

export function OTPScreen() {
  const router = useRouter();
  const { verifyCode, resendVerificationCode } = useAuth();
  const fieldId = useId();

  const [verified, setVerified] = useState(false);
  // Once verified this screen navigates itself, so the guard stands down.
  const { session, allowed } = useAuthGuard(authRoutes.otp, {
    enabled: !verified,
  });

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  if (!allowed) return <AuthLoading />;

  async function submit(value: string) {
    if (pending || verified) return;

    if (value.length < OTP_LENGTH) {
      setError(otpStep.incompleteError);
      return;
    }

    setError(null);
    setPending(true);

    try {
      const updated = await verifyCode(value);
      setVerified(true);
      setPending(false);
      // Let the confirmation land before moving on.
      timeout.current = setTimeout(() => {
        router.push(nextRoute(updated));
      }, SUCCESS_PAUSE_MS);
    } catch (cause) {
      setError(describeAuthError(cause));
      setPending(false);
    }
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    setResent(false);
    setError(null);
    try {
      await resendVerificationCode();
      setResent(true);
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setResending(false);
    }
  }

  const lede = session.phone
    ? `${otpStep.ledePrefix} ${maskPhone(session.phone)}.`
    : otpStep.ledePrefix;

  return (
    <AuthLayout backHref={authRoutes.phone} backLabel={otpStep.changeCta}>
      <AuthHeader title={otpStep.title} lede={lede} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(code);
        }}
        noValidate
        className="mt-9"
      >
        <OTPInput
          id={fieldId}
          label={otpStep.label}
          value={code}
          onChange={(value) => {
            setCode(value);
            if (error) setError(null);
          }}
          // Submitting on the sixth digit saves a tap for most people; the
          // button stays for anyone who prefers it.
          onComplete={(value) => void submit(value)}
          invalid={Boolean(error)}
          disabled={pending || verified}
        />

        {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

        {verified ? (
          <SuccessMessage className="mt-7">{otpStep.success}</SuccessMessage>
        ) : (
          <PrimaryButton
            type="submit"
            loading={pending}
            loadingLabel={otpStep.pending}
            className="mt-7"
          >
            {otpStep.cta}
          </PrimaryButton>
        )}
      </form>

      {verified ? null : (
        <div className="mt-8 text-center text-[0.95rem] text-ink-muted">
          <p>
            {otpStep.resendPrompt}{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="rounded-full px-1 font-medium text-ember-text underline underline-offset-4 hover:text-ember-strong disabled:opacity-60"
            >
              {resending ? otpStep.resendPending : otpStep.resendCta}
            </button>
          </p>
          {resent ? (
            <p role="status" className="mt-2 text-sm text-ink-subtle">
              {otpStep.resendConfirmation}
            </p>
          ) : null}
        </div>
      )}
    </AuthLayout>
  );
}
