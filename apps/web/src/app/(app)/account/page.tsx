import Link from "next/link";

import { account } from "@/features/account/content";
import { AppPage, DetailRow, Panel, Pill } from "@/features/app-shell/AppPage";
import { accountNav, appRoutes } from "@/features/app-shell/nav";
import { genderOptions, relationshipOptions } from "@/features/auth/content";
import { authRoutes } from "@/features/auth/flow";
import { loadAuthSession } from "@/features/auth/load-session";
import { loadMembership } from "@/features/membership/entitlements";
import { getActiveCities } from "@/shared/data/reference";
import { Button } from "@/shared/ui/Button";

export const metadata = { title: "Your account" };

/** Age from a date of birth. Only the age is ever shown, never the date. */
function ageFrom(iso: string | null): number | null {
  if (!iso) return null;
  const born = new Date(iso);
  if (Number.isNaN(born.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }
  return age;
}

export default async function AccountPage() {
  const [session, membership, cities] = await Promise.all([
    loadAuthSession(),
    loadMembership(),
    getActiveCities(),
  ]);

  const { profile, user } = session;
  const isPremium = membership.tier === "premium";

  const cityName =
    profile.otherCity ??
    cities.find((city) => city.id === profile.city)?.name ??
    null;

  const genderLabel =
    genderOptions.find((option) => option.value === profile.gender)?.label ??
    null;

  const relationshipLabel =
    relationshipOptions.find(
      (option) => option.value === profile.relationshipStatus,
    )?.label ?? null;

  const age = ageFrom(profile.dateOfBirth);
  const phoneVerified = session.stage !== "authenticated";

  const languages = profile.languages.length
    ? profile.languages.join(", ")
    : account.languagesUndisclosed;

  const absent = (
    <span className="text-ink-subtle">{account.notAnswered}</span>
  );

  return (
    <AppPage title={account.title} lede={account.lede}>
      <div className="grid gap-5">
        <Panel title={account.profileTitle}>
          <p className="mt-1.5 text-[0.95rem] text-ink-muted">
            {account.profileLede}
          </p>
          <dl className="mt-4">
            <DetailRow
              label={account.labels.name}
              value={profile.firstName ?? absent}
            />
            <DetailRow
              label={account.labels.age}
              value={age !== null ? `${age}` : absent}
            />
            <DetailRow
              label={account.labels.gender}
              value={genderLabel ?? absent}
            />
            <DetailRow label={account.labels.city} value={cityName ?? absent} />
            <DetailRow
              label={account.labels.relationship}
              value={relationshipLabel ?? absent}
            />
            <DetailRow label={account.labels.languages} value={languages} />
          </dl>
        </Panel>

        <Panel title={account.contactTitle}>
          <dl className="mt-4">
            <DetailRow
              label={account.labels.email}
              value={user?.email ?? absent}
            />
            <DetailRow
              label={account.labels.phone}
              value={
                <Pill tone={phoneVerified ? "positive" : "attention"}>
                  {phoneVerified
                    ? account.phoneVerified
                    : account.phoneUnverified}
                </Pill>
              }
            />
            <DetailRow
              label={account.labels.signInMethod}
              value={
                <span className="capitalize">{user?.provider ?? "email"}</span>
              }
            />
          </dl>
        </Panel>

        <Panel title={account.membershipTitle}>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <Pill tone={isPremium ? "positive" : "neutral"}>
              {isPremium ? "Eraya Premium" : "Free member"}
            </Pill>
            <Button href={appRoutes.membership} variant="secondary">
              View membership
            </Button>
          </div>
        </Panel>

        {/* The remaining account sections, as plain destinations. */}
        <Panel>
          <ul className="-my-1">
            {accountNav
              .filter((item) => item.href !== appRoutes.account)
              .map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-14 flex-col justify-center border-b border-line py-3 transition-colors last:border-b-0 hover:text-ember-text"
                  >
                    <span className="font-medium text-ink">{item.label}</span>
                    <span className="mt-0.5 text-sm text-ink-subtle">
                      {item.description}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[0.95rem] text-ink-muted">
              Signed in as{" "}
              <span className="font-medium text-ink">
                {profile.firstName ?? user?.email}
              </span>
            </p>
            <Button href={authRoutes.logout} variant="secondary">
              Log out
            </Button>
          </div>
        </Panel>
      </div>
    </AppPage>
  );
}
