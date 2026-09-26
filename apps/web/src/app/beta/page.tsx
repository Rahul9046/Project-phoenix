import type { Metadata } from "next";

import { androidBeta, androidBetaHref } from "@/features/marketing/android-beta";
import { site } from "@/features/marketing/content";
import { getT } from "@/features/i18n/server";
import { Logo } from "@/shared/brand/Logo";
import { Button } from "@/shared/ui/Button";

export const metadata: Metadata = {
  title: "Android Beta",
  description: `Download the ${site.name} Android beta, version ${androidBeta.version}.`,
  alternates: { canonical: "/beta" },
};

/**
 * The page an Instagram link lands on.
 *
 * Outside the `(marketing)` group on purpose, so it gets the root layout and
 * nothing else — no site header, no footer, no navigation. Someone arriving
 * from a bio link has been asked to do exactly one thing, and a page offering
 * eleven other ones makes that harder rather than more helpful. The way back
 * to the rest of Eraya is a single link at the bottom, after the thing they
 * came for.
 *
 * One screen, centred, no scrolling on a phone unless the language needs it.
 * The mark comes from `shared/brand`, which draws the approved artwork from
 * `mark.ts` — the same component the header and the hero use.
 */
export default async function BetaPage() {
  const t = await getT();

  return (
    <main
      id="main"
      className="flex min-h-full flex-1 flex-col items-center justify-center bg-canvas px-6 py-16 text-center"
    >
      <Logo variant="full" size="lg" />

      <h1 className="mt-10 max-w-xl text-title text-ink">
        {t("marketing.androidBeta.pageTitle")}
      </h1>

      <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-muted">
        {t("marketing.androidBeta.pageLede")}
      </p>

      {/*
        Capped rather than edge to edge: full width on a phone, where it is the
        only target on the screen, and a button rather than a banner once there
        is a desktop's worth of room around it.
      */}
      <Button
        href={androidBetaHref}
        download
        size="lg"
        className="mt-10 w-full max-w-sm sm:w-auto"
      >
        {t("marketing.androidBeta.cta")}
      </Button>

      <p className="mt-5 text-sm font-medium text-ink-subtle">
        {t("marketing.androidBeta.version", { version: androidBeta.version })}
      </p>

      <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink-subtle">
        {t("marketing.androidBeta.note")}
      </p>

      <Button href="/" variant="quiet" className="mt-12">
        {t("marketing.androidBeta.backToSite")}
      </Button>
    </main>
  );
}
