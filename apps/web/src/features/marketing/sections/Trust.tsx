import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { TrustCard } from "@/features/marketing/components/TrustCard";
import { getT } from "@/features/i18n/server";

const ITEMS = [
  { icon: "consent", key: "reach" },
  { icon: "privacy", key: "browsable" },
  { icon: "verified", key: "shared" },
  { icon: "review", key: "chapter" },
  { icon: "report", key: "interest" },
] as const;

export async function Trust() {
  const t = await getT();

  return (
    <Section id="trust" tone="sand">
      <Container>
        <SectionHeading
          eyebrow={t("marketing.trust.eyebrow")}
          title={t("marketing.trust.title")}
          lede={t("marketing.trust.lede")}
        />

        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16">
          {ITEMS.map((item) => (
            <TrustCard
              key={item.key}
              icon={item.icon}
              title={t(`marketing.trust.${item.key}Title`)}
              description={t(`marketing.trust.${item.key}Body`)}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
