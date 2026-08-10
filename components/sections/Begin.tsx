import { BeginForm } from "@/components/sections/BeginForm";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { begin } from "@/content/site";

export function Begin() {
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
