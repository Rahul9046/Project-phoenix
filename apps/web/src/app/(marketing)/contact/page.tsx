import type { Metadata } from "next";

import { PageShell } from "@/features/marketing/layout/PageShell";
import { site } from "@/features/marketing/content";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with the team building ${site.name}.`,
};

export default function ContactPage() {
  return (
    <PageShell eyebrow="Contact" title="Talk to us.">
      <p>
        Eraya is being built by a small team at {site.organization}. If you have
        a question, a concern, or something you think we should know about
        building this well — we would like to hear it.
      </p>
      <p>
        Email{" "}
        <a
          href={`mailto:${site.email}`}
          className="text-ember-text underline underline-offset-4"
        >
          {site.email}
        </a>{" "}
        and a person will read it.
      </p>
    </PageShell>
  );
}
