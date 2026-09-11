import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { getT } from "@/features/i18n/server";
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
  const [coverage, t] = await Promise.all([getCityCoverage(), getT()]);

  return (
    <Section id="cities" tone="sand">
      <Container className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
        <div>
          <SectionHeading
            eyebrow={t("marketing.cities.eyebrow")}
            title={t("marketing.cities.title")}
            lede={t("marketing.cities.body")}
          />
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
            {t("marketing.cities.elsewhere")}
          </p>
          <Button href="/signup" size="lg" className="mt-9">
            {t("marketing.cities.cta")}
          </Button>
        </div>

        <div className="border border-line-strong bg-canvas p-8 sm:p-10">
          <p className="text-ink text-6xl font-bold leading-none tracking-[-0.02em] sm:text-7xl">
            {coverage.cities}
          </p>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            {t("marketing.cities.coverageBody", {
              states: coverage.states,
            })}
          </p>
          <p className="mt-6 border-t border-line pt-6 text-sm leading-relaxed text-ink-subtle">
            {t("marketing.cities.coverageNote")}
          </p>
        </div>
      </Container>
    </Section>
  );
}
