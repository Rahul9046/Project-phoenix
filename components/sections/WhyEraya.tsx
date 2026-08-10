import { Container } from "@/components/ui/Container";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { whyEraya } from "@/content/site";

export function WhyEraya() {
  return (
    <Section id="about">
      <Container>
        <SectionHeading
          eyebrow={whyEraya.eyebrow}
          title={whyEraya.title}
          lede={whyEraya.lede}
        />

        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16">
          {whyEraya.items.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
