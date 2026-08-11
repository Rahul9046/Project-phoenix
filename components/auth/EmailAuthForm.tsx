"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ErrorMessage } from "@/components/auth/ErrorMessage";
import { FormField, inputClasses } from "@/components/auth/FormField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { emailStep } from "@/content/auth";
import { useAuth } from "@/lib/auth/AuthSessionProvider";
import { describeAuthError } from "@/lib/auth/describeAuthError";
import { nextRoute } from "@/lib/auth/flow";

/**
 * Deliberately forgiving: the only thing checked is that the address looks like
 * an address. There is no account database yet, so an unfamiliar email is
 * simply someone new — they continue into signup rather than being told they do
 * not exist.
 */
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function EmailAuthForm() {
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  const fieldId = useId();

  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      const session = await signInWithEmail(trimmed);
      router.push(nextRoute(session));
    } catch (cause) {
      setFormError(describeAuthError(cause));
      setPending(false);
    }
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
