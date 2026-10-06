import { androidCta } from "@/features/marketing/android-app";
import { ErayaMark } from "@/shared/brand/Logo";
import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { AndroidIcon } from "@/shared/ui/PlatformIcon";
import { Eyebrow } from "@/shared/ui/SectionHeading";
import { getT } from "@/features/i18n/server";

export async function Hero() {
  const t = await getT();

  return (
    <section className="relative overflow-hidden border-b border-line bg-canvas">
      <Container className="grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:py-28">
        <div className="animate-rise">
          <Eyebrow>{t("marketing.hero.eyebrow")}</Eyebrow>

          <h1 className="mt-6 text-display text-ink">
            {t("marketing.hero.headlineOne")}
            <br className="hidden sm:block" />{" "}
            <span className="text-ember-text">
              {t("marketing.hero.headlineTwo")}
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-muted sm:text-xl">
            {t("marketing.hero.lede")}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button href="/signup" size="lg">
              {t("marketing.hero.primaryCta")}
            </Button>
            <Button href="#how-it-works" variant="secondary" size="lg">
              {t("marketing.hero.secondaryCta")}
            </Button>
          </div>

          <p className="mt-8 text-sm text-ink-subtle">
            {t("marketing.hero.note")}
          </p>

          {/*
            The Android app, in the hero and as a real button.

            This was a quiet text link, and that was the wrong call: the only
            actual download button on the page sat in a card 7,800 px down at a
            320 px viewport, which is not somewhere anybody finds it. An app you
            are asking the public to install needs a control, not a mention.

            Still `secondary` rather than `primary`, and set below a hairline
            rather than added to the row above. The filled terracotta "Create
            your account" stays the one dominant thing in the hero; this reads
            as a separate, second offer -- which is what it is, since the web
            product is complete and the app is another way in.

            It downloads directly, the same as the card, because a button that
            says "Download for Android" and instead opens a page is a small lie.
            The install guidance sits beside it as a quiet link for anyone who
            wants to read before tapping.
          */}
          <div className="mt-7 border-t border-line pt-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Button
                href={androidCta.href}
                download={androidCta.kind === "direct"}
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                {/*
                  Inherits `text-ink` here rather than being white, because this
                  is the one outlined download button on the site and a white
                  mark on canvas would be invisible. `PlatformIcon` takes
                  `currentColor` precisely so the same component can be white on
                  the filled buttons and ink on this one.
                */}
                <AndroidIcon className="h-5 w-5 shrink-0" />
                {t("marketing.androidApp.cta")}
              </Button>

              {androidCta.kind === "direct" ? (
                <Button
                  href="/download"
                  variant="quiet"
                  className="inline-flex min-h-11 items-center justify-center text-sm sm:justify-start"
                >
                  {t("marketing.androidApp.helpLink")}
                </Button>
              ) : null}
            </div>

            {/*
              The one sentence that keeps an iPhone from being offered an APK.
              Said here as well as on the card and on `/download`, because this
              is now the first place most people will meet the download.
            */}
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-subtle">
              {t("marketing.androidApp.platformNote")}
            </p>
          </div>
        </div>

        {/*
          The mark, at the one size in the product where it is the subject
          rather than a label. Capped well below the column width: the tile is a
          solid terracotta field, and at full width it stops reading as a logo
          and starts reading as a coloured panel.

          Decorative on purpose — aria-hidden inside ErayaMark. The headline
          beside it already carries the meaning, and the header names the brand,
          so announcing it a third time would only add noise for a screen reader.
        */}
        <div className="animate-rise flex justify-center [animation-delay:120ms]">
          <ErayaMark className="h-auto w-full max-w-[15rem] sm:max-w-xs" />
        </div>
      </Container>
    </section>
  );
}
