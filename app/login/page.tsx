import type { Metadata } from "next";

import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Log in",
  description:
    "Signing in to Eraya opens when the app launches in your city.",
};

export default function LoginPage() {
  return (
    <PageShell eyebrow="Log in" title="Eraya isn't open yet.">
      <p>
        Accounts open when Eraya launches in your city. Until then there is
        nothing to sign in to — and we would rather say so plainly than show you
        an empty form.
      </p>
      <p>
        Leave your details and we will write to you the moment your city opens.
      </p>
      <div className="pt-3">
        <Button href="/#begin" size="lg">
          Begin your journey
        </Button>
      </div>
    </PageShell>
  );
}
