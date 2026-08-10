"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { navLinks } from "@/content/site";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

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

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-6 lg:flex">
          <Link
            href="/login"
            className="text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
          >
            Log in
          </Link>
          <Button href="#begin">Begin your journey</Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="flex h-11 w-11 items-center justify-center rounded-md border border-line text-ink lg:hidden"
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
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
          className="border-t border-line bg-canvas lg:hidden"
        >
          <Container className="py-6">
            <nav aria-label="Primary">
              <ul className="flex flex-col">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block border-b border-line py-4 text-lg text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                <li>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="block border-b border-line py-4 text-lg text-ink"
                  >
                    Log in
                  </Link>
                </li>
              </ul>
            </nav>
            <Button
              href="#begin"
              size="lg"
              className="mt-6 w-full"
              onClick={() => setOpen(false)}
            >
              Begin your journey
            </Button>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
