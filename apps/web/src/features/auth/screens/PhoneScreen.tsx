"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { FormField } from "@/features/auth/components/FormField";
import { PhoneInput, defaultCountryCode } from "@/features/auth/components/PhoneInput";
import { StartOverLink } from "@/features/auth/components/StartOverLink";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { phoneStep } from "@/features/auth/content";
import { useAuth } from "@/features/auth/AuthSessionProvider";
import { describeAuthError } from "@/features/auth/describeAuthError";
import { authRoutes } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import type { PhoneNumber } from "@/features/auth/types";

/** Short enough to catch a slip, loose enough to accept any real number. */
const MIN_DIGITS = 6;

export function PhoneScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.phone);
  if (!allowed) return <AuthLoading />;
  return <PhoneForm stored={session.phone} />;
}

function PhoneForm({ stored }: { stored: PhoneNumber | null }) {
  const router = useRouter();
  const { sendVerificationCode } = useAuth();
  const fieldId = useId();

  const [countryCode, setCountryCode] = useState(
    stored?.countryCode ?? defaultCountryCode,
  );
  const [nationalNumber, setNationalNumber] = useState(
    stored?.nationalNumber ?? "",
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (!nationalNumber) {
      setFieldError(phoneStep.emptyError);
      return;
    }
    if (nationalNumber.length < MIN_DIGITS) {
      setFieldError(phoneStep.formatError);
      return;
    }

    setFieldError(null);
    setFormError(null);
    setPending(true);

    try {
      await sendVerificationCode({ countryCode, nationalNumber });
      router.push(authRoutes.otp);
    } catch (cause) {
      setFormError(describeAuthError(cause));
      setPending(false);
    }
  }

  return (
    <AuthLayout showLegal>
      <AuthHeader title={phoneStep.title} lede={phoneStep.lede} />

      <form onSubmit={handleSubmit} noValidate className="mt-9">
        <FormField
          id={fieldId}
          label={phoneStep.label}
          hint={phoneStep.reassurance}
          error={fieldError}
        >
          {(props) => (
            <PhoneInput
              id={props.id}
              countryCode={countryCode}
              nationalNumber={nationalNumber}
              onCountryCodeChange={setCountryCode}
              onNationalNumberChange={(value) => {
                setNationalNumber(value);
                if (fieldError) setFieldError(null);
              }}
              invalid={Boolean(fieldError)}
              describedBy={props["aria-describedby"]}
              disabled={pending}
            />
          )}
        </FormField>

        {formError ? (
          <ErrorMessage className="mt-4">{formError}</ErrorMessage>
        ) : null}

        <PrimaryButton
          type="submit"
          loading={pending}
          loadingLabel={phoneStep.pending}
          className="mt-7"
        >
          {phoneStep.cta}
        </PrimaryButton>
      </form>

      {/*
        There is no "back" from here that makes sense — they are signed in, and
        the entry screens would only send them straight back. Starting over is
        the honest alternative.
      */}
      <p className="mt-8 text-center text-[0.95rem] text-ink-muted">
        <StartOverLink />
      </p>
    </AuthLayout>
  );
}
