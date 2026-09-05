"use client";

import { useEffect, useRef } from "react";

export const OTP_LENGTH = 6;

/**
 * Six single-character boxes that behave the way people expect.
 *
 * Typing advances, backspace on an empty box steps back, arrow keys move,
 * and pasting a whole code from an SMS fills every box at once. The first box
 * carries `autocomplete="one-time-code"` so iOS and Android offer the code
 * from the notification.
 */
export function OTPInput({
  id,
  value,
  onChange,
  onComplete,
  invalid = false,
  describedBy,
  disabled = false,
  label,
}: {
  id: string;
  /** Digits entered so far, up to `OTP_LENGTH`. */
  value: string;
  onChange: (value: string) => void;
  /** Fired once the last digit lands, so the form can submit itself. */
  onComplete?: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  label: string;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  // Land the caret in the first box so a keyboard user can just start typing.
  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const digits = Array.from(
    { length: OTP_LENGTH },
    (_, index) => value[index] ?? "",
  );

  function focusBox(index: number) {
    const clamped = Math.min(Math.max(index, 0), OTP_LENGTH - 1);
    inputs.current[clamped]?.focus();
    inputs.current[clamped]?.select();
  }

  function commit(next: string) {
    onChange(next);
    if (next.length === OTP_LENGTH) onComplete?.(next);
  }

  function handleChange(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;

    // Overwrite from this position — handles both typing and multi-digit input
    // arriving in a single box (some Android keyboards do this).
    const next = (
      value.slice(0, index) +
      typed +
      value.slice(index + typed.length)
    ).slice(0, OTP_LENGTH);

    commit(next);
    focusBox(index + typed.length);
  }

  function handleKeyDown(
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        commit(value.slice(0, index) + value.slice(index + 1));
        return;
      }
      // Empty box — clear the one before it and step back.
      if (index > 0) {
        commit(value.slice(0, index - 1) + value.slice(index));
        focusBox(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    const next = pasted.slice(0, OTP_LENGTH);
    commit(next);
    focusBox(next.length);
  }

  return (
    <fieldset disabled={disabled} className="border-0 p-0">
      <legend className="sr-only">{label}</legend>
      <div
        className="flex justify-between gap-2 sm:gap-2.5"
        aria-describedby={describedBy}
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            id={index === 0 ? id : `${id}-${index}`}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={OTP_LENGTH}
            value={digit}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
            aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
            aria-invalid={invalid || undefined}
            className={`h-16 w-full min-w-0 rounded-xl border bg-surface text-center text-subhead text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-canvas disabled:opacity-60 ${
              invalid
                ? "border-ember-text"
                : digit
                  ? "border-ink/40"
                  : "border-line-strong"
            }`}
          />
        ))}
      </div>
    </fieldset>
  );
}
