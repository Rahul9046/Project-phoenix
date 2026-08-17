import type { Metadata } from "next";

import { LoginScreen } from "@/components/auth/screens/LoginScreen";
import { getEnabledSocialProviders } from "@/lib/data/auth-settings";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to Eraya and continue your next chapter.",
  robots: { index: false, follow: true },
};

export default async function LoginPage() {
  // Only offer providers Supabase actually has configured.
  const providers = await getEnabledSocialProviders();

  return <LoginScreen providers={providers} />;
}
