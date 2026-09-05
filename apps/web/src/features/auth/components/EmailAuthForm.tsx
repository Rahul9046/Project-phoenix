"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { FormField, inputClasses } from "@/features/auth/components/FormField";
import { SuccessMessage } from "@/features/auth/components/SuccessMessage";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { emailStep } from "@/features/auth/content";
import { useAuth } from "@/features/auth/AuthSessionProvider";
import { authRoutes } from "@/features/auth/flow";
import { describeAuthError } from "@/features/auth/describeAuthError";

/**
 * Deliberately forgiving: the only thing checked here is that the address looks
 * like an address. Supabase creates the account on first sign-in, so an
 * unfamiliar email is simply someone new — never a rejection.
 */
const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function EmailAuthForm() {
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError(emailStep.emptyError);
      return;
    }
    if (!looksLikeEmail(trimmed)) {
      setFieldError(emailStep.formatError);
      return;
    }

    setFieldError(null);
    setFormError(null);
    setPending(true);

    try {
      await signInWithEmail(trimmed);
      setSentTo(trimmed);
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
      setFieldError(emailStep.codeEmptyError);
      return;
    }
    if (!/^\d{6}$/.test(digits)) {
      setFieldError(emailStep.codeFormatError);
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
    if (resending || !sentTo) return;
    setResending(true);
    setFormError(null);

    try {
      await signInWithEmail(sentTo);
      setResent(true);
      setCode("");
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
          {emailStep.sentTitle}
        </SuccessMessage>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          {emailStep.sentBody} <strong className="text-ink">{sentTo}</strong>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-subtle">
          {emailStep.sentHint}
        </p>

        <form onSubmit={handleVerify} noValidate className="mt-7">
          <FormField id={codeId} label={emailStep.codeLabel} error={fieldError}>
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
                placeholder={emailStep.codePlaceholder}
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
            <p className="mt-4 text-sm text-ink-subtle">{emailStep.resent}</p>
          ) : null}

          <PrimaryButton
            type="submit"
            loading={pending}
            loadingLabel={emailStep.codePending}
            className="mt-7"
          >
            {emailStep.codeCta}
          </PrimaryButton>
        </form>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending}
            className="rounded-full px-2 py-1 text-[0.95rem] font-medium text-ember-text underline underline-offset-4 hover:text-ember-strong disabled:opacity-60"
          >
            {resending ? emailStep.resendPending : emailStep.resend}
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
            {emailStep.sentRetry}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField id={fieldId} label={emailStep.label} error={fieldError}>
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
            placeholder={emailStep.placeholder}
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
        loadingLabel={emailStep.pending}
        className="mt-7"
      >
        {emailStep.cta}
      </PrimaryButton>
    </form>
  );
}
