import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/shared/ui/Container";
import { site } from "@/features/marketing/content";
import { getT } from "@/features/i18n/server";

export const metadata: Metadata = {
  title: "Delete your Eraya account",
  description:
    "How to delete your Eraya account and the data attached to it, from inside the app or by email.",
  alternates: { canonical: "/delete-account" },
};

/**
 * How to delete an Eraya account, on a page anybody can read.
 *
 * Google Play requires a publicly reachable URL explaining how to delete an
 * account and what happens to the data attached to it. The requirement is that
 * it works **without the app and without signing in**: somebody who has
 * uninstalled Eraya, or lost access to the mailbox they signed up with, still
 * has the right to be deleted and needs somewhere to start.
 *
 * ---------------------------------------------------------------------------
 * Every claim below was checked against the code, not written from memory
 * ---------------------------------------------------------------------------
 * The in-app steps use the labels the app actually shows, taken from
 * `packages/i18n` -- "Leaving Eraya", "Delete my account", "Yes, delete my
 * account" -- because a page that invents a button name sends somebody looking
 * for something that is not there.
 *
 * The deletion list is the set of tables that cascade from `profiles` and
 * `auth.users`; the retention list is the four columns that are nulled rather
 * than removed. Both were read off the live schema. No timeline is promised
 * anywhere on this page, because deletion here is synchronous -- there is no
 * queue, no soft-delete column and no scheduled purge in the database -- and a
 * "within 30 days" line would be an invention.
 *
 * English only, with the same notice the other legal pages carry. A machine
 * translation of a page about a legal right reads exactly like a reviewed one
 * to the person relying on it.
 *
 * Keep this consistent with `/privacy` and with
 * `features/account/DeleteAccount.tsx`. If the deletion behaviour changes, this
 * page is part of the change.
 */
