import { membershipCopy } from "@/features/account/content";
import { AppPage, DetailRow, Panel, Pill } from "@/features/app-shell/AppPage";
import {
  formatPeriod,
  formatRenewalDate,
  formatRupees,
} from "@/features/membership/format";
import { loadMembership, loadPlans } from "@/features/membership/entitlements";

export const metadata = { title: "Membership" };

/**
 * What the member has, and what Premium would add.
 *
 * Prices come from the database, never from a constant in here, so the
 * catalogue has one home. Nothing on this page can take money: no payment
 * provider is configured, and a button that appeared to charge and did not
 * would be worse than saying so plainly.
 */
export default async function MembershipPage() {
  const [membership, plans] = await Promise.all([
    loadMembership(),
    loadPlans(),
  ]);

  const { entitlements, subscription } = membership;
  const isPremium = membership.tier === "premium";

  // Read from entitlements rather than restating the product decisions, so
  // this list cannot drift from what the application actually enforces.
  const included = [
    ["Browse and discover profiles", entitlements.canBrowseProfiles],
    ["Age, city, language and chapter filters", entitlements.canUseDiscoveryFilters],
    ["Express interest", entitlements.canExpressInterest],
    ["Message the people you connect with", entitlements.canMessageConnections],
  ] as const;

  const premiumAdds = [
    "See who expressed interest in you",
    "More profile reverts",
    "Browse incognito",
    "Priority profile visibility",
  ];

  return (
    <AppPage title={membershipCopy.title} lede={membershipCopy.lede}>
      <div className="grid gap-5">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Pill tone={isPremium ? "positive" : "neutral"}>
                {isPremium
                  ? membershipCopy.premiumName
                  : membershipCopy.freeName}
              </Pill>
              {!isPremium ? (
                <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">
                  {membershipCopy.freeBody}
                </p>
              ) : null}
            </div>
          </div>

          {subscription ? (
            <dl className="mt-5">
              <DetailRow
                label={membershipCopy.currentPlan}
                value={subscription.planName}
              />
              <DetailRow
                label={membershipCopy.status}
                value={<span className="capitalize">{subscription.status}</span>}
              />
              {formatRenewalDate(subscription.currentPeriodEnd) ? (
                <DetailRow
                  label={
                    subscription.cancelAt
                      ? membershipCopy.ends
                      : membershipCopy.renews
                  }
                  value={formatRenewalDate(subscription.currentPeriodEnd)}
                />
              ) : null}
            </dl>
          ) : null}
        </Panel>

        <div className="grid gap-5 sm:grid-cols-2">
          <Panel title={membershipCopy.includedTitle}>
            <ul className="mt-4 grid gap-2.5">
              {included
                .filter(([, allowed]) => allowed)
                .map(([label]) => (
                  <li
                    key={label}
                    className="text-[0.95rem] leading-relaxed text-ink-muted"
                  >
                    {label}
                  </li>
                ))}
              <li className="text-[0.95rem] leading-relaxed text-ink-muted">
                {entitlements.revertLimit} profile reverts per session
              </li>
            </ul>
          </Panel>

          <Panel title={membershipCopy.premiumTitle}>
            <ul className="mt-4 grid gap-2.5">
              {premiumAdds.map((label) => (
                <li
                  key={label}
                  className="text-[0.95rem] leading-relaxed text-ink-muted"
                >
                  {label}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title={membershipCopy.plansTitle}>
          <p className="mt-1.5 text-[0.95rem] text-ink-muted">
            {membershipCopy.plansLede}
          </p>

          <ul className="mt-5 grid gap-3">
            {plans.map((plan) => {
              const hasIntro =
                plan.introPricePaise !== null && plan.introPeriodMonths !== null;

              return (
                <li
                  key={plan.id}
                  className="rounded-xl border border-line px-4 py-4 sm:px-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-medium text-ink">{plan.name}</span>
                    <span className="text-name text-ink">
                      {formatRupees(
                        hasIntro ? plan.introPricePaise! : plan.pricePaise,
                      )}
                    </span>
                  </div>

                  {/*
                    The renewal price is stated next to the introductory one,
                    never after a click. Someone must be able to see what they
                    will pay in month two before they agree to month one.
                  */}
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">
                    {hasIntro
                      ? membershipCopy.renewalNote(
                          formatRupees(plan.introPricePaise!),
                          formatRupees(plan.pricePaise),
                        )
                      : membershipCopy.oneOffNote(
                          formatRupees(plan.pricePaise),
                          formatPeriod(plan.periodMonths),
                        )}
                  </p>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title={membershipCopy.paymentsUnavailableTitle}>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-muted">
            {membershipCopy.paymentsUnavailableBody}
          </p>
        </Panel>
      </div>
    </AppPage>
  );
}
