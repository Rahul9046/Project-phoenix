import type { Metadata } from "next";

import { EmailScreen } from "@/components/auth/screens/EmailScreen";

export const metadata: Metadata = {
  title: "Continue with email",
  robots: { index: false, follow: false },
};

export default function EmailAuthPage() {
  return <EmailScreen />;
}
