import { ErayaMark } from "@/shared/brand/Logo";
import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { finalCta } from "@/features/marketing/content";

export function FinalCta() {
  return (
    <Section tone="night">
      <Container className="flex flex-col items-center text-center">
        <ErayaMark className="h-12 w-12" />
        <h2 className="mt-8 max-w-3xl text-title text-canvas">
          {finalCta.title}
        </h2>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-sand-deep">
          {finalCta.lede}
        </p>
        <Button
          href={finalCta.cta.href}
          variant="onDark"
          size="lg"
          className="mt-10"
        >
          {finalCta.cta.label}
        </Button>
      </Container>
    </Section>
  );
}
