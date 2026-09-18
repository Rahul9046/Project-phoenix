import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { Step } from "@/features/marketing/components/Step";
import { getT } from "@/features/i18n/server";

const STEPS = [
  { number: "01", key: "one" },
  { number: "02", key: "two" },
  { number: "03", key: "three" },
] as const;

export async function HowItWorks() {
  const t = await getT();

  return (
    <Section id="how-it-works" tone="sand">
      <Container>
        <SectionHeading
          eyebrow={t("marketing.how.eyebrow")}
          title={t("marketing.how.title")}
          lede={t("marketing.how.lede")}
        />

        <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8 lg:mt-16 lg:gap-12">
          {STEPS.map((step) => (
            <Step
              key={step.number}
              number={step.number}
              title={t(`marketing.how.${step.key}Title`)}
              description={t(`marketing.how.${step.key}Body`)}
            />
          ))}
        </ol>
      </Container>
    </Section>
  );
}
