import { begin } from "@/features/marketing/content";
import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading";

/**
 * The closing invitation.
 *
 * Previously a waitlist form. Registration is open across India now, so asking
 * for an email address in order to tell someone when they can join is asking
 * them to wait for something already available.
 */
export function Begin() {
  return (
    <Section id="begin">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeading
            eyebrow={begin.eyebrow}
            title={begin.title}
            lede={begin.lede}
            align="center"
          />

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button href={begin.cta.href} size="lg">
              {begin.cta.label}
            </Button>
            <Button href={begin.secondary.href} variant="secondary" size="lg">
              {begin.secondary.label}
            </Button>
          </div>

          <p className="mt-8 text-sm leading-relaxed text-ink-subtle">
            {begin.reassurance}
          </p>
        </div>
      </Container>
    </Section>
  );
}
