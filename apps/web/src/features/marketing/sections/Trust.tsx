import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { TrustCard } from "@/features/marketing/components/TrustCard";
import { trust } from "@/features/marketing/content";

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
