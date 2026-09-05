import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { cities } from "@/features/marketing/content";
import { getCityCoverage } from "@/shared/data/reference";

/**
 * Where Eraya is available.
 *
 * This used to list seven cities under "Where the community is densest" — a
 * claim about member distribution, drawn from a hardcoded flag, on a page that
 * says anyone in India can join. Both the claim and the implied restriction are
 * gone. What is shown instead is a number counted from the cities table, which
 * cannot drift away from what the search field will actually accept.
 */
export async function Cities() {
  const coverage = await getCityCoverage();

  return (
    <Section id="cities" tone="sand">
      <Container className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
        <div>
          <SectionHeading
            eyebrow={cities.eyebrow}
            title={cities.title}
            lede={cities.body[0]}
          />
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
            {cities.elsewhere}
          </p>
          <Button href={cities.cta.href} size="lg" className="mt-9">
            {cities.cta.label}
          </Button>
        </div>

        <div className="border border-line-strong bg-canvas p-8 sm:p-10">
          <p className="text-ink text-6xl font-bold leading-none tracking-[-0.02em] sm:text-7xl">
            {coverage.cities}
          </p>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            cities and towns to choose from, across all {coverage.states} states
            and union territories.
          </p>
          <p className="mt-6 border-t border-line pt-6 text-sm leading-relaxed text-ink-subtle">
            Your city is on the list. It decides who you are likely to meet
            nearby — never whether you can join.
          </p>
        </div>
      </Container>
    </Section>
  );
}
