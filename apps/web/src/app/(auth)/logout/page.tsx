import type { Metadata } from "next";

import { LogoutScreen } from "@/features/auth/screens/LogoutScreen";

export const metadata: Metadata = {
  title: "Signing out",
  robots: { index: false, follow: false },
};

export default function LogoutPage() {
  return <LogoutScreen />;
}
