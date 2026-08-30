import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";
import { cities } from "@/features/marketing/content";
import { getFocusCities } from "@/shared/data/reference";

export async function Cities() {
  // Where the community is densest, not where registration is allowed. Anyone
  // in India can join from anywhere; this list is about focus, not permission.
  const focusCities = await getFocusCities();

  return (
    <Section id="cities" tone="sand">
      <Container className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-20">
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
          <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-ink-subtle">
            Where the community is densest
          </h3>
          <ul className="mt-6">
            {focusCities.map((city) => (
              <li
                key={city.id}
                className="flex items-baseline justify-between gap-4 border-b border-line py-4 last:border-b-0"
              >
                <span className="font-serif text-xl tracking-[-0.01em] text-ink">
                  {city.name}
                </span>
                <span className="text-sm text-ink-subtle">{city.state ?? "India"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-ink-subtle">
            Anyone in India can join from anywhere. This is where you are most
            likely to meet someone today.
          </p>
        </div>
      </Container>
    </Section>
  );
}
