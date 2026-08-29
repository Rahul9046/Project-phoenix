import type { Metadata } from "next";

import { CityScreen } from "@/features/auth/screens/CityScreen";

export const metadata: Metadata = {
  title: "Your city",
  robots: { index: false, follow: false },
};

/**
 * No city list is fetched here any more.
 *
 * There are 493 of them, and shipping the set to render a picker would be a
 * large payload to answer a question that needs at most eight rows. The screen
 * searches as the person types instead, so the route has nothing to prepare.
 */
export default function CityPage() {
  return <CityScreen />;
}
