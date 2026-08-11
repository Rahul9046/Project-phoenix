import type { Metadata } from "next";

import { OTPScreen } from "@/components/auth/screens/OTPScreen";

export const metadata: Metadata = {
  title: "Enter your code",
  robots: { index: false, follow: false },
};

export default function OTPPage() {
  return <OTPScreen />;
}
