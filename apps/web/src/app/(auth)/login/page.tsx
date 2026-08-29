import type { Metadata } from "next";

import { LoginScreen } from "@/features/auth/screens/LoginScreen";
import { describeSignInProblem } from "@/features/auth/describeSignInProblem";
import { getEnabledSocialProviders } from "@/features/auth/settings";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to Eraya and continue your next chapter.",
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  // Only offer providers Supabase actually has configured.
  const [providers, params] = await Promise.all([
    getEnabledSocialProviders(),
    searchParams,
  ]);

  // /auth/callback and /auth/confirm both redirect here with ?error= when
  // something fails. Until now nothing read it, so a cancelled Google consent
  // returned someone to a blank screen with no explanation.
  const raw = params.error;
  const problem = describeSignInProblem(
    Array.isArray(raw) ? raw[0] : raw,
  );

  return <LoginScreen providers={providers} problem={problem} />;
}
