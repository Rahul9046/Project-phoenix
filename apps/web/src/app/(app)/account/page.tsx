import Link from "next/link";

import { legalRoutes } from "@eraya/legal";

import { getT } from "@/features/i18n/server";
import { AppPage, DetailRow, Panel, Pill } from "@/features/app-shell/AppPage";
import { accountNav, appRoutes } from "@/features/app-shell/nav";
import { genderOptions, relationshipOptions } from "@/features/auth/content";
import { authRoutes } from "@/features/auth/flow";
import { loadAuthSession } from "@/features/auth/load-session";
import { loadMembership } from "@/features/membership/entitlements";
import { getCityById } from "@/shared/data/reference";
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
  const t = await getT();
  const [session, membership] = await Promise.all([
    loadAuthSession(),
    loadMembership(),
  ]);

  const { profile, user } = session;
  const isPremium = membership.tier === "premium";

  // One lookup by id rather than loading every city and filtering. `otherCity`
  // survives only for accounts created before registration opened nationwide.
  const city = profile.city ? await getCityById(profile.city) : null;
  const cityName = city
    ? city.state
      ? `${city.name}, ${city.state}`
      : city.name
    : profile.otherCity;

  const genderKey =
    genderOptions.find((option) => option.value === profile.gender)?.labelKey ??
    null;
  const genderLabel = genderKey ? t(genderKey) : null;

  const relationshipKey =
    relationshipOptions.find(
      (option) => option.value === profile.relationshipStatus,
    )?.labelKey ?? null;
  const relationshipLabel = relationshipKey ? t(relationshipKey) : null;

  const age = ageFrom(profile.dateOfBirth);

  const languages = profile.languages.length
    ? profile.languages.join(", ")
    : t("common.preferNotToSay");

  const absent = (
    <span className="text-ink-subtle">{t("common.notAnswered")}</span>
  );

  return (
    <AppPage title={t("account.title")} lede={t("account.lede")}>
      <div className="grid gap-5">
        <Panel title={t("account.profileTitle")}>
          <p className="mt-1.5 text-[0.95rem] text-ink-muted">
            {t("account.profileLede")}
          </p>
          <dl className="mt-4">
            <DetailRow
              label={t("account.labelName")}
              value={profile.firstName ?? absent}
            />
            <DetailRow
              label={t("account.labelAge")}
              value={age !== null ? `${age}` : absent}
            />
            <DetailRow
              label={t("account.labelGender")}
              value={genderLabel ?? absent}
            />
            <DetailRow label={t("account.labelCity")} value={cityName ?? absent} />
            <DetailRow
              label={t("account.labelRelationship")}
              value={relationshipLabel ?? absent}
            />
            <DetailRow label={t("account.labelLanguages")} value={languages} />
          </dl>
        </Panel>

        <Panel title={t("account.contactTitle")}>
          <dl className="mt-4">
            <DetailRow
              label={t("account.labelEmail")}
              value={user?.email ?? absent}
            />
            {/*
              Read from the profile, not from the stage.
              
              This row used to say "Added" whenever the stage had moved past
              `authenticated`, which was true while the phone step was
              compulsory and became false the moment it stopped being: a member
              who declines passes that milestone with nothing checked, and would
              have been shown their own number as added when Eraya has never
              seen one.

              Unverified is an invitation rather than a warning tone. Nothing is
              withheld from a member who has not done this, so there is nothing
              to flag -- only somewhere to go if they would like to.
            */}
            <DetailRow
              label={t("account.labelPhone")}
              value={
                session.phoneVerified ? (
                  <Pill tone="positive">{t("common.phoneVerified")}</Pill>
                ) : (
                  <Link
                    href={appRoutes.verification}
                    className="text-ember-text underline underline-offset-4 transition-colors hover:text-ember-strong"
                  >
                    {t("account.verification.phoneCta")}
                  </Link>
                )
              }
            />
            <DetailRow
              label={t("account.labelSignInMethod")}
              value={
                <span className="capitalize">{user?.provider ?? "email"}</span>
              }
            />
          </dl>
        </Panel>

        <Panel title={t("account.membershipTitle")}>
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

        {/*
          The documents themselves, kept apart from the account sections above.
          Those are places to change something; these are things to read, and
          they open the public pages rather than a signed-in copy so the link a
          member follows is the same one they can send to somebody else.
        */}
        <Panel>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { href: legalRoutes.privacy, label: t("common.legalPrivacy") },
              { href: legalRoutes.terms, label: t("common.legalTerms") },
              { href: legalRoutes.safety, label: t("common.legalGuidelines") },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-[0.95rem] text-ink-muted underline underline-offset-4 transition-colors hover:text-ember-text"
                >
                  {item.label}
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
