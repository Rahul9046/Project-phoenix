import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";

import { createTranslator, FONT_STACKS } from "@eraya/i18n";

import { LocaleProvider } from "@/features/i18n/LocaleProvider";
import { getLocale } from "@/features/i18n/server";

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

/**
 * Whether search engines may keep this deployment.
 *
 * Read as a whole expression rather than through a computed lookup: Next
 * inlines `NEXT_PUBLIC_*` by matching the literal text at build time, so a
 * dynamic key is undefined in a production build while working in development.
 * Only the exact string "true" counts, so an empty or absent value is noindex.
 */
const indexable = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

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
  /*
   * Indexing is opt-in, and off unless a deployment says otherwise.
   *
   * The product is deployed before it opens, so for a while there is a site
   * inviting people to create an account while eraya.app still says Eraya is
   * coming soon. Two live pages contradicting each other is worse than either,
   * and the one a search engine keeps is not the one we would choose.
   *
   * Defaulting to noindex means a new deployment -- a preview, a branch build,
   * somebody's fork -- is never accidentally the indexed copy. Launch day sets
   * NEXT_PUBLIC_ALLOW_INDEXING=true on the production deployment and nothing
   * else changes. Individual pages that must never be indexed, the auth and
   * onboarding screens, still say so themselves and do not rely on this.
   */
  robots: indexable
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fbf7f2",
  colorScheme: "light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  /*
   * Decided here, before a single word renders, so no member ever sees a flash
   * of English before their own language arrives. Everything below -- the `lang`
   * attribute, the font stack, the skip link, every server component in the
   * tree -- is rendered already knowing the answer.
   */
  const locale = await getLocale();
  const t = createTranslator(locale);

  return (
    <html
      /*
       * `en-IN` for English because Eraya is an Indian product and the region
       * affects how a browser reads dates and numbers aloud. The other five
       * carry no region: there is one Hindi interface, not an Indian and a
       * non-Indian one, and inventing `hi-IN` would imply a choice that is not
       * offered.
       */
      lang={locale === "en" ? "en-IN" : locale}
      // Next.js 16 only manages smooth scrolling across navigations when asked.
      data-scroll-behavior="smooth"
      className={`${manrope.variable} h-full antialiased`}
      /*
       * Manrope covers Latin and nothing else, so a Devanagari, Bengali, Telugu
       * or Tamil page set in it alone would render as empty boxes. The stack for
       * the active script is handed to the stylesheet as a variable, keeping
       * Manrope first -- browsers fall back glyph by glyph, so "Eraya" and an
       * email address inside a Hindi sentence stay in Eraya's own typeface while
       * only the Indic glyphs come from the system. Nothing is bought or
       * bundled; every platform already ships these.
       */
      style={{ "--font-script": FONT_STACKS[locale] } as React.CSSProperties}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-ember focus:px-4 focus:py-2 focus:text-canvas"
        >
          {t("shell.skipToContent")}
        </a>
        {/*
          Still no session provider here: reading a session costs a Supabase
          round-trip and only the (auth) group needs it.

          `getLocale()` above does look for a user, and deliberately only when
          there is an auth cookie to look at — a visitor who has never signed in
          gets their language from a cookie or `Accept-Language` and pays for
          nothing. A signed-in member pays one lookup on a page that was already
          going to read their session several times over.

          The provider itself is only given the answer. It makes no request of
          its own, which is what keeps the server markup and the first client
          render identical.
        */}
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
