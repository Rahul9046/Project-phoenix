import type { Metadata } from "next";

import { EmailScreen } from "@/components/auth/screens/EmailScreen";
import { authRoutes } from "@/lib/auth/flow";

export const metadata: Metadata = {
  title: "Continue with email",
  robots: { index: false, follow: false },
};

export default async function EmailAuthPage({
  searchParams,
}: PageProps<"/auth/email">) {
  const { from } = await searchParams;

  // Back returns to whichever entry screen they came through.
  const backHref = from === "signup" ? authRoutes.signup : authRoutes.login;

  return <EmailScreen backHref={backHref} />;
}
