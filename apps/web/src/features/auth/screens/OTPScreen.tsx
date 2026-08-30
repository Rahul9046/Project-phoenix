"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { markPhoneVerified } from "@/features/auth/actions";
import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { OTPInput, OTP_LENGTH } from "@/features/auth/components/OTPInput";
import { SuccessMessage } from "@/features/auth/components/SuccessMessage";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { otpStep } from "@/features/auth/content";
import { useAuth } from "@/features/auth/AuthSessionProvider";
import { describeAuthError } from "@/features/auth/describeAuthError";
import { authRoutes, nextRoute } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import { formatPhone } from "@/features/auth/types";

/** Long enough to register as confirmation, short enough not to be a wait. */
const SUCCESS_PAUSE_MS = 1100;

export function OTPScreen() {
  const router = useRouter();
  const { verifyCode } = useAuth();
  const fieldId = useId();

  const [verified, setVerified] = useState(false);
  // Once verified this screen navigates itself, so the guard stands down.
  const { session, allowed } = useAuthGuard(authRoutes.otp, {
    enabled: !verified,
  });

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      await verifyCode(value);

      // The code check is still mocked; recording the result is not. This
      // writes phone_verified_at and advances the stored stage.
      const saved = await markPhoneVerified();
      if (!saved.ok) {
        setError(saved.message);
        setPending(false);
        return;
      }

      setVerified(true);
      setPending(false);

      // Let the confirmation land before moving on.
      timeout.current = setTimeout(() => {
        router.push(nextRoute({ ...session, stage: "phoneVerified" }));
      }, SUCCESS_PAUSE_MS);
    } catch (cause) {
      setError(describeAuthError(cause));
      setPending(false);
    }
  }

  const lede = session.phone
    ? `${otpStep.ledePrefix} ${formatPhone(session.phone)}.`
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

      {/*
        No resend control while verification is mocked. Nothing is sent, so a
        "Resend code" button would send nothing and then say it had. Restore it
        along with the rest of the SMS path -- see
        features/auth/phone-verification.ts.
      */}
    </AuthLayout>
  );
}
