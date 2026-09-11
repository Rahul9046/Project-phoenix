"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LOCALES, LOCALE_NAMES, type Locale } from "@eraya/i18n";

import { setLocale } from "@/features/i18n/actions";
import { useLocale, useT } from "@/features/i18n/LocaleProvider";

/**
 * Choosing the language Eraya speaks.
 *
 * Each option is written in its own language and nothing else. Somebody looking
 * for Bengali is looking for বাংলা; showing them the word "Bengali" in a
 * language they may not read is the one mistake this screen cannot afford.
 *
 * No flags. A flag is a country, these are languages, and the mapping is wrong
 * often enough to be insulting.
 *
 * Radios rather than a `<select>`. Six options fit, they can all be read at
 * once, and a native select on a phone hides the list behind a tap -- which is
 * exactly the wrong shape for a control somebody is using *because* the current
 * language is hard for them to read.
 *
 * The change applies immediately: the action writes the cookie and the profile,
 * then `router.refresh()` re-renders the tree from the server in the new
 * language. Rendered, not swapped -- the same path the first page load took.
 */
export function LanguagePicker() {
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();

  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<Locale>(locale);
  const [error, setError] = useState<string | null>(null);

  function choose(next: Locale) {
    if (next === chosen || pending) return;

    // Moved at once, so the control answers the tap even while the server is
    // still being told. It is corrected below if the write fails.
    setChosen(next);
    setError(null);

    start(async () => {
      const result = await setLocale(next);

      if (!result.ok) {
        setError(result.message);
        /*
         * The cookie was still written, so this device *is* in the new
         * language -- the selection stays where the member put it and the
         * message says what did not save. Reverting the radio would be a lie
         * about what they are looking at.
         */
      }

      router.refresh();
    });
  }

  return (
    <div>
      <fieldset disabled={pending}>
        <legend className="sr-only">{t("account.language.title")}</legend>

        <div className="grid gap-2.5">
          {LOCALES.map((option) => {
            const selected = option === chosen;

            return (
              <label
                key={option}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  selected
                    ? "border-ember bg-ember-tint"
                    : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                <input
                  type="radio"
                  name="ui-locale"
                  value={option}
                  checked={selected}
                  onChange={() => choose(option)}
                  className="h-4 w-4 shrink-0 accent-ember"
                />
                {/*
                  `lang` on the name itself. Without it a screen reader announces
                  বাংলা with English phonetics, which is unintelligible -- and
                  this is the one screen where the person listening may not
                  understand the surrounding English at all.
                */}
                <span lang={option} className="text-[1.05rem] text-ink">
                  {LOCALE_NAMES[option]}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-4 text-[0.9rem] leading-relaxed text-ink-subtle">
        {t("account.language.note")}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-[0.9rem] text-ember-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
