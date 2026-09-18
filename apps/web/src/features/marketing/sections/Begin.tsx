import { getT } from "@/features/i18n/server";
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
export async function Begin() {
  const t = await getT();

  return (
    <Section id="begin">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeading
            eyebrow={t("marketing.begin.eyebrow")}
            title={t("marketing.begin.title")}
            lede={t("marketing.begin.lede")}
            align="center"
          />

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button href="/signup" size="lg">
              {t("marketing.begin.cta")}
            </Button>
            <Button href="/login" variant="secondary" size="lg">
              {t("marketing.begin.secondary")}
            </Button>
          </div>

          <p className="mt-8 text-sm leading-relaxed text-ink-subtle">
            {t("marketing.begin.reassurance")}
          </p>
        </div>
      </Container>
    </Section>
  );
}
