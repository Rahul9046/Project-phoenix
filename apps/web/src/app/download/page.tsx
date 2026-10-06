import type { Metadata } from "next";

import { androidCta } from "@/features/marketing/android-app";
import { site } from "@/features/marketing/content";
import { getT } from "@/features/i18n/server";
import { Logo } from "@/shared/brand/Logo";
import { Button } from "@/shared/ui/Button";
import { AndroidIcon } from "@/shared/ui/PlatformIcon";

export const metadata: Metadata = {
  title: "Download for Android",
  description: `Download the official ${site.name} app for Android.`,
  alternates: { canonical: "/download" },
};

/**
 * The page a link in a bio or a message lands on.
 *
 * Outside the `(marketing)` group on purpose, so it gets the root layout and
 * nothing else -- no site header, no footer, no navigation. Someone arriving
 * from a bio link has been asked to do exactly one thing, and a page offering
 * eleven other ones makes that harder rather than more helpful. The way back to
 * the rest of Eraya is a single link at the bottom, after the thing they came
 * for.
 *
 * It used to live at `/beta` and be addressed to testers. `/beta` still answers
 * and redirects here, because that address is in circulation.
 *
 * ## Why the three steps are on this page and not on the homepage
 *
 * Installing an app from a website is unfamiliar in a way installing from the
 * Play Store is not, and the unfamiliar part is a system dialog that appears
 * after the download and asks a question. Somebody who has read one sentence
 * about that dialog taps through it; somebody who has not often stops. So the
 * explanation is here, where the person has already decided to install, rather
 * than on a homepage where it would read as a warning to everybody else.
 *
 * The steps deliberately say that the permission Android asks for applies to
 * this install. They do not tell anyone to turn on installing from unknown
 * sources and leave it on, because that is a setting about every future app and
 * not about this one, and nobody should be talked into it by a download page.
 *
 * Left-aligned rather than centred, unlike the rest of the page: these are three
 * sentences that wrap to two or three lines each on a phone, and centred prose
 * at that length is harder to read than it looks in a mockup.
 */
export default async function DownloadPage() {
  const t = await getT();

  const steps = [
    t("marketing.androidApp.stepOne"),
    t("marketing.androidApp.stepTwo"),
    t("marketing.androidApp.stepThree"),
  ];

  return (
    <main
      id="main"
      className="flex min-h-full flex-1 flex-col items-center justify-center bg-canvas px-6 py-16 text-center"
    >
      <Logo variant="full" size="lg" />

      <h1 className="mt-10 max-w-xl text-title text-ink">
        {t("marketing.androidApp.pageTitle")}
      </h1>

      <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-muted">
        {t("marketing.androidApp.pageLede")}
      </p>

      {/*
        Capped rather than edge to edge: full width on a phone, where it is the
        only target on the screen, and a button rather than a banner once there
        is a desktop's worth of room around it.
      */}
      <Button
        href={androidCta.href}
        download={androidCta.kind === "direct"}
        size="lg"
        className="mt-10 w-full max-w-sm sm:w-auto"
      >
        <AndroidIcon className="h-5 w-5 shrink-0" />
        {t("marketing.androidApp.cta")}
      </Button>

      {androidCta.kind === "direct" ? (
        <p className="mt-5 text-sm font-medium text-ink-subtle">
          {t("marketing.androidApp.version", { version: androidCta.version })}
        </p>
      ) : null}

      <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink-subtle">
        {t("marketing.androidApp.platformNote")}
      </p>

      {androidCta.kind === "direct" ? (
        <div className="mt-12 w-full max-w-md rounded-3xl border border-line bg-sand px-5 py-8 text-left sm:px-8">
          <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-ink-subtle">
            {t("marketing.androidApp.stepsTitle")}
          </h2>

          <ol className="mt-6 space-y-5">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm font-medium text-ink-muted"
                >
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink-muted">{step}</p>
              </li>
            ))}
          </ol>

          <p className="mt-7 border-t border-line pt-6 text-sm leading-relaxed text-ink-subtle">
            {t("marketing.androidApp.reassurance")}
          </p>
        </div>
      ) : null}

      <Button href="/" variant="quiet" className="mt-12">
        {t("marketing.androidApp.backToSite")}
      </Button>
    </main>
  );
}
