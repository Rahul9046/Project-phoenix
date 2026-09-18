"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LOCALES, LOCALE_NAMES, type Locale } from "@eraya/i18n";

import { setLocale } from "@/features/i18n/actions";
import { useLocale, useT } from "@/features/i18n/LocaleProvider";

/**
 * The language control for screens nobody has signed in to yet.
 *
 * `LanguagePicker` is the settings version of this: a full radio list on the
 * account page, reached deliberately, with room for an explanation. That is the
 * right shape for reviewing a preference later and the wrong shape for the top
 * of a sign-up form, where the question is not "would you like to review this"
 * but "can you read this at all".
 *
 * It needs no session. `setLocale` writes the cookie unconditionally and only
 * then tries the profile, and `getLocale` falls back to that cookie for a
 * signed-out visitor -- so this works on the first page somebody ever opens,
 * which is the only place it really matters.
 *
 * A disclosure rather than a `<select>`. The six names have to be readable *as*
 * the thing being chosen, and a native select on a phone hides them behind a tap
 * on a control labelled in the language the person is struggling with.
 */
export function LanguageSwitch() {
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();

  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const container = useRef<HTMLDivElement>(null);

  /*
   * Closes on a click anywhere else and on Escape. Both are expected of anything
   * that opens over a page, and a panel that can only be dismissed by choosing
   * from it is a trap -- particularly here, where somebody may well open this,
   * find their language is not offered, and want their form back.
   */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(next: Locale) {
    setOpen(false);
    if (next === locale) return;

    start(async () => {
      await setLocale(next);
      /*
       * Rendered in the new language rather than swapped in the browser: the
       * same path the first page load took, so `<html lang>`, the font stack for
       * the script and every server-rendered word change together.
       */
      router.refresh();
    });
  }

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="true"
        // Says what it does rather than what it is: the visible text already
        // names the current language.
        aria-label={t("common.changeLanguage")}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[0.95rem] text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <circle cx="10" cy="10" r="7.25" />
          <path d="M2.75 10h14.5M10 2.75c1.9 2 2.9 4.5 2.9 7.25s-1 5.25-2.9 7.25c-1.9-2-2.9-4.5-2.9-7.25S8.1 4.75 10 2.75Z" />
        </svg>
        <span lang={locale}>{LOCALE_NAMES[locale]}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-3.5 w-3.5"
        >
          <path d="M5.5 8l4.5 4.5L14.5 8" />
        </svg>
      </button>

      {open ? (
        <div
          role="group"
          aria-label={t("account.language.title")}
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface py-1.5 shadow-lg shadow-ink/5"
        >
          {LOCALES.map((option) => {
            const selected = option === locale;

            return (
              <button
                key={option}
                type="button"
                onClick={() => choose(option)}
                aria-current={selected}
                className={`flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-[1.05rem] transition-colors ${
                  selected
                    ? "bg-ember-tint text-ink"
                    : "text-ink hover:bg-canvas"
                }`}
              >
                {/*
                  Each name in its own language, and `lang` on it so a screen
                  reader does not announce বাংলা with English phonetics -- this
                  is the one control whose user may not understand a word of the
                  page around it.
                */}
                <span lang={option}>{LOCALE_NAMES[option]}</span>

                {selected ? (
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-ember"
                  >
                    <path d="M4.5 10.5l3.5 3.5 7.5-7.5" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
