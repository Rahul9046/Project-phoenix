import type { Metadata } from "next";

import { PageShell } from "@/features/marketing/layout/PageShell";
import { site } from "@/features/marketing/content";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Eraya stores about you, and what other members can see.",
};

/**
 * What Eraya actually holds.
 *
 * This page described a waitlist and nothing else — name, email, city, "to tell
 * you when Eraya opens near you". That was accurate when the only thing anyone
 * could do was leave an address. It stopped being accurate the moment accounts,
 * profiles and messages existed, and a privacy page that omits the sensitive
 * half of what is collected is worse than no page.
 *
 * It is still not a legal privacy policy. It says so, rather than implying the
 * document exists. India's DPDP Act applies and a real policy is a launch
 * blocker, recorded in docs/07-open-questions.md.
 */
export default function PrivacyPage() {
  return (
    <PageShell eyebrow="Privacy" title="Privacy at Eraya.">
      <p>
        The formal privacy policy is being written and will be published here
        before Eraya opens to the public. This page is not that document — it is
        a plain account of what Eraya stores today and who can see it.
      </p>

      <h2>What we store</h2>
      <p>
        When you create an account we store your email address, and the answers
        you give during onboarding: your first name, date of birth, gender, city,
        the chapter you are in, and the languages you speak. If you use Google or
        Facebook to sign in, we receive your name and email address from them.
      </p>
      <p>
        We record the phone number step, but we do not currently verify it
        against a mobile network and we do not store the number itself.
      </p>
      <p>
        Once you are using Eraya we store who you have expressed interest in, who
        you have connected with, and the messages you exchange with them.
      </p>

      <h2>What other members see</h2>
      <p>
        Another member sees your first name, your age, your city, the chapter you
        are in, and the languages you speak. They never see your email address,
        your phone number, or your date of birth — only the age calculated from
        it.
      </p>
      <p>
        There is no directory and no search. You are introduced to a few people
        at a time and appear in theirs; nobody can look you up. If someone passes
        on your profile, you are never told, and nobody can message you unless
        you have both expressed interest.
      </p>

      <h2>Deleting everything</h2>
      <p>
        You can delete your account from Settings at any time. It removes your
        profile, your answers, your connections and your messages permanently.
        There is no grace period and we cannot restore it afterwards.
      </p>
      <p>
        If you would rather we did it, or you have any question about your data,
        write to{" "}
        <a
          href={`mailto:${site.email}`}
          className="text-ember-text underline underline-offset-4"
        >
          {site.email}
        </a>
        .
      </p>
    </PageShell>
  );
}
