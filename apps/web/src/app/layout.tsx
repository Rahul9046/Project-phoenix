import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";

import { site } from "@/features/marketing/content";
import "./globals.css";

/*
 * Eraya's only typeface.
 *
 * Four weights, named rather than left to the variable font's full range:
 * 400 for body, 500 for emphasis and small metadata, 600 for headings, buttons
 * and navigation, 700 for the two largest display sizes. Loading 200 and 800 as
 * well would be two more files for weights the scale never asks for.
 *
 * `display: "swap"` shows the fallback immediately and swaps when Manrope
 * arrives. The alternative hides text while the font loads, which on a slow
 * Indian mobile connection means a blank page -- and the metric overrides Next
 * generates for the fallback keep the swap from shifting the layout.
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "divorced",
    "separated",
    "widowed",
    "second chapter",
    "India",
    "trusted community",
  ],
  authors: [{ name: site.organization }],
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: site.url,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#fbf7f2",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      // Next.js 16 only manages smooth scrolling across navigations when asked.
      data-scroll-behavior="smooth"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-ember focus:px-4 focus:py-2 focus:text-canvas"
        >
          Skip to content
        </a>
        {/*
          No session provider here. Reading it costs a Supabase round-trip, and
          only the (auth) group needs it — the marketing pages are static and
          should stay that way.
        */}
        {children}
      </body>
    </html>
  );
}
