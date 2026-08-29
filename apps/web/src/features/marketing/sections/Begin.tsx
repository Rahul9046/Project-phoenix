import { BeginForm } from "@/features/marketing/sections/BeginForm";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { begin } from "@/features/marketing/content";

export function Begin() {
  // No city list to fetch: the form searches as the person types, over every
  // city in India.
  return (
    <Section id="begin">
      <Container className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-20">
        <SectionHeading
          eyebrow={begin.eyebrow}
          title={begin.title}
          lede={begin.lede}
        />
        <BeginForm />
      </Container>
    </Section>
  );
}
