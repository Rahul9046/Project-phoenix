"use client";

import { languageOptions, languagesStep } from "@/content/auth";

export const PREFER_NOT_TO_SAY = languagesStep.preferNotToSay;

/**
 * Languages as chips, because the list is long and the answers are short.
 *
 * Chips are real checkboxes underneath. "Prefer not to say" is exclusive —
 * picking it clears the rest, and picking a language clears it — so the answer
 * can never contradict itself.
 */
export function LanguageSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(language: string) {
    if (language === PREFER_NOT_TO_SAY) {
      onChange(selected.includes(PREFER_NOT_TO_SAY) ? [] : [PREFER_NOT_TO_SAY]);
      return;
    }

    const withoutOptOut = selected.filter(
      (item) => item !== PREFER_NOT_TO_SAY,
    );

    onChange(
      withoutOptOut.includes(language)
        ? withoutOptOut.filter((item) => item !== language)
        : [...withoutOptOut, language],
    );
  }

  const chips = [...languageOptions, PREFER_NOT_TO_SAY];

  return (
    <div
      className="flex flex-wrap gap-2.5"
      role="group"
      aria-label={languagesStep.title}
    >
      {chips.map((language) => {
        const checked = selected.includes(language);
        return (
          <label
            key={language}
            className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border px-4 text-base transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember ${
              checked
                ? "border-ember bg-ember text-canvas"
                : "border-line-strong bg-surface text-ink hover:border-ink/40 hover:bg-sand/60"
            } ${language === PREFER_NOT_TO_SAY ? "italic" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(language)}
              className="sr-only"
            />
            {checked ? (
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-3.5 w-3.5"
              >
                <path d="m5 10.4 3.2 3.2L15 6.8" />
              </svg>
            ) : null}
            {language}
          </label>
        );
      })}
    </div>
  );
}
