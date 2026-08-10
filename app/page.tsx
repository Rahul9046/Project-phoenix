import { Begin } from "@/components/sections/Begin";
import { BuiltDifferently } from "@/components/sections/BuiltDifferently";
import { Cities } from "@/components/sections/Cities";
import { FinalCta } from "@/components/sections/FinalCta";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Trust } from "@/components/sections/Trust";
import { WhyEraya } from "@/components/sections/WhyEraya";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Trust />
      <WhyEraya />
      <HowItWorks />
      <BuiltDifferently />
      <Cities />
      <Begin />
      <FinalCta />
    </>
  );
}
