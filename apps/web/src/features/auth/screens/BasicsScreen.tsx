"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { FormField, inputClasses } from "@/features/auth/components/FormField";
import { ProgressIndicator } from "@/features/auth/components/ProgressIndicator";
import { SelectableOption } from "@/features/auth/components/SelectableOption";
import { StartOverLink } from "@/features/auth/components/StartOverLink";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { saveBasics } from "@/features/auth/actions";
import { basicsStep, genderOptions } from "@/features/auth/content";
import type { Gender } from "@/features/auth/types";
import { authRoutes, onboardingStepIndex } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import type { OnboardingProfile } from "@/features/auth/types";

/**
 * The guard runs here and the form is a separate component, so the form only
 * ever mounts once the stored profile is known. Its `useState` can then seed
 * itself directly — no effect copying store state into component state.
 */
export function BasicsScreen() {
  const { session, allowed } = useAuthGuard(authRoutes.basics);
  if (!allowed) return <AuthLoading />;
  return <BasicsForm profile={session.profile} />;
}

function BasicsForm({ profile }: { profile: OnboardingProfile }) {
  const router = useRouter();

  const nameId = useId();
  const dobId = useId();
  const genderId = useId();

  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? "");
  const [gender, setGender] = useState<Gender | null>(
    (profile.gender as Gender | null) ?? null,
  );
  const [errors, setErrors] = useState<{
    firstName?: string;
    dateOfBirth?: string;
    gender?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    // Presence only. The database enforces what actually matters — that a date
    // of birth is 18 or more years ago, and that gender is one of the known
    // values — so the form does not duplicate those rules.
    const next: typeof errors = {};
    if (!firstName.trim()) next.firstName = basicsStep.firstName.error;
    if (!dateOfBirth) next.dateOfBirth = basicsStep.dateOfBirth.error;
    if (!gender) next.gender = basicsStep.gender.error;

    setErrors(next);
    // `|| !gender` is redundant at runtime — the check above already set an
    // error for it — but it is what narrows the type for the call below, so the
    // compiler can see that a null gender never reaches the database.
    if (Object.keys(next).length > 0 || !gender) return;

    setPending(true);
    setFormError(null);

    const result = await saveBasics({
      firstName: firstName.trim(),
      dateOfBirth,
      gender,
    });

    if (!result.ok) {
      setFormError(result.message);
      setPending(false);
      return;
    }

    router.push(authRoutes.city);
  }

  return (
    <AuthLayout
      progress={
        <ProgressIndicator
          currentIndex={onboardingStepIndex(authRoutes.basics)}
        />
      }
    >
      <AuthHeader
        title={basicsStep.title}
        lede={basicsStep.lede}
        showLogo={false}
      />

      <form onSubmit={handleSubmit} noValidate className="mt-9 grid gap-7">
        <FormField
          id={nameId}
          label={basicsStep.firstName.label}
          hint={basicsStep.firstName.hint}
          error={errors.firstName}
        >
          {(props) => (
            <input
              {...props}
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder={basicsStep.firstName.placeholder}
              className={inputClasses}
            />
          )}
        </FormField>

        <FormField
          id={dobId}
          label={basicsStep.dateOfBirth.label}
          hint={basicsStep.dateOfBirth.hint}
          error={errors.dateOfBirth}
        >
          {(props) => (
            <input
              {...props}
              type="date"
              autoComplete="bday"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              className={inputClasses}
            />
          )}
        </FormField>

        <fieldset>
          <legend id={genderId} className="text-[0.95rem] font-medium text-ink">
            {basicsStep.gender.label}
          </legend>
          <div
            className="mt-2.5 grid gap-2.5"
            role="radiogroup"
            aria-labelledby={genderId}
          >
            {genderOptions.map((option) => (
              <SelectableOption
                key={option.value}
                type="radio"
                name="gender"
                value={option.value}
                label={option.label}
                checked={gender === option.value}
                onChange={(value) => setGender(value as Gender)}
              />
            ))}
          </div>
          {errors.gender ? (
            <p role="alert" className="mt-2.5 text-sm text-ember-text">
              {errors.gender}
            </p>
          ) : null}
        </fieldset>

        {formError ? <ErrorMessage>{formError}</ErrorMessage> : null}

        <PrimaryButton type="submit" loading={pending} loadingLabel="Saving…">
          {basicsStep.cta}
        </PrimaryButton>
      </form>

      {/* The first onboarding step has no Back, so this is the only way out. */}
      <p className="mt-8 text-center text-[0.95rem] text-ink-muted">
        <StartOverLink />
      </p>
    </AuthLayout>
  );
}
