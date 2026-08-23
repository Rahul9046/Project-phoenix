import type { Metadata } from "next";

import { CityScreen } from "@/features/auth/screens/CityScreen";
import { getActiveCities } from "@/shared/data/reference";

export const metadata: Metadata = {
  title: "Your city",
  robots: { index: false, follow: false },
};

export default async function CityPage() {
  // Read on the server so the list is current on every visit — adding a city
  // in the database changes signup without a deploy.
  const cities = await getActiveCities();

  return <CityScreen cities={cities} />;
}
