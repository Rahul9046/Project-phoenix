import type { Metadata } from "next";

import { LoginScreen } from "@/components/auth/screens/LoginScreen";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to Eraya and continue your next chapter.",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <LoginScreen />;
}
