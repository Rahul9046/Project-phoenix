"use client";

import { SelectableOption } from "@/components/auth/SelectableOption";
import { inputClasses } from "@/components/auth/FormField";
import { cityStep } from "@/content/auth";
import { launchCities } from "@/content/site";

export const OTHER_CITY = cityStep.otherLabel;

/**
 * The seven cities Eraya is opening in, plus anywhere else.
 *
 * Choosing "Another city" is not a dead end and never blocks the Continue
 * button — it reveals a free-text field and a note that Eraya is still growing.
 * Deciding who gets full access is a later problem; refusing an account here
 * would be the wrong answer to it.
 */
export function CitySelector({
  id,
  value,
  otherCity,
  onChange,
  onOtherCityChange,
  disabled = false,
}: {
  id: string;
  value: string | null;
  otherCity: string;
  onChange: (city: string) => void;
  onOtherCityChange: (city: string) => void;
  disabled?: boolean;
}) {
  const isOther = value === OTHER_CITY;

  return (
    <div>
      <div className="grid gap-2.5" role="radiogroup" aria-label={cityStep.title}>
        {launchCities.map((city) => (
          <SelectableOption
            key={city}
            type="radio"
            name="city"
            value={city}
            label={city}
            checked={value === city}
            onChange={onChange}
          />
        ))}
        <SelectableOption
          type="radio"
          name="city"
          value={OTHER_CITY}
          label={OTHER_CITY}
          description="Somewhere else in India, or outside it."
          checked={isOther}
          onChange={onChange}
        />
      </div>

      {isOther ? (
        <div className="mt-5">
          <label
            htmlFor={`${id}-other`}
            className="block text-[0.95rem] font-medium text-ink"
          >
            {cityStep.otherFieldLabel}
          </label>
          <input
            id={`${id}-other`}
            type="text"
            autoComplete="address-level2"
            value={otherCity}
            onChange={(event) => onOtherCityChange(event.target.value)}
            placeholder={cityStep.otherFieldPlaceholder}
            disabled={disabled}
            className={`mt-2.5 ${inputClasses}`}
          />

          {/*
            Informational, not a rejection. Announced politely rather than
            assertively — it is context, not an error.
          */}
          <aside
            role="status"
            className="mt-4 rounded-xl border border-line bg-sand/60 px-5 py-4"
          >
            <p className="text-[0.95rem] font-medium text-ink">
              {cityStep.elsewhereTitle}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              {cityStep.elsewhereBody}
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
