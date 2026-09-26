import { androidBeta, androidBetaHref } from "@/features/marketing/android-beta";
import { getT } from "@/features/i18n/server";
import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { Eyebrow } from "@/shared/ui/SectionHeading";

/**
 * The Android beta, offered on the public site.
 *
 * Set in a sand card on a canvas section rather than taking a tone of its own.
 * The page alternates canvas and sand band by band, and inserting a ninth band
 * would put two of the same colour next to each other wherever it landed; a
 * card separates it from `Begin` below without disturbing that rhythm, and
 * reads as an aside — which is what it is. The web product is complete, and
 * the app is a second way in rather than the way in.
 *
 * `text-heading` rather than the `text-title` every other section uses. At
 * `clamp(2.15rem, 4.2vw, 3rem)` a title inside a card at this width stops
 * looking like a card.
 */
export async function AndroidBeta() {
  const t = await getT();

  return (
    <Section id="android-beta">
      <Container>
        <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-sand px-6 py-12 text-center sm:px-12 sm:py-14">
          <div className="flex justify-center">
            <Eyebrow>{t("marketing.androidBeta.eyebrow")}</Eyebrow>
          </div>

          <h2 className="mt-5 text-heading text-ink">
            {t("marketing.androidBeta.title")}
          </h2>

          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            {t("marketing.androidBeta.lede")}
          </p>

          {/*
            Full width until there is room for it not to be. Most of this
            traffic arrives from Instagram on a phone held in one hand, where a
            button that spans the column is the easiest thing on the screen to
            hit and needs no aim at all.
          */}
          <Button
            href={androidBetaHref}
            download
            size="lg"
            className="mt-9 w-full sm:w-auto"
          >
            {t("marketing.androidBeta.cta")}
          </Button>

          <p className="mt-5 text-sm font-medium text-ink-subtle">
            {t("marketing.androidBeta.version", { version: androidBeta.version })}
          </p>

          <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-ink-subtle">
            {t("marketing.androidBeta.note")}
          </p>
        </div>
      </Container>
    </Section>
  );
}
