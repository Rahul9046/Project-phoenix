import { membershipCopy } from "@/features/account/content";
import { AppPage, DetailRow, Panel, Pill } from "@/features/app-shell/AppPage";
import { formatRenewalDate } from "@/features/membership/format";
import { loadMembership } from "@/features/membership/entitlements";
import { PremiumCheckout } from "@/features/membership/PremiumCheckout";

export const metadata = { title: "Membership" };

/**
 * What the member has, and what Premium would add.
 *
 * Prices come from the database, never from a constant in here, so the
 * catalogue has one home -- and the checkout below asks for them again from the
 * browser, because the introductory price depends on who is asking and a server
 * render cached for everybody would be wrong for exactly the people it matters
 * to.
 *
 * The purchase itself is a client island. Everything around it stays a server
 * component: entitlements are read where they cannot be tampered with, and only
 * the part that has to talk to a payment sheet runs in the browser.
 */
export default async function MembershipPage() {
  // The catalogue is fetched by the checkout island instead: its prices depend
  // on who is asking, and this render is shared.
  const membership = await loadMembership();

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

          <div className="mt-5">
            <PremiumCheckout premium={isPremium} />
          </div>
        </Panel>

      </div>
    </AppPage>
  );
}
