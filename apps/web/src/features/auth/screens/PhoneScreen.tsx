"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { FormField } from "@/features/auth/components/FormField";
import { PhoneInput, defaultCountryCode } from "@/features/auth/components/PhoneInput";
import { StartOverLink } from "@/features/auth/components/StartOverLink";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";

import { useAuth } from "@/features/auth/AuthSessionProvider";
import { describePhoneError } from "@/features/auth/describeAuthError";
import { authRoutes } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import type { PhoneNumber } from "@/features/auth/types";
import { useT } from "@/features/i18n/LocaleProvider";
import {
  CAPTCHA_CONTAINER_ID,
  ensureWidget,
  widgetConfig,
} from "@/features/auth/msg91-widget";

/** Short enough to catch a slip, loose enough to accept any real number. */
const MIN_DIGITS = 6;

export function PhoneScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.phone);
  if (!allowed) return <AuthLoading />;
  return <PhoneForm stored={session.phone} />;
}

function PhoneForm({ stored }: { stored: PhoneNumber | null }) {
  const t = useT();
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

  /*
   * Load the widget when the screen opens, not when somebody presses Continue.
   *
   * MSG91 renders its hCaptcha challenge as part of initialising. Doing that
   * inside the first send meant the challenge appeared and the send was
   * attempted in the same breath -- so the first attempt always failed, the
   * captcha appeared underneath the error it had just caused, and the second
   * attempt worked. The person is told something went wrong on our side,
   * which was true, and is given no idea that the box that just appeared is
   * what fixes it.
   *
   * Initialising here means the challenge is on screen and can be solved
   * before Continue is pressed, so the first attempt is the one that works.
   *
   * Failure is deliberately silent. If the script cannot load there is nothing
   * useful to say at this point, and the send path already reports it properly
   * when it is actually needed -- an error on arrival about a button not yet
   * pressed is worse than none.
   */
  useEffect(() => {
    const config = widgetConfig();
    if (!config) return;
    void ensureWidget(config).catch(() => {});
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (!nationalNumber) {
      setFieldError(t("auth.phone.emptyError"));
      return;
    }
    if (nationalNumber.length < MIN_DIGITS) {
      setFieldError(t("auth.phone.formatError"));
      return;
    }

    setFieldError(null);
    setFormError(null);
    setPending(true);

    try {
      await sendVerificationCode({ countryCode, nationalNumber });
      router.push(authRoutes.otp);
    } catch (cause) {
      setFormError(describePhoneError(cause));
      setPending(false);
    }
  }

  return (
    <AuthLayout showLegal>
      <AuthHeader title={t("auth.phone.title")} lede={t("auth.phone.lede")} />

      <form onSubmit={handleSubmit} noValidate className="mt-9">
        <FormField
          id={fieldId}
          label={t("auth.phone.label")}
          hint={t("auth.phone.reassurance")}
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

        {/*
          Where MSG91 draws its captcha, if it draws one at all.

          Always rendered, and never hidden. Both matter. It has to exist before
          the widget is asked to send, so it cannot wait on state that only
          changes once sending has begun -- and it cannot be `display: none`
          while empty, because a captcha cannot measure or draw itself inside a
          hidden element and fails rather than saying so.

          An empty div occupies no height, so leaving it visible costs nothing
          when the captcha is silent or switched off.
        */}
        <div id={CAPTCHA_CONTAINER_ID} />

        {formError ? (
          <ErrorMessage className="mt-4">{formError}</ErrorMessage>
        ) : null}

        <PrimaryButton
          type="submit"
          loading={pending}
          loadingLabel={t("common.saving")}
          className="mt-7"
        >
          {t("auth.phone.cta")}
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
