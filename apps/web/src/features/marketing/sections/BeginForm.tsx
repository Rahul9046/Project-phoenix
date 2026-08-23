"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { joinWaitlist, type WaitlistState } from "@/features/waitlist/actions";
import { Button } from "@/shared/ui/Button";
import { begin, otherCityValue } from "@/features/marketing/content";

const initialState: WaitlistState = { status: "idle" };

const fieldClasses =
  "mt-2 w-full rounded-md border border-line-strong bg-surface px-4 py-3.5 " +
  "text-base text-ink placeholder:text-ink-subtle/70 transition-colors " +
  "focus:border-ember focus:outline-none";

function Field({
  htmlFor,
  label,
  hint,
  error,
  children,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[0.95rem] font-medium text-ink"
      >
        {label}
      </label>
      {hint ? (
        <span className="mt-1 block text-sm text-ink-subtle">{hint}</span>
      ) : null}
      {children}
      {error ? <p className="mt-2 text-sm text-ember-text">{error}</p> : null}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Sending…" : "Begin your journey"}
    </Button>
  );
}

export function BeginForm({ cities }: { cities: string[] }) {
  const [state, formAction] = useActionState(joinWaitlist, initialState);
  const [city, setCity] = useState("");
  const ids = {
    name: useId(),
    email: useId(),
    city: useId(),
    otherCity: useId(),
  };

  const errors = state.status === "error" ? state.fieldErrors : {};
  const isOther = city === otherCityValue;

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="border border-line-strong bg-surface p-8 sm:p-10"
      >
        <h3 className="font-serif text-2xl tracking-[-0.015em] text-ink">
          You&rsquo;re on the list.
        </h3>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      className="border border-line-strong bg-surface p-7 sm:p-10"
    >
      <div className="grid gap-6">
        <Field htmlFor={ids.name} label="Your name" error={errors.name}>
          <input
            id={ids.name}
            name="name"
            type="text"
            autoComplete="name"
            required
            aria-invalid={Boolean(errors.name)}
            className={fieldClasses}
            placeholder="How should we address you?"
          />
        </Field>

        <Field htmlFor={ids.email} label="Email address" error={errors.email}>
          <input
            id={ids.email}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            aria-invalid={Boolean(errors.email)}
            className={fieldClasses}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          htmlFor={ids.city}
          label="Where do you live?"
          hint="Choose your city, or select “Another city” if it is not listed."
          error={errors.city}
        >
          <select
            id={ids.city}
            name="city"
            required
            value={city}
            onChange={(event) => setCity(event.target.value)}
            aria-invalid={Boolean(errors.city)}
            className={fieldClasses}
          >
            <option value="" disabled>
              Select a city
            </option>
            {cities.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={otherCityValue}>{otherCityValue}</option>
          </select>
        </Field>

        {isOther ? (
          <Field
            htmlFor={ids.otherCity}
            label="Which city?"
            hint="Eraya is not open here yet — we will let you know when it is."
            error={errors.otherCity}
          >
            <input
              id={ids.otherCity}
              name="otherCity"
              type="text"
              autoComplete="address-level2"
              required
              aria-invalid={Boolean(errors.otherCity)}
              className={fieldClasses}
              placeholder="Your city"
            />
          </Field>
        ) : null}
      </div>

      {/* Honeypot — hidden from people, tempting to bots. */}
      <div hidden>
        <label htmlFor={`${ids.name}-company`}>Company</label>
        <input
          id={`${ids.name}-company`}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {state.status === "error" ? (
        <p role="alert" className="mt-6 text-sm text-ember-text">
          {state.message}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SubmitButton />
        <p className="max-w-xs text-sm leading-relaxed text-ink-subtle">
          {begin.reassurance}
        </p>
      </div>
    </form>
  );
}
