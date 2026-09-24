"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { FormField, inputClasses } from "@/features/auth/components/FormField";
import { SuccessMessage } from "@/features/auth/components/SuccessMessage";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";

import { useAuth } from "@/features/auth/AuthSessionProvider";
import { authRoutes } from "@/features/auth/flow";
import { describeAuthError } from "@/features/auth/describeAuthError";
import { useT } from "@/features/i18n/LocaleProvider";

/**
 * Deliberately forgiving: the only thing checked here is that the address looks
 * like an address. Supabase creates the account on first sign-in, so an
 * unfamiliar email is simply someone new — never a rejection.
 */
const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * How long before another code may be asked for.
 *
 * The same minute the phone flow enforces, and for a sharper reason here: the
 * email rate limit is **account-wide**, not per member. Until this existed the
 * resend control was disabled only while its request was in flight, so one
 * person waiting on a slow inbox could press it a dozen times and spend a
 * budget that every other member shares -- and the people refused next are the
 * new ones, on their first contact with the product.
 *
 * A wait rather than a refusal. The control stays visible and says when it will
 * work, because a member who cannot see the code has a real problem and hiding
 * the way to fix it is not an answer. See docs/12-email-delivery.md.
 *
 * This is a courtesy, not a control: the limit that actually protects the
 * account is Supabase's, on the server. A cooldown in a component is worth
 * exactly as much as the browser running it, which is why it is not the whole
 * of the answer -- only the half that stops honest impatience.
 */
const RESEND_AFTER_SECONDS = 60;

export function EmailAuthForm() {
  const t = useT();
  const { signInWithEmail, verifyEmailCode } = useAuth();
  const router = useRouter();
  const fieldId = useId();
  const codeId = useId();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  /**
   * When the wait ends, not how much of it is left.
   *
   * A timestamp compared against the clock, which is what the phone flow does
   * and for a reason worth writing down: the first version of this counted
   * ticks -- one interval, one second subtracted -- and lost roughly twenty
   * seconds a minute. Browsers clamp timers in a tab that is not in front, so a
   * countdown made of ticks runs as slowly as the tab is throttled and the
   * member is told to wait far longer than a minute. Reading the clock is
   * immune to that: however often the tick actually fires, the number it
   * renders is the truth, and it reaches zero on time.
   */
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const resendIn =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [resendAt]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError(t("auth.email.emptyError"));
      return;
    }
    if (!looksLikeEmail(trimmed)) {
      setFieldError(t("auth.email.formatError"));
      return;
    }

    setFieldError(null);
    setFormError(null);
    setPending(true);

    try {
      await signInWithEmail(trimmed);
      setSentTo(trimmed);
      setResendAt(Date.now() + RESEND_AFTER_SECONDS * 1000);
    } catch (cause) {
      setFormError(describeAuthError(cause));
    } finally {
      setPending(false);
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !sentTo) return;

    const digits = code.trim();
    if (!digits) {
      setFieldError(t("auth.email.codeEmptyError"));
      return;
    }
    if (!/^\d{6}$/.test(digits)) {
      setFieldError(t("auth.email.codeFormatError"));
      return;
    }

    setFieldError(null);
    setFormError(null);
    setPending(true);

    try {
      await verifyEmailCode(sentTo, digits);
      // Where they belong depends on how far they had come. The guard on the
      // next screen resolves that; this only has to leave the sign-in screen.
      router.replace(authRoutes.phone);
    } catch (cause) {
      setFormError(describeAuthError(cause));
      setPending(false);
    }
  }

  async function handleResend() {
    if (resending || resendIn > 0 || !sentTo) return;
    setResending(true);
    setFormError(null);

    try {
      await signInWithEmail(sentTo);
      setResent(true);
      setCode("");
      setResendAt(Date.now() + RESEND_AFTER_SECONDS * 1000);
    } catch (cause) {
      setFormError(describeAuthError(cause));
    } finally {
      setResending(false);
    }
  }

  // The code arrives by email and is typed here, in the tab they are already
  // in. Nothing leaves this screen until it is right.
  if (sentTo) {
    return (
      <div>
        <SuccessMessage className="justify-start">
          {t("auth.email.sentTitle")}
        </SuccessMessage>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          {t("auth.email.sentBody")} <strong className="text-ink">{sentTo}</strong>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-subtle">
          {t("auth.email.sentHint")}
        </p>

        <form onSubmit={handleVerify} noValidate className="mt-7">
          <FormField id={codeId} label={t("auth.email.codeLabel")} error={fieldError}>
            {(props) => (
              <input
                {...props}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/[^\d]/g, "").slice(0, 6));
                  if (fieldError) setFieldError(null);
                  if (resent) setResent(false);
                }}
                placeholder={t("auth.email.codePlaceholder")}
                disabled={pending}
                autoFocus
                className={`${inputClasses} tracking-[0.4em]`}
              />
            )}
          </FormField>

          {formError ? (
            <ErrorMessage className="mt-4">{formError}</ErrorMessage>
          ) : null}

          {resent ? (
            <p className="mt-4 text-sm text-ink-subtle">{t("auth.email.resent")}</p>
          ) : null}

          <PrimaryButton
            type="submit"
            loading={pending}
            loadingLabel={t("auth.email.codePending")}
            className="mt-7"
          >
            {t("auth.email.codeCta")}
          </PrimaryButton>
        </form>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending || resendIn > 0}
            className="rounded-full px-2 py-1 text-[0.95rem] font-medium text-ember-text underline underline-offset-4 hover:text-ember-strong disabled:opacity-60"
          >
            {resending
              ? t("common.sending")
              : resendIn > 0
                ? /* Already translated into all six for the phone flow, and the
                     same sentence for the same wait. */
                  t("auth.otp.resendIn", { seconds: resendIn })
                : t("auth.email.resend")}
          </button>
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setEmail("");
              setCode("");
              setFieldError(null);
              setFormError(null);
            }}
            className="rounded-full px-2 py-1 text-[0.95rem] font-medium text-ink-subtle underline underline-offset-4 hover:text-ink"
          >
            {t("auth.email.sentRetry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField id={fieldId} label={t("auth.email.label")} error={fieldError}>
        {(props) => (
          <input
            {...props}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (fieldError) setFieldError(null);
            }}
            placeholder={t("auth.email.placeholder")}
            disabled={pending}
            className={inputClasses}
          />
        )}
      </FormField>

      {formError ? (
        <ErrorMessage className="mt-4">{formError}</ErrorMessage>
      ) : null}

      <PrimaryButton
        type="submit"
        loading={pending}
        loadingLabel={t("auth.email.pending")}
        className="mt-7"
      >
        {t("auth.email.cta")}
      </PrimaryButton>
    </form>
  );
}
