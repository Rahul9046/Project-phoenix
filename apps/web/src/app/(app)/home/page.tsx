import Link from "next/link";

import { greetingKey } from "@eraya/i18n";

import { getT } from "@/features/i18n/server";
import { appRoutes } from "@/features/app-shell/nav";
import { loadAuthSession } from "@/features/auth/load-session";
import { MemberSummary } from "@/features/members/MemberPresentation";
import { MemberRowLink } from "@/features/members/MemberRowLink";
import {
  getConnections,
  getInterestsReceivedCount,
  getIntroductions,
  getProfileCompleteness,
} from "@/features/members/data";
import { Button } from "@/shared/ui/Button";

export const metadata = { title: "My Eraya" };

/**
 * The signed-in home.
 *
 * Deliberately not a feed. A feed answers "what is there?" and rewards
 * scrolling; this answers "where am I?" and rewards leaving. Every section is
 * finite, and none of them grows by staying on the page.
 *
 * Nothing here is counted at the person. No unread badges, no streak, no "you
 * have not opened this in four days". Those exist to convert guilt into
 * sessions, and Eraya's members are rebuilding after a divorce or a death — the
 * last thing that should happen when they open this is being made to feel
 * behind.
 *
 * The one number on this page is how many people have expressed interest, and it
 * is here because withholding it was the worse option: somebody was choosing
 * them and Eraya knew and said nothing. It is shown only when it is at least
 * one, carries no name, and cannot be acted on — so it reads as news rather
 * than as a queue with work in it.
 */
export default async function HomePage() {
  const [session, introductions, connections, completeness, interestCount] =
    await Promise.all([
      loadAuthSession(),
      getIntroductions(3),
      getConnections(),
      getProfileCompleteness(),
      getInterestsReceivedCount(),
    ]);

  const name = session.profile.firstName;
  const t = await getT();
  const greeting = t(greetingKey(new Date().getHours()));
  const openConnections = connections.filter((c) => !c.endedAt);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      {/* The one moment of warmth, then out of the way. */}
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-subtle">
        {t("home.eyebrow")}
      </p>
      <h1 className="mt-4 text-heading text-ink">
        {greeting}
        {name ? `, ${name}` : ""}.
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-muted">{t("home.lede")}</p>

      <div className="mt-12 grid gap-12">
        {/* --- Interest received -----------------------------------------
            First on the page, because it is the only item here that is news.
            Everything below is available whenever they look; this one changed
            because somebody else acted, and it was three sections down.

            Tinted rather than outlined. `ember-tint` is the design system's
            accent surface -- the same tone the app's accent card uses -- so
            both clients highlight this the same way rather than each inventing
            an emphasis of its own.

            Deliberately nothing to click. There is no screen behind it because
            there is nothing to show: the identities are not withheld pending
            payment, they do not leave the database at all. Saying so on the
            card is the point -- somebody who has just read "someone is
            interested" goes looking for the way to find out who, and the
            answer has to be here rather than at the end of a hunt through the
            pricing page.

            Omitted entirely at zero. "Nobody is interested in you" is a true
            sentence that no product needs to say to somebody who has just
            rebuilt their life. -------------------------------------------- */}
        {interestCount > 0 ? (
          <section className="rounded-2xl bg-ember-tint p-6 sm:p-7">
            <h2 className="text-name text-ink">
              {interestCount === 1
                ? t("home.interestOne")
                : t("home.interestMany", { count: interestCount })}
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-ink-muted">
              {interestCount === 1
                ? t("home.interestPrivateOne")
                : t("home.interestPrivateMany")}
            </p>
          </section>
        ) : null}

        {/* --- Introductions ------------------------------------------- */}
        <section>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-name text-ink">
              {t("home.introductionsTitle")}
            </h2>
            {introductions.length > 0 ? (
              <Link
                href={appRoutes.discovery}
                className="shrink-0 text-[0.95rem] text-ember-text underline underline-offset-4 hover:text-ember-strong"
              >
                {t("home.introductionsCta")}
              </Link>
            ) : null}
          </div>

          {introductions.length > 0 ? (
            <>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-subtle">
                {t("home.introductionsLede")}
              </p>
              <ul className="mt-6 grid gap-3">
                {introductions.map((member) => (
                  <li key={member.id}>
                    <MemberRowLink
                      href={`${appRoutes.discovery}/${member.id}`}
                      name={member.firstName}
                      photoUrl={member.photoUrl}
                    >
                      <MemberSummary member={member} />
                    </MemberRowLink>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 max-w-xl leading-relaxed text-ink-muted">
              {t("home.introductionsEmpty")}
            </p>
          )}
        </section>

        {/* --- Connections --------------------------------------------- */}
        <section>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-name text-ink">
              {t("home.connectionsTitle")}
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
                  <MemberRowLink
                    href={`${appRoutes.connections}/${connection.id}`}
                    name={connection.member.firstName}
                    photoUrl={connection.member.photoUrl}
                  >
                    <span className="mt-0.5 block truncate text-[0.95rem] text-ink-muted">
                      {connection.lastMessage
                        ? connection.lastMessage.body
                        : "No messages yet"}
                    </span>
                  </MemberRowLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 max-w-xl leading-relaxed text-ink-muted">
              {t("home.connectionsEmpty")}
            </p>
          )}
        </section>

        {/* --- Profile progress ----------------------------------------- */}
        <section>
          <h2 className="text-name text-ink">
            {t("home.profileTitle")}
          </h2>

          {completeness.missing.length === 0 ? (
            <p className="mt-3 leading-relaxed text-ink-muted">
              {t("home.profileComplete")}
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
            {t("home.profileCta")}
          </Button>
        </section>
      </div>
    </div>
  );
}