export default async function DeleteAccountPage() {
  const t = await getT();

  return (
    <div className="border-b border-line bg-canvas py-20 sm:py-24 lg:py-28">
      <Container>
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-ember-text">
            {site.name}
          </p>
          <h1 className="mt-5 text-title text-ink">
            Delete your {site.name} account
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            {site.name} is the dating and companionship app for divorced,
            separated and widowed people in India, published by{" "}
            {site.organization}, with the Android package name{" "}
            <code className="rounded bg-sand/60 px-1.5 py-0.5 text-[0.95em]">
              app.eraya.mobile
            </code>
            . You can delete your account yourself at any time, or ask us to do
            it for you.
          </p>

          <p className="mt-6 rounded-xl border border-line bg-sand/60 px-5 py-4 text-sm leading-relaxed text-ink-muted">
            {t("common.legalEnglishOnly")}
          </p>

          <div className="mt-14 space-y-12">
            {/* ------------------------------------------------ in the app */}
            <section id="in-the-app" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                Deleting your account in the app
              </h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                This is the fastest way, and it takes effect immediately.
              </p>
              <ol className="mt-4 grid gap-2 pl-5">
                {[
                  "Open Eraya and sign in.",
                  "Tap You in the bottom navigation.",
                  "Tap Settings.",
                  "Scroll to Leaving Eraya.",
                  "Tap Delete my account.",
                  "Read the confirmation, then tap Yes, delete my account.",
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
                The same option is on the website: sign in, open{" "}
                <Link
                  href="/account/settings"
                  className="text-ember-text underline underline-offset-4"
                >
                  Account → Settings
                </Link>
                , and use <strong className="text-ink">Delete my account</strong>{" "}
                under <strong className="text-ink">Leaving Eraya</strong>.
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                There is no grace period and no undo. Once it completes, we
                cannot restore the account or anything in it.
              </p>
            </section>

            {/* --------------------------------------------- without the app */}
            <section id="by-email" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                If you cannot use the app
              </h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                If you have uninstalled Eraya, cannot sign in, or would simply
                rather we did it, write to{" "}
                <a
                  href={`mailto:${site.email}?subject=Account%20deletion%20request`}
                  className="text-ember-text underline underline-offset-4"
                >
                  {site.email}
                </a>{" "}
                with the subject{" "}
                <strong className="text-ink">Account deletion request</strong>.
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                Please include:
              </p>
              <ul className="mt-4 grid gap-2 pl-5">
                {[
                  "The email address you use to sign in to Eraya.",
                  "The first name on your profile.",
                  "Whether you signed in with email, Google or Facebook, if you remember.",
                ].map((item) => (
                  <li
                    key={item}
                    className="list-disc text-[1.02rem] leading-relaxed text-ink-muted"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              <h3 className="pt-6 text-base font-semibold text-ink">
                How we check it is really you
              </h3>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                Deletion cannot be undone, so we confirm ownership before we act.
                We reply to the address on the account and ask you to confirm
                from it — if you wrote to us from a different address, that reply
                goes to the account address, not to the one you wrote from. Where
                that is not possible, we may ask about details only the account
                holder would know, such as the city or languages on the profile.
              </p>
              <p className="mt-4 rounded-xl border border-line bg-sand/60 px-5 py-4 text-[1.02rem] leading-relaxed text-ink-muted">
                <strong className="text-ink">
                  We will never ask you for your password or a one-time code by
                  email,
                </strong>{" "}
                and Eraya has no password for ordinary accounts in the first
                place — signing in uses a code we email you, or Google or
                Facebook. Anyone asking you for a code is not us. Do not send
                photographs of identity documents unless we have asked and
                explained why.
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                We handle these by hand, so allow a few working days for a reply.
                We have not set a service-level promise we cannot yet keep; if
                you have not heard from us, write again.
              </p>
            </section>

            {/* --------------------------------------------- what is deleted */}
            <section id="what-is-deleted" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                What is deleted
              </h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                All of this is removed from Eraya&rsquo;s database and file
                storage at the moment the deletion runs:
              </p>
              <ul className="mt-4 grid gap-2 pl-5">
                {[
                  "Your sign-in itself — the account stops existing, and the email address is free to sign up again from scratch.",
                  "Your profile and everything you told us: name, date of birth, gender, who you are looking for, city, relationship status, religion if you answered, and the languages you chose.",
                  "Your photographs, both the image files and the records of them.",
                  "Every interest you sent and every interest you received.",
                  "Your connections.",
                  "Your messages — including the copies in the other person's conversation, so the conversation disappears for both of you.",
                  "Members you blocked, and reports you made.",
                  "Your phone number and its verification, if you added one.",
                  "Your payment history and membership records inside Eraya, including any unused Premium time.",
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
                Deleting your account does not by itself entitle you to a refund
                of unused Premium time. See the{" "}
                <Link
                  href="/terms"
                  className="text-ember-text underline underline-offset-4"
                >
                  Terms
                </Link>{" "}
                for how refunds work.
              </p>
            </section>

            {/* -------------------------------------------- what is retained */}
            <section id="what-is-kept" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                What is kept, and for how long
              </h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                A small amount survives deletion. Where it does, your account is
                unlinked from it first, so what remains is no longer connected to
                you:
              </p>
              <ul className="mt-4 grid gap-2 pl-5">
                {[
                  "Security and sign-in logs — records that a sign-in was attempted and whether it succeeded. The link to your account is removed, but a masked form of the email address (for example r*******7@gmail.com) stays in the entry. We keep these to investigate abuse and account takeover.",
                  "Product usage counts — records that a screen was opened or a step completed, with the link to your account removed. These are counts, not a history of you.",
                  "Moderation records, if a report was ever made about you or by you and a moderator acted on it. The link to the people involved is removed. We keep these so that somebody cannot escape a safety decision by deleting and signing up again.",
                ].map((item) => (
                  <li
                    key={item}
                    className="list-disc text-[1.02rem] leading-relaxed text-ink-muted"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              <h3 className="pt-6 text-base font-semibold text-ink">
                Held by other companies, not by us
              </h3>
              <ul className="mt-4 grid gap-2 pl-5">
                {[
                  "Payments. Our payment processor keeps its own record of any transaction, independently of Eraya, because it is required to. Deleting your Eraya account does not reach into it.",
                  "Email delivery. Our email provider keeps delivery logs for sign-in emails for a period set by them.",
                  "Backups. Database backups taken before your deletion may still contain your information until those backups age out and are overwritten.",
                ].map((item) => (
                  <li
                    key={item}
                    className="list-disc text-[1.02rem] leading-relaxed text-ink-muted"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              <h3 className="pt-6 text-base font-semibold text-ink">
                How long
              </h3>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                Deletion from Eraya is immediate — it happens while you wait,
                not on a schedule, and there is no period during which the
                account is merely hidden. The unlinked records described above
                have no fixed expiry; we keep them while the reason for keeping
                them applies, and we have not set a retention period we are not
                yet able to enforce. If anything here matters to you, write to{" "}
                <a
                  href={`mailto:${site.email}`}
                  className="text-ember-text underline underline-offset-4"
                >
                  {site.email}
                </a>{" "}
                and ask.
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                Where we are required by law — for tax, fraud prevention,
                security or resolving a dispute — to keep something, we keep it
                for as long as that requirement lasts, and no longer.
              </p>
            </section>

            {/* ----------------------------------------------- other rights */}
            <section id="other-rights" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">
                If you want something short of deletion
              </h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                You do not have to delete everything to change something. In the
                app you can edit your profile, add or remove individual
                photographs, change your language, and block or report another
                member. If you want a copy of your data, or want something
                corrected rather than removed, write to{" "}
                <a
                  href={`mailto:${site.email}`}
                  className="text-ember-text underline underline-offset-4"
                >
                  {site.email}
                </a>
                .
              </p>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-muted">
                The full account of what we collect and why is in the{" "}
                <Link
                  href="/privacy"
                  className="text-ember-text underline underline-offset-4"
                >
                  Privacy Policy
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
