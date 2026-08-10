import { DawnVisual } from "@/components/brand/DawnVisual";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/SectionHeading";
import { hero } from "@/content/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line bg-canvas">
      <Container className="grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:py-28">
        <div className="animate-rise">
          <Eyebrow>{hero.eyebrow}</Eyebrow>

          <h1 className="mt-6 font-serif text-[2.6rem] leading-[1.08] tracking-[-0.025em] text-ink sm:text-6xl lg:text-[4.25rem]">
            {hero.headline[0]}
            <br className="hidden sm:block" />{" "}
            <span className="text-ember-text">{hero.headline[1]}</span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-muted sm:text-xl">
            {hero.lede}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button href={hero.primaryCta.href} size="lg">
              {hero.primaryCta.label}
            </Button>
            <Button href={hero.secondaryCta.href} variant="secondary" size="lg">
              {hero.secondaryCta.label}
            </Button>
          </div>

          <p className="mt-8 text-sm text-ink-subtle">{hero.note}</p>
        </div>

        <div className="animate-rise [animation-delay:120ms]">
          <DawnVisual className="mx-auto h-auto w-full max-w-md lg:max-w-none" />
        </div>
      </Container>
    </section>
  );
}
