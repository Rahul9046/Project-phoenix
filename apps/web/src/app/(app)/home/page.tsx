import Link from "next/link";

import { greetingFor, home } from "@/features/app-shell/content";
import { appRoutes } from "@/features/app-shell/nav";
import { loadAuthSession } from "@/features/auth/load-session";
import {
  MemberMonogram,
  MemberSummary,
} from "@/features/members/MemberPresentation";
import {
  getConnections,
  getInterestsReceived,
  getIntroductions,
  getProfileCompleteness,
} from "@/features/members/data";
import { loadMembership } from "@/features/membership/entitlements";
import { Button } from "@/shared/ui/Button";

export const metadata = { title: "My Eraya" };

/**
 * The signed-in home.
 *
 * Deliberately not a feed. A feed answers "what is there?" and rewards
 * scrolling; this answers "where am I?" and rewards leaving. Every section is
 * finite, and none of them grows by staying on the page.
 *
 * Nothing here counts anything at the person. No unread badges, no "3 people are
 * waiting", no streak. Those exist to convert guilt into sessions, and Eraya's
 * members are rebuilding after a divorce or a death — the last thing that should
 * happen when they open this is being made to feel behind.
 */
export default async function HomePage() {
  const [session, membership, introductions, connections, completeness] =
    await Promise.all([
      loadAuthSession(),
      loadMembership(),
      getIntroductions(3),
      getConnections(),
      getProfileCompleteness(),
    ]);

  const interested = membership.entitlements.canSeeInteresters
    ? await getInterestsReceived()
    : [];

  const name = session.profile.firstName;
  const greeting = greetingFor(new Date().getHours());
  const openConnections = connections.filter((c) => !c.endedAt);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      {/* The one moment of warmth, then out of the way. */}
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-subtle">
        {home.eyebrow}
      </p>
      <h1 className="mt-4 font-serif text-[2.1rem] leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
        {greeting}
        {name ? `, ${name}` : ""}.
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-muted">{home.lede}</p>

      <div className="mt-12 grid gap-12">
        {/* --- Introductions ------------------------------------------- */}
        <section>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-xl tracking-[-0.01em] text-ink">
              {home.introductionsTitle}
            </h2>
            {introductions.length > 0 ? (
              <Link
                href={appRoutes.discovery}
                className="shrink-0 text-[0.95rem] text-ember-text underline underline-offset-4 hover:text-ember-strong"
              >
                {home.introductionsCta}
              </Link>
            ) : null}
          </div>

          {introductions.length > 0 ? (
            <>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-subtle">
                {home.introductionsLede}
              </p>
              <ul className="mt-6 grid gap-3">
                {introductions.map((member) => (
                  <li key={member.id}>
                    <Link
                      href={`${appRoutes.discovery}/${member.id}`}
                      className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong sm:p-5"
                    >
                      <MemberMonogram name={member.firstName} />
                      <span className="min-w-0">
                        <span className="block font-serif text-lg text-ink">
                          {member.firstName}
                        </span>
                        <MemberSummary member={member} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 max-w-xl leading-relaxed text-ink-muted">
              {home.introductionsEmpty}
            </p>
          )}
        </section>

        {/* --- Connections --------------------------------------------- */}
        <section>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-xl tracking-[-0.01em] text-ink">
              {home.connectionsTitle}
            </h2>
            {openConnections.length > 0 ? (
              <Link
                href={appRoutes.connections}
                className="shrink-0 text-[0.95rem] text-ember-text underline underline-offset-4 hover:text-ember-strong"
              >
                All
              </Link>
            ) : null}
          </div>

          {openConnections.length > 0 ? (
            <ul className="mt-6 grid gap-3">
              {openConnections.slice(0, 3).map((connection) => (
                <li key={connection.id}>
                  <Link
                    href={`${appRoutes.connections}/${connection.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong sm:p-5"
                  >
                    <MemberMonogram name={connection.member.firstName} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-lg text-ink">
                        {connection.member.firstName}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.95rem] text-ink-muted">
                        {connection.lastMessage
                          ? connection.lastMessage.body
                          : "No messages yet"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 max-w-xl leading-relaxed text-ink-muted">
              {home.connectionsEmpty}
            </p>
          )}
        </section>

        {/* --- Interest received (premium) ------------------------------ */}
        <section>
          <h2 className="font-serif text-xl tracking-[-0.01em] text-ink">
            {home.interestTitle}
          </h2>

          {membership.entitlements.canSeeInteresters ? (
            interested.length > 0 ? (
              <ul className="mt-6 grid gap-3">
                {interested.map((member) => (
                  <li key={member.id}>
                    <Link
                      href={`${appRoutes.discovery}/${member.id}`}
                      className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong sm:p-5"
                    >
                      <MemberMonogram name={member.firstName} />
                      <span className="min-w-0">
                        <span className="block font-serif text-lg text-ink">
                          {member.firstName}
                        </span>
                        <MemberSummary member={member} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 leading-relaxed text-ink-muted">
                {home.interestEmpty}
              </p>
            )
          ) : (
            /*
              Stated plainly, once, with no count. "3 people are interested"
              would be a number designed to nag; withholding the number entirely
              is the honest version of the same fact.
            */
            <div className="mt-4 rounded-2xl border border-line bg-sand/50 p-5">
              <p className="leading-relaxed text-ink-muted">
                {home.interestLocked}
              </p>
              <Button
                href={appRoutes.membership}
                variant="secondary"
                className="mt-4"
              >
                See what Premium includes
              </Button>
            </div>
          )}
        </section>

        {/* --- Profile progress ----------------------------------------- */}
        <section>
          <h2 className="font-serif text-xl tracking-[-0.01em] text-ink">
            {home.profileTitle}
          </h2>

          {completeness.missing.length === 0 ? (
            <p className="mt-3 leading-relaxed text-ink-muted">
              {home.profileComplete}
            </p>
          ) : (
            <p className="mt-3 leading-relaxed text-ink-muted">
              {completeness.missing.length === 1
                ? `One thing left: ${completeness.missing[0].toLowerCase()}.`
                : `A few things left: ${completeness.missing
                    .map((m) => m.toLowerCase())
                    .join(", ")}.`}
            </p>
          )}

          <Button
            href={appRoutes.account}
            variant="secondary"
            className="mt-4"
          >
            {home.profileCta}
          </Button>
        </section>
      </div>
    </div>
  );
}
