import type { Metadata } from "next";

import { SignupScreen } from "@/features/auth/screens/SignupScreen";
import { getEnabledSocialProviders } from "@/features/auth/settings";

export const metadata: Metadata = {
  title: "Create an account",
  description: "A trusted space for people beginning a new chapter.",
  robots: { index: false, follow: true },
};

export default async function SignupPage() {
  const providers = await getEnabledSocialProviders();

  return <SignupScreen providers={providers} />;
}
