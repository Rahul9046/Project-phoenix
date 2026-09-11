import { ErayaMark } from "@/shared/brand/Logo";
import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
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
