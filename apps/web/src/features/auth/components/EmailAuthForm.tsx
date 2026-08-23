"use client";

import { useId, useState } from "react";

import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { FormField, inputClasses } from "@/features/auth/components/FormField";
import { SuccessMessage } from "@/features/auth/components/SuccessMessage";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { emailStep } from "@/features/auth/content";
import { useAuth } from "@/features/auth/AuthSessionProvider";
import { describeAuthError } from "@/features/auth/describeAuthError";

/**
 * Deliberately forgiving: the only thing checked here is that the address looks
 * like an address. Supabase creates the account on first sign-in, so an
 * unfamiliar email is simply someone new — never a rejection.
 */
const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function EmailAuthForm() {
  const { signInWithEmail } = useAuth();
  const fieldId = useId();

  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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

  // A link cannot complete the journey inside this tab, so the screen has to
  // say what happens next rather than appear to have done nothing.
  if (sentTo) {
    return (
      <div>
        <SuccessMessage className="justify-start">
          {emailStep.sentTitle}
        </SuccessMessage>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          {emailStep.sentBody} <strong className="text-ink">{sentTo}</strong>.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-subtle">
          {emailStep.sentHint}
        </p>
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            setEmail("");
          }}
          className="mt-7 rounded-full px-2 py-1 text-[0.95rem] font-medium text-ember-text underline underline-offset-4 hover:text-ember-strong"
        >
          {emailStep.sentRetry}
        </button>
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
