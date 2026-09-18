import { Container } from "@/shared/ui/Container";
import { FeatureCard } from "@/features/marketing/components/FeatureCard";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { getT } from "@/features/i18n/server";

const ITEMS = ["paywall", "curiosity", "collecting", "trust"] as const;

export async function WhyEraya() {
  const t = await getT();

  return (
    <Section id="about">
      <Container>
        <SectionHeading
          eyebrow={t("marketing.why.eyebrow")}
          title={t("marketing.why.title")}
          lede={t("marketing.why.lede")}
        />

        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16">
          {ITEMS.map((key) => (
            <FeatureCard
              key={key}
              title={t(`marketing.why.${key}Title`)}
              description={t(`marketing.why.${key}Body`)}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
