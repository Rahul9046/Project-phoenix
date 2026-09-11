"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/shared/brand/Logo";
import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { navLinks } from "@/features/marketing/content";
import { LanguageSwitch } from "@/features/i18n/LanguageSwitch";
import { useT } from "@/features/i18n/LocaleProvider";

/**
 * The public header, which now knows whether it is talking to a member.
 *
 * It used to show "Log in" and "Begin your journey" unconditionally. A signed-in
 * member who reached the marketing site -- from "Not just yet" at the end of
 * onboarding, from a footer link, or by typing the address -- was met with an
 * invitation to log in, and reasonably concluded they had been logged out. They
 * had not; the header simply had no idea who it was speaking to.
 *
 * The session is read in the layout and passed down, because this is a client
 * component and must not fetch it itself.
 */
export function SiteHeader({
  memberName,
}: {
  /** The signed-in member's first name, or null for a visitor. */
  memberName?: string | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const signedIn = Boolean(memberName);

  // Keep the page behind the mobile menu from scrolling underneath it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-canvas/85 backdrop-blur-sm">
      <Container className="flex h-20 items-center justify-between gap-6">
        <Link href="/" aria-label="Eraya — home" className="shrink-0">
          <Logo size="sm" />
        </Link>

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center gap-6">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="whitespace-nowrap text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
                >
                  {t(link.labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-4 xl:flex">
          {/*
            On the public site too, and first in the row.

            Someone deciding whether Eraya is for them reads this page before
            they have an account to hold a preference. Putting the control
            anywhere else would mean the only way to read the site in your own
            language is to sign up for something you cannot yet read.
          */}
          <LanguageSwitch />

          {signedIn ? (
            /*
              Names the person, so the answer to "am I still logged in?" is on
              screen rather than something to go and check.
            */
            <>
              <span className="text-[0.95rem] text-ink-muted">
                {t("marketing.nav.signedInAs", { name: memberName ?? "" })}
              </span>
              <Button href="/home">{t("home.eyebrow")}</Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="whitespace-nowrap text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
              >
                {t("marketing.nav.login")}
              </Link>
              <Button href="#begin">{t("marketing.nav.begin")}</Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="flex h-11 w-11 items-center justify-center rounded-md border border-line text-ink xl:hidden"
        >
          <span className="sr-only">
            {open ? t("marketing.nav.closeMenu") : t("marketing.nav.openMenu")}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            aria-hidden="true"
            className="h-5 w-5"
          >
            {open ? (
              <path d="m6 6 12 12M18 6 6 18" />
            ) : (
              <path d="M4 8h16M4 16h16" />
            )}
          </svg>
        </button>
      </Container>

      {open ? (
        <div
          id="mobile-menu"
          className="border-t border-line bg-canvas xl:hidden"
        >
          <Container className="py-6">
            <div className="mb-5 flex justify-end">
              <LanguageSwitch />
            </div>

            <nav aria-label="Primary">
              <ul className="flex flex-col">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block border-b border-line py-4 text-lg text-ink"
                    >
                      {t(link.labelKey)}
                    </a>
                  </li>
                ))}
                <li>
                  <Link
                    href={signedIn ? "/account" : "/login"}
                    onClick={() => setOpen(false)}
                    className="block border-b border-line py-4 text-lg text-ink"
                  >
                    {signedIn
                      ? t("account.title")
                      : t("marketing.nav.login")}
                  </Link>
                </li>
              </ul>
            </nav>
            <Button
              href={signedIn ? "/home" : "#begin"}
              size="lg"
              className="mt-6 w-full"
              onClick={() => setOpen(false)}
            >
              {signedIn ? t("home.eyebrow") : t("marketing.nav.begin")}
            </Button>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
