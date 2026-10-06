import { permanentRedirect } from "next/navigation";

/**
 * `/beta` is where the Android download used to live.
 *
 * The page moved to `/download` when the app stopped being offered to testers
 * and started being offered to everybody, and this address goes on answering
 * because it is in Instagram bios, WhatsApp messages and browser histories that
 * nobody gets to go back and edit. The same reasoning as the `/downloads/*`
 * names in `android-app.ts`: an address the site has promised is kept.
 *
 * Permanent -- 308 -- rather than the 302 the `/downloads` route uses. That
 * route's target genuinely moves with every build, so a cached permanent
 * redirect there would pin somebody to an old one. This target does not move:
 * `/beta` means `/download` and will not come to mean anything else, so letting
 * a browser remember it is correct and saves the round trip.
 *
 * It is no longer in the sitemap or in `seo-probe`'s public list. A redirect is
 * not a page to be indexed, and `/download` is listed in its place.
 */
export default function BetaPage() {
  permanentRedirect("/download");
}
