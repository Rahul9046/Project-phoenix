import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TrustCard } from "@/components/ui/TrustCard";
import { trust } from "@/content/site";

export function Trust() {
  return (
    <Section id="trust" tone="sand">
      <Container>
        <SectionHeading
          eyebrow={trust.eyebrow}
          title={trust.title}
          lede={trust.lede}
        />

        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16">
          {trust.items.map((item) => (
            <TrustCard key={item.title} {...item} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
