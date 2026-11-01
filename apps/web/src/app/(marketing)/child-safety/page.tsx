import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/shared/ui/Container";
import { site } from "@/features/marketing/content";
import { getT } from "@/features/i18n/server";

export const metadata: Metadata = {
  title: "Child safety standards",
  description:
    "Eraya's standards against child sexual abuse and exploitation, how to report a concern, and how reports are handled.",
  alternates: { canonical: "/child-safety" },
};

/**
 * Eraya's published standards against child sexual abuse and exploitation.
 *
 * Google Play requires every app to publish CSAE standards on a publicly
 * accessible, non-editable web page -- not a PDF, not a document anybody with
 * the link can edit, and not behind a sign-in. This is that page, and its URL
 * goes into the Child safety standards declaration in Play Console.
 *
 * ---------------------------------------------------------------------------
 * Why a separate page when /safety already covers minors
 * ---------------------------------------------------------------------------
 * `/safety` has an "Adults only" section and prohibits sexual material
 * involving minors, and that section is real -- it is not being replaced or
 * weakened. But it is four bullets inside a two-thousand-word community
 * document, and Google asks for standards a reviewer can find and read as a
 * standalone statement. A reviewer who has to scroll a general code of conduct
 * to decide whether an app has CSAE standards will decide it does not.
 *
 * ---------------------------------------------------------------------------
 * What this page deliberately does not say
 * ---------------------------------------------------------------------------
 * Eraya is operated by one person. There is no moderation team, no rota, no
 * response-time commitment, no automated CSAM detection, no hash matching, and
 * no established reporting pipeline to NCMEC or to any Indian authority. None
 * of those is claimed here, and none of them should be added to this page
 * until the thing itself exists.
 *
 * Every mechanism described below is one that is actually built: the `csae` and
 * `underage` report reasons in both clients, the emergency notice that appears
 * beside them, the immediate block that accompanies a report, the moderation
 * queue at `/admin/reports` with child safety reports sorted and marked at the
 * top of it, the suspend and restore actions behind it, and
 * `member_reports_archive`, which keeps a report when the account it is about
 * is deleted. The in-app steps use the labels the apps really show.
 *
 * Three sentences on this page were corrected on 2026-11-01 because they had
 * run ahead of the code, and the corrections are worth recording:
 *
 *   - the reporting steps told people to pick "Under 18" or "Threats or safety
 *     concern", because no category named CSAE existed. One does now;
 *   - "reading the profile and the messages connected to it" implied a
 *     reviewing capability in the product. There is none. Review uses
 *     administrative access, bounded by the procedure in docs/17-child-safety.md
 *     rather than by code, and the page now says so rather than implying a
 *     control that is not there;
 *   - permanent removal is real but is done by hand, not from a button in the
 *     admin area, and the page now says which.
 *
 * Retention after deletion is new on the page because the behaviour is new. It
 * belongs here as well as on /privacy and /delete-account: somebody reading
 * this page is deciding whether reporting is worth it, and "the report survives
 * even if they delete their account" is the part that answers them.
 *
 * If the moderation arrangements change, this page changes with them.
 */
