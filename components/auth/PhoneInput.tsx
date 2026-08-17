"use client";

import { phoneStep } from "@/content/auth";

/**
 * Country code and national number as one control.
 *
 * India is the default because that is where Eraya opens, but the code is a
 * real select rather than fixed text — nobody living abroad should hit a wall
 * at the first field.
 */

export const countryCodes = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "United States / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+971", label: "United Arab Emirates (+971)" },
] as const;

export const defaultCountryCode = "+91";

/** Strips everything a person might reasonably type but we cannot store. */
export function normaliseNationalNumber(input: string): string {
  return input.replace(/\D/g, "").slice(0, 15);
}

export function PhoneInput({
  id,
  countryCode,
  nationalNumber,
  onCountryCodeChange,
  onNationalNumberChange,
  invalid = false,
  describedBy,
  disabled = false,
}: {
  id: string;
  countryCode: string;
  nationalNumber: string;
  onCountryCodeChange: (value: string) => void;
  onNationalNumberChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="shrink-0">
        <label htmlFor={`${id}-country`} className="sr-only">
          {phoneStep.countryLabel}
        </label>
        <select
          id={`${id}-country`}
          value={countryCode}
          onChange={(event) => onCountryCodeChange(event.target.value)}
          disabled={disabled}
          className="min-h-14 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink transition-colors focus:border-ember focus:outline-none disabled:opacity-60"
        >
          {countryCodes.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.code}
            </option>
          ))}
        </select>
      </div>

      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={nationalNumber}
        onChange={(event) =>
          onNationalNumberChange(normaliseNationalNumber(event.target.value))
        }
        placeholder={phoneStep.placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        className="min-h-14 w-full rounded-xl border border-line-strong bg-surface px-4 text-base tracking-[0.02em] text-ink placeholder:text-ink-subtle/70 transition-colors focus:border-ember focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-ember-text"
      />
    </div>
  );
}
