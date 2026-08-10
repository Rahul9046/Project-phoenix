import type { Metadata } from "next";

import { PageShell } from "@/components/layout/PageShell";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Eraya handles the details you share before launch.",
};

export default function PrivacyPage() {
  return (
    <PageShell eyebrow="Privacy" title="Privacy at Eraya.">
      <p>
        The full privacy policy is being written and will be published here
        before Eraya opens. In the meantime, this is what happens to anything
        you give us today.
      </p>
      <p>
        If you join the waitlist we store your name, email address and city. We
        use them for one thing: to tell you when Eraya opens near you. We do not
        sell them, and we do not share them with anyone else.
      </p>
      <p>
        You can ask us to delete your details at any time by writing to{" "}
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