export default async function ChildSafetyPage() {
  const t = await getT();

  return (
    <div className="border-b border-line bg-canvas py-20 sm:py-24 lg:py-28">
      <Container>
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-ember-text">
            {site.name}
          </p>
          <h1 className="mt-5 text-title text-ink">Child safety standards</h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            Eraya is an adults-only community for divorced, separated and
            widowed people in India, operated by {site.organization}. Nobody
            under 18 may use it. This page sets out our standards against child
            sexual abuse and exploitation, how to report a concern, and what
            happens when you do.
          </p>

          <p className="mt-6 rounded-xl border border-line bg-sand/60 px-5 py-4 text-sm leading-relaxed text-ink-muted">
            {t("common.legalEnglishOnly")}
          </p>

          <div className="mt-14 space-y-12">
            {/* ------------------------------------------------- the standard */}
            <section id="zero-tolerance" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                Zero tolerance
              </h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                Child sexual abuse and exploitation (CSAE) is prohibited on
                Eraya without exception, without warning, and without a second
                chance. There is no context in which it is tolerated, no
                threshold below which it is overlooked, and no appeal that
                reverses it.
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                An account found to be involved in any of it is removed. Where
                we are legally required to report it, we will.
              </p>
            </section>

            {/* --------------------------------------------------- prohibited */}
            <section id="prohibited" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                What is prohibited
              </h2>
              <ul className="mt-4 grid gap-2 pl-5">
                {[
                  "Child sexual abuse material (CSAM) of any kind — sharing it, requesting it, linking to it, or describing where to find it.",
                  "Sexualising a child in any way, including in text, images, drawings, animation or computer-generated or AI-generated material.",
                  "Grooming: building a relationship with a child, or with someone you believe to be a child, for sexual purposes.",
                  "Sexual extortion, including threatening to share intimate images of a child.",
                  "Trafficking a child, or advertising, soliciting or arranging the sexual exploitation of a child.",
                  "Using Eraya to contact a child for any sexual purpose, or to reach a child at all.",
                  "Creating an account if you are under 18, or creating or helping to maintain an account for someone who is.",
                  "Profile photographs featuring children.",
                ].map((item) => (
                  <li
                    key={item}
                    className="list-disc text-[1.02rem] leading-relaxed text-ink-muted"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                This applies to anything that passes through Eraya — profiles,
                photographs, messages and any link shared in them.
              </p>
            </section>

            {/* ---------------------------------------------------- adults only */}
            <section id="adults-only" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                Eraya is for adults only
              </h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                The minimum age is 18. Date of birth is asked during onboarding
                and an account cannot be completed with a date that puts the
                person under 18 — the check runs in the app and again in the
                database, so it cannot be skipped by a modified client.
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                Eraya does not verify age against an identity document. Somebody
                determined to lie about their date of birth can create an
                account, which is precisely why reporting matters and why we act
                on it.
              </p>
            </section>

            {/* ------------------------------------------------------ reporting */}
            <section id="reporting" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                How to report a child safety concern
              </h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                You can report any member from inside the app or the website,
                without leaving the conversation and without contacting us
                first.
              </p>
              <ol className="mt-4 grid gap-2 pl-5">
                {[
                  "Open the member's profile, or the conversation with them.",
                  "Tap Report.",
                  "Under “Why are you reporting…”, choose Child sexual abuse or exploitation. It is the first reason on the list. If your concern is that the member is a child, choose Under 18 instead.",
                  "Read the notice that appears. If a child is in immediate danger, contact the police before you finish here.",
                  "Add what you know under Tell us more. Anything you can say helps. Do not attach or forward suspected material — there is no way to attach a file, deliberately.",
                  "Submit with Report & block.  The button names the member you are reporting.",
                ].map((step) => (
                  <li
                    key={step}
                    className="list-decimal text-[1.02rem] leading-relaxed text-ink-muted"
                  >
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                Reporting also blocks the member immediately — you do not have
                to wait for us to act before they lose the ability to contact
                you. The confirmation names them and says{" "}
                <strong className="text-ink">
                  Report received
                </strong>
                , and that they are blocked.
              </p>
              <p className="mt-4 rounded-xl border border-line bg-sand/60 px-5 py-4 text-[1.02rem] leading-relaxed text-ink-muted">
                <strong className="text-ink">
                  You can also write to{" "}
                  <a
                    href={`mailto:${site.email}?subject=Child%20safety%20concern`}
                    className="text-ember-text underline underline-offset-4"
                  >
                    {site.email}
                  </a>
                </strong>{" "}
                with the subject{" "}
                <strong className="text-ink">Child safety concern</strong>. This
                is the designated contact for child safety and CSAE matters,
                including from people who do not have an Eraya account.
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                <strong className="text-ink">
                  If a child is in immediate danger, contact the police first.
                </strong>{" "}
                In India, dial 112 for emergencies or 1098 for Childline. Report
                to us as well, so that we can act on the account — but do not
                wait for us.
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                Please do not forward, re-share or attach suspected child sexual
                abuse material to a report, including to us. Describe it and
                tell us where it is. Possessing or transmitting it is a criminal
                offence even when the intention is to report it.
              </p>
            </section>

            {/* ----------------------------------------------------- what we do */}
            <section id="what-we-do" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                What happens to a report
              </h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                Eraya is a small operation and we would rather describe it
                plainly than imply more than exists.
              </p>
              <ul className="mt-4 grid gap-2 pl-5">
                {[
                  "The report is recorded with the reason you chose and anything you wrote, and the member is blocked from contacting you from that moment.",
                  "Reports are reviewed by hand, by the operator, through a moderation area that only an authorised account can open. There is no moderation team and no automated detection.",
                  "A child safety report is shown at the top of that area and marked as one, above every other report waiting, so it is the first thing read rather than the newest thing read.",
                  "Reviewing a report may mean reading the reported member's profile and, where the report concerns a conversation, the messages in it. Only the operator can do this, and our internal procedure limits it to the report in hand. It is not something other members can do, and it is not part of the app.",
                  "An account can be suspended immediately, and suspended accounts are shown to nobody.",
                  "Where the finding warrants it, the account is removed permanently. Removal is carried out by the operator using administrative access, not from a button in the app.",
                  "Where we are legally required to report what we find to an authority, we will, and we respond to lawful requests from authorities.",
                  "Reports are kept after an account is deleted — including when the member reported deletes their own account. Otherwise a report could be erased by the person it was about. What is kept is the report itself: the category, what was written, when, and the account identifiers. Photographs and messages are not kept with it.",
                  "We may keep other relevant information where there is a legitimate or legally required reason to, including after an account is removed.",
                ].map((item) => (
                  <li
                    key={item}
                    className="list-disc text-[1.02rem] leading-relaxed text-ink-muted"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                We do not publish a response time, because committing to one we
                are not staffed to meet would be worse than saying nothing. A
                child safety report is the highest priority thing in the queue.
              </p>
            </section>

            {/* --------------------------------------------------------- contact */}
            <section id="contact" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                Designated child safety contact
              </h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                Child safety, CSAE and CSAM matters, including enquiries from
                authorities, platforms and child protection organisations:
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                <a
                  href={`mailto:${site.email}?subject=Child%20safety`}
                  className="text-ember-text underline underline-offset-4"
                >
                  {site.email}
                </a>
                <br />
                {site.organization}, India
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                Please put{" "}
                <strong className="text-ink">Child safety</strong> in the
                subject line so it is not missed.
              </p>
            </section>

            {/* ------------------------------------------------------- elsewhere */}
            <section id="related" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                Related
              </h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                The full code of conduct, including the rules on intimate images
                and harassment, is in the{" "}
                <Link
                  href="/safety"
                  className="text-ember-text underline underline-offset-4"
                >
                  Community and Safety Guidelines
                </Link>
                . What we collect and why is in the{" "}
                <Link
                  href="/privacy"
                  className="text-ember-text underline underline-offset-4"
                >
                  Privacy Policy
                </Link>
                , and the rules of use are in the{" "}
                <Link
                  href="/terms"
                  className="text-ember-text underline underline-offset-4"
                >
                  Terms
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}
