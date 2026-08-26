import type { Metadata } from "next";

import { pricing, site } from "@/features/marketing/content";
import {
  loadPlans,
  loadTierComparison,
} from "@/features/membership/entitlements";
import { formatPeriod, formatRupees } from "@/features/membership/format";
import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";
import { Eyebrow, SectionHeading } from "@/shared/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Pricing",
  description: `What ${site.name} costs, and what is free.`,
};

/** A tick for something included, a dash for something that is not. */
function Mark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={on ? "text-ember-text" : "text-ink-subtle/50"}
    >
      {on ? "✓" : "—"}
    </span>
  );
}

/**
 * The public pricing page.
 *
 * Reachable without an account, deliberately: someone weighing Eraya up has to
 * be able to see what it costs before committing to signing up, and the RLS
 * policies grant `anon` read on plans and entitlements precisely so this page
 * can exist.
 *
 * Both the feature lists and the prices come from the database. Nothing is
 * restated in this component, so the page cannot promise something the
 * entitlements table does not grant, or a price the catalogue does not hold.
 */
export default async function PricingPage() {
  const [plans, capabilities] = await Promise.all([
    loadPlans(),
    loadTierComparison(),
  ]);

  const shared = capabilities.filter((capability) => !capability.isUpgrade);
  const premiumOnly = capabilities.filter((capability) => capability.isUpgrade);

  const monthly = plans.find((plan) => plan.introPricePaise !== null);
  const monthlyIntro = monthly?.introPricePaise ?? null;

  return (
    <>
      <Section>
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>{pricing.eyebrow}</Eyebrow>
            <h1 className="mt-6 font-serif text-[2.4rem] leading-[1.1] tracking-[-0.025em] text-ink sm:text-5xl">
              {pricing.title}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-ink-muted sm:text-xl">
              {pricing.lede}
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-4xl gap-5 lg:grid-cols-2">
            {/* Free. Listed first, because it is what most people will use. */}
            <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
              <h2 className="font-serif text-2xl text-ink">
                {pricing.freeName}
              </h2>
              <p className="mt-4 font-serif text-4xl text-ink">
                {pricing.freePrice}
              </p>
              <p className="mt-2 text-[0.95rem] text-ink-subtle">
                {pricing.freePriceNote}
              </p>

              <ul className="mt-7 grid gap-3">
                {shared.map((capability) => (
                  <li
                    key={capability.key}
                    className="flex items-start gap-3 text-[0.95rem] leading-relaxed text-ink-muted"
                  >
                    <Mark on />
                    <span>
                      {capability.description}
                      {capability.kind === "number" ? (
                        <span className="text-ink-subtle">
                          {" — "}
                          {String(capability.free)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}

                {/*
                  What free does not include, shown rather than left out. An
                  omission makes someone hunt for the catch; a dash answers the
                  question before it is asked.
                */}
                {premiumOnly.map((capability) => (
                  <li
                    key={capability.key}
                    className="flex items-start gap-3 text-[0.95rem] leading-relaxed text-ink-subtle/80"
                  >
                    <Mark on={false} />
                    <span>{capability.description}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button href="/signup" variant="secondary" size="lg">
                  {pricing.freeCta}
                </Button>
              </div>
            </div>

            {/* Premium. */}
            <div className="rounded-2xl border border-ember/35 bg-surface p-6 ring-1 ring-ember/10 sm:p-8">
              <h2 className="font-serif text-2xl text-ink">
                {pricing.premiumName}
              </h2>

              <p className="mt-4 font-serif text-4xl text-ink">
                {monthlyIntro !== null ? formatRupees(monthlyIntro) : "—"}
                <span className="ml-2 align-middle font-sans text-base font-normal text-ink-subtle">
                  first month
                </span>
              </p>
              <p className="mt-2 text-[0.95rem] text-ink-subtle">
                {monthly
                  ? `then ${formatRupees(monthly.pricePaise)} a month, or pay for a longer term below`
                  : null}
              </p>

              <p className="mt-7 text-[0.95rem] font-medium text-ink">
                {pricing.premiumIntro}
              </p>
              <ul className="mt-3 grid gap-3">
                {premiumOnly.map((capability) => (
                  <li
                    key={capability.key}
                    className="flex items-start gap-3 text-[0.95rem] leading-relaxed text-ink-muted"
                  >
                    <Mark on />
                    <span>
                      {capability.description}
                      {capability.kind === "number" ? (
                        <span className="text-ink-subtle">
                          {" — "}
                          {String(capability.premium)} instead of{" "}
                          {String(capability.free)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-8 text-sm leading-relaxed text-ink-subtle">
                {pricing.notYetBody}
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="sand">
        <Container>
          <SectionHeading title={pricing.plansTitle} lede={pricing.plansLede} />

          <ul className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
            {plans.map((plan) => {
              const introPaise = plan.introPricePaise;
              const hasIntro =
                introPaise !== null && plan.introPeriodMonths !== null;

              return (
                <li
                  key={plan.id}
                  className="rounded-2xl border border-line bg-surface p-6"
                >
                  <p className="font-medium text-ink">{plan.name}</p>
                  <p className="mt-3 font-serif text-3xl text-ink">
                    {formatRupees(hasIntro ? introPaise : plan.pricePaise)}
                  </p>

                  <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-muted">
                    {hasIntro
                      ? pricing.recurringNote(
                          formatRupees(introPaise),
                          formatRupees(plan.pricePaise),
                        )
                      : pricing.oneOffNote(
                          formatRupees(plan.pricePaise),
                          formatPeriod(plan.periodMonths),
                        )}
                  </p>

                </li>
              );
            })}
          </ul>

          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-line-strong bg-canvas p-6 text-center">
            <p className="font-medium text-ink">{pricing.notYetTitle}</p>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-muted">
              {pricing.notYetBody}
            </p>
            <div className="mt-6 flex justify-center">
              <Button href="/signup" size="lg">
                {pricing.freeCta}
              </Button>
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeading title={pricing.faqTitle} />
          <dl className="mx-auto mt-12 grid max-w-3xl gap-8">
            {pricing.faq.map((item) => (
              <div key={item.q}>
                <dt className="font-serif text-xl text-ink">{item.q}</dt>
                <dd className="mt-2.5 leading-relaxed text-ink-muted">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>
    </>
  );
}
