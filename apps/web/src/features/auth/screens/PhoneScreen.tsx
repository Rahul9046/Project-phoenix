"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { recordPhoneStepComplete } from "@/features/auth/actions";
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
import { authRoutes, nextRoute } from "@/features/auth/flow";
import { appRoutes } from "@/features/app-shell/nav";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import { stageAtLeast, type AuthSession } from "@/features/auth/types";
import { useT } from "@/features/i18n/LocaleProvider";
import { ensureWidget, widgetConfig } from "@/features/auth/msg91-widget";

/** Short enough to catch a slip, loose enough to accept any real number. */
const MIN_DIGITS = 6;

export function PhoneScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.phone);
  if (!allowed) return <AuthLoading />;
  return <PhoneForm session={session} />;
}

/**
 * Two people arrive here and the screen owes them different exits.
 *
 * Somebody in the middle of signing up, for whom this is one question among
 * several and declining means moving to the next one; and a member who finished
 * onboarding weeks ago, skipped this, and has come back from the account area
 * to do it -- for whom declining means going back where they came from, with
 * nothing to record because their stage is long past this point.
 */
function PhoneForm({ session }: { session: AuthSession }) {
  const stored = session.phone;
  const duringOnboarding = !stageAtLeast(session.stage, "onboardingCompleted");
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
  const [skipping, setSkipping] = useState(false);

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

  /**
   * Declining, which costs nothing and sends nothing.
   *
   * No provider call is made here -- not a send, not a retry. MSG91 learns
   * nothing about this member, which is the whole point: a step somebody can
   * decline must be free to decline, or the invitation is a formality.
   *
   * What it writes is the stage, and only the stage. The number, the timestamp
   * and the status are all untouched, so nothing downstream can read this as a
   * verification that happened.
   *
   * Offered during signup only. A member who arrived from Account ->
   * Verification came here on purpose to do this, and "Skip for now" would be
   * answering a question nobody asked them -- worse, it reads as though
   * declining were being recorded, when their stage passed this point long ago.
   * They get the back control instead, which is what the app does too.
   */
  async function handleSkip() {
    if (pending || skipping) return;

    setFormError(null);
    setSkipping(true);

    const saved = await recordPhoneStepComplete();
    if (!saved.ok) {
      setFormError(saved.message);
      setSkipping(false);
      return;
    }

    router.push(nextRoute({ ...session, stage: "phoneStepDone" }));
  }

  return (
    <AuthLayout
      showLegal
      // Only for the member who came from the account area; during signup there
      // is nowhere behind this screen worth returning to.
      backHref={duringOnboarding ? undefined : appRoutes.verification}
      backLabel={duringOnboarding ? undefined : t("account.verification.title")}
    >
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

        {/*
          The way past this question.

          Under the primary button rather than beside it: this is a real choice
          and not a hidden one, but it is the second of the two. The sentence
          above it says the step is optional before either button is read,
          because a skip discovered only after somebody has given up on the form
          is a skip that arrived too late to have been a decision.
        */}
        {duringOnboarding ? (
          <>
            <p className="mt-5 text-center text-[0.95rem] leading-relaxed text-ink-muted">
              {t("auth.phone.optional")}
            </p>

            <p className="mt-3 text-center">
              <button
                type="button"
                onClick={() => void handleSkip()}
                disabled={pending || skipping}
                className="rounded-full font-medium text-ember-text underline underline-offset-4 transition-colors hover:text-ember-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {skipping ? t("auth.phone.skipping") : t("auth.phone.skip")}
              </button>
            </p>
          </>
        ) : null}
      </form>

      {/*
        There is no "back" from here that makes sense during signup — they are
        signed in, and the entry screens would only send them straight back.
        Starting over is the honest alternative.

        It is withheld from a member who came from the account area to verify
        late. For them this is one screen in a settings flow, and offering to
        destroy the session is not a proportionate second option; "Skip for now"
        already takes them back.
      */}
      {duringOnboarding ? (
        <p className="mt-8 text-center text-[0.95rem] text-ink-muted">
          <StartOverLink />
        </p>
      ) : null}
    </AuthLayout>
  );
}
