"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { ErrorMessage } from "@/components/auth/ErrorMessage";
import { FormField } from "@/components/auth/FormField";
import { PhoneInput, defaultCountryCode } from "@/components/auth/PhoneInput";
import { StartOverLink } from "@/components/auth/StartOverLink";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { phoneStep } from "@/content/auth";
import { useAuth } from "@/lib/auth/AuthSessionProvider";
import { describeAuthError } from "@/lib/auth/describeAuthError";
import { authRoutes } from "@/lib/auth/flow";
import { useAuthGuard } from "@/lib/auth/useAuthGuard";
import type { PhoneNumber } from "@/lib/auth/types";

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
