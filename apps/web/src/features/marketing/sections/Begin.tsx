import { BeginForm } from "@/features/marketing/sections/BeginForm";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { begin } from "@/features/marketing/content";
import { getActiveCities } from "@/shared/data/reference";

export async function Begin() {
  // The same list the signup flow uses, so the landing form can never offer a
  // city the server would then reject.
  const cities = await getActiveCities();

  return (
    <Section id="begin">
      <Container className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-20">
        <SectionHeading
          eyebrow={begin.eyebrow}
          title={begin.title}
          lede={begin.lede}
        />
        <BeginForm cities={cities.map((city) => city.name)} />
      </Container>
    </Section>
  );
}
