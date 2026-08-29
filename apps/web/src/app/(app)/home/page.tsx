import Link from "next/link";

import { AppPage, Panel, Pill } from "@/features/app-shell/AppPage";
import { home, webVsAppNote } from "@/features/app-shell/content";
import { appRoutes } from "@/features/app-shell/nav";
import { loadAuthSession } from "@/features/auth/load-session";
import { loadMembership } from "@/features/membership/entitlements";
import { Button } from "@/shared/ui/Button";

export const metadata = { title: "Home" };

/**
 * The first screen after signing in.
 *
 * Discovery does not exist yet, and this says so rather than rendering an empty
 * grid — an empty grid reads as "nobody is here", which is a claim about the
 * product nobody has earned the right to make.
 */
export default async function HomePage() {
  const [session, membership] = await Promise.all([
    loadAuthSession(),
    loadMembership(),
  ]);

  const name = session.profile.firstName;
  const isPremium = membership.tier === "premium";

  return (
    <AppPage title={home.greeting(name)} lede={home.lede}>
      <div className="grid gap-5">
        <Panel title={home.discoveryTitle}>
          <p className="mt-3 leading-relaxed text-ink-muted">
            {home.discoveryBody}
          </p>
        </Panel>

        <div className="grid gap-5 sm:grid-cols-2">
          <Panel title={home.profileCardTitle}>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-muted">
              {home.profileCardBody}
            </p>
            <div className="mt-5">
              <Button href={appRoutes.account} variant="secondary">
                {home.profileCardCta}
              </Button>
            </div>
          </Panel>

          <Panel title={home.membershipCardTitle}>
            <div className="mt-3 flex items-center gap-2.5">
              <Pill tone={isPremium ? "positive" : "neutral"}>
                {isPremium ? "Eraya Premium" : "Free member"}
              </Pill>
            </div>
            <div className="mt-5">
              <Button href={appRoutes.membership} variant="secondary">
                {home.membershipCardCta}
              </Button>
            </div>
          </Panel>
        </div>

        <p className="text-sm leading-relaxed text-ink-subtle">
          <span className="font-medium text-ink-muted">
            {webVsAppNote.title}.
          </span>{" "}
          {webVsAppNote.body}{" "}
          <Link
            href={appRoutes.account}
            className="underline underline-offset-4 hover:text-ink"
          >
            Manage your account
          </Link>
          .
        </p>
      </div>
    </AppPage>
  );
}
