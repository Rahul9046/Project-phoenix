import { Container } from "@/shared/ui/Container";
import { FeatureCard } from "@/features/marketing/components/FeatureCard";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { builtDifferently } from "@/features/marketing/content";

export function BuiltDifferently() {
  return (
    <Section id="built-differently">
      <Container className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <SectionHeading
          eyebrow={builtDifferently.eyebrow}
          title={builtDifferently.title}
          lede={builtDifferently.lede}
        />

        <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {builtDifferently.items.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
