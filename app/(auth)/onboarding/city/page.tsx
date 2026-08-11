import type { Metadata } from "next";

import { CityScreen } from "@/components/auth/screens/CityScreen";

export const metadata: Metadata = {
  title: "Your city",
  robots: { index: false, follow: false },
};

export default function CityPage() {
  return <CityScreen />;
}
