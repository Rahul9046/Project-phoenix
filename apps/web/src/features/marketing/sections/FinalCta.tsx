import { ErayaMark } from "@/shared/brand/Logo";
import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { getT } from "@/features/i18n/server";

export async function FinalCta() {
  const t = await getT();

  return (
    <Section tone="night">
      <Container className="flex flex-col items-center text-center">
        <ErayaMark className="h-12 w-12" />
        <h2 className="mt-8 max-w-3xl text-title text-canvas">
          {t("marketing.finalCta.title")}
        </h2>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-sand-deep">
          {t("marketing.finalCta.lede")}
        </p>
        <Button href="/signup" variant="onDark" size="lg" className="mt-10">
          {t("marketing.finalCta.cta")}
        </Button>
      </Container>
    </Section>
  );
}
