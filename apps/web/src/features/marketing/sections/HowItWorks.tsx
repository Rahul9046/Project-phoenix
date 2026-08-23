import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { Step } from "@/features/marketing/components/Step";
import { howItWorks } from "@/features/marketing/content";

export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="sand">
      <Container>
        <SectionHeading
          eyebrow={howItWorks.eyebrow}
          title={howItWorks.title}
          lede={howItWorks.lede}
        />

        <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8 lg:mt-16 lg:gap-12">
          {howItWorks.steps.map((step) => (
            <Step key={step.number} {...step} />
          ))}
        </ol>
      </Container>
    </Section>
  );
}
