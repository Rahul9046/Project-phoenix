import type { Metadata } from "next";

import { SignupScreen } from "@/components/auth/screens/SignupScreen";

export const metadata: Metadata = {
  title: "Create an account",
  description: "A trusted space for people beginning a new chapter.",
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return <SignupScreen />;
}
