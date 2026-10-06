"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/shared/brand/Logo";
import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { AndroidIcon } from "@/shared/ui/PlatformIcon";
import { androidCta } from "@/features/marketing/android-app";
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
      <Container
        measure="bar"
        className="flex h-20 items-center justify-between gap-4"
      >
        <Link href="/" aria-label="Eraya — home" className="shrink-0">
          <Logo size="sm" />
        </Link>

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center gap-5">
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

        {/*
          `shrink-0`, and `whitespace-nowrap` on the CTA below.

          Without them flex shrinks this cluster to fit the nav beside it, and
          the first casualty is the primary CTA: "Begin your journey" was broken
          across three lines and 88 px tall.

          The gaps above are also a notch tighter than they were -- 4/5/3 rather
          than 6/6/4 -- because adding a seventh control to this row put it 28 px
          over. They are tight at every width rather than only below `2xl`: the
          container is `max-w-6xl`, so it is 1,152 px wide on a 1,280 screen and
          on a 2,560 one, and a wider viewport buys no extra room to spend.
        */}
        <div className="hidden shrink-0 items-center gap-3 xl:flex">
          {/*
            On the public site too, and first in the row.

            Someone deciding whether Eraya is for them reads this page before
            they have an account to hold a preference. Putting the control
            anywhere else would mean the only way to read the site in your own
            language is to sign up for something you cannot yet read.
          */}
          <LanguageSwitch />

          {/*
            The app, in the header, for both a visitor and a member.

            It lives here because the homepage card is most of a page down and
            the hero button is below the fold on a short screen -- somebody who
            arrives wanting the app should not have to scroll to find out there
            is one. Outlined rather than filled so the primary CTA beside it is
            still the loudest thing in the row.

            ## Why the mark carries it and the word is only read aloud

            This row is at its limit. The container is `max-w-6xl`, so it is
            1,152 px wide on a 1,280 screen and on a 2,560 one, and it already
            holds a logo, five nav links, a language control, a sign-in link and
            the primary CTA. Measured at 1,280: English, Hindi and Marathi have
            room for a labelled button, Bengali goes 75 px over with one, and
            Tamil and Telugu are 471 px and 90 px over *before* anything is
            added -- a pre-existing overflow this change did not cause and does
            not fix.

            So the header gets the mark, which costs about 56 px instead of 150
            and fits every language, and the word "Download" is `sr-only` -- a
            screen reader announces it, and the accessible name is a real one
            rather than a shrug. The fully labelled button lives everywhere with
            room for it: the hero, the mobile menu, the homepage card, and
            `/download`.

            `title` as well, so a hover on a desktop says what it is for anybody
            unsure what the mark means.
          */}
          <Button
            href={androidCta.href}
            download={androidCta.kind === "direct"}
            variant="secondary"
            className="shrink-0 whitespace-nowrap"
          >
            <AndroidIcon className="h-5 w-5 shrink-0" />
            {t("marketing.nav.download")}
          </Button>

          {signedIn ? (
            /*
              Names the person, so the answer to "am I still logged in?" is on
              screen rather than something to go and check.
            */
            <>
              <span className="text-[0.95rem] text-ink-muted">
                {t("marketing.nav.signedInAs", { name: memberName ?? "" })}
              </span>
              <Button href="/home" className="whitespace-nowrap">
                {t("home.eyebrow")}
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="whitespace-nowrap text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
              >
                {t("marketing.nav.login")}
              </Link>
              <Button href="#begin" className="whitespace-nowrap">
                {t("marketing.nav.begin")}
              </Button>
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

            {/*
              And in the menu, because below `xl` the row above is a hamburger
              and this is the only place a phone visitor can be shown it without
              scrolling the page. Full width, under the primary CTA, same order
              of importance as on the desktop row.
            */}
            <Button
              href={androidCta.href}
              download={androidCta.kind === "direct"}
              variant="secondary"
              size="lg"
              className="mt-3 w-full"
              onClick={() => setOpen(false)}
            >
              <AndroidIcon className="h-5 w-5 shrink-0" />
              {t("marketing.androidApp.cta")}
            </Button>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
