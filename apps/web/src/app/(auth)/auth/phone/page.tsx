import type { Metadata } from "next";

import { PhoneScreen } from "@/features/auth/screens/PhoneScreen";

export const metadata: Metadata = {
  title: "Verify your phone",
  robots: { index: false, follow: false },
};

export default function PhoneAuthPage() {
  return <PhoneScreen />;
}
