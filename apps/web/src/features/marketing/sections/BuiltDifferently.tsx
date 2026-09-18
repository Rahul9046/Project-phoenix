import { Container } from "@/shared/ui/Container";
import { FeatureCard } from "@/features/marketing/components/FeatureCard";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { getT } from "@/features/i18n/server";

const ITEMS = ["few", "mind", "privacy", "pressure"] as const;

export async function BuiltDifferently() {
  const t = await getT();

  return (
    <Section id="built-differently">
      <Container className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <SectionHeading
          eyebrow={t("marketing.built.eyebrow")}
          title={t("marketing.built.title")}
          lede={t("marketing.built.lede")}
        />

        <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {ITEMS.map((key) => (
            <FeatureCard
              key={key}
              title={t(`marketing.built.${key}Title`)}
              description={t(`marketing.built.${key}Body`)}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
