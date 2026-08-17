import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cities } from "@/content/site";
import { getActiveCities } from "@/lib/data/reference";

export async function Cities() {
  const launchCities = (await getActiveCities()).filter(
    (city) => city.isLaunchCity,
  );

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
            First cities
          </h3>
          <ul className="mt-6">
            {launchCities.map((city) => (
              <li
                key={city.id}
                className="flex items-baseline justify-between gap-4 border-b border-line py-4 last:border-b-0"
              >
                <span className="font-serif text-xl tracking-[-0.01em] text-ink">
                  {city.name}
                </span>
                <span className="text-sm text-ink-subtle">India</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-ink-subtle">
            More cities will follow, guided by where the waitlist grows.
          </p>
        </div>
      </Container>
    </Section>
  );
}
