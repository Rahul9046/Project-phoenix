import { AuthSessionProvider } from "@/features/auth/AuthSessionProvider";
import { loadAuthSession } from "@/features/auth/load-session";
import {
  CAPTCHA_CONTAINER_ID,
  CAPTCHA_HOME_ID,
} from "@/features/auth/msg91-widget";

/**
 * Nothing in this group is for a search engine, and the group says so once.
 *
 * All fourteen screens under here already declared `robots: { index: false }`
 * for themselves, and every one of them was correct. What they could not do is
 * cover the fifteenth, which nobody has written yet -- and that is the one that
 * matters, because the site-wide default is `index, follow` on production now
 * that `NEXT_PUBLIC_ALLOW_INDEXING` is set. A new onboarding step that forgets
 * the line does not fail; it quietly becomes indexable.
 *
 * A layout default inverts that. Forgetting now means inheriting `noindex`,
 * which is the safe direction for the mistake to run, and a page that wants
 * something different still overrides it: `/login` and `/signup` deliberately
 * say `follow: true`, because they are linked from the public site and the link
 * equity should flow on even though the page itself is not a destination. Page
 * metadata wins over layout metadata, so those two keep working unchanged.
 *
 * The per-page declarations stay. They are not redundant with this -- they are
 * what makes each screen readable on its own, and removing fourteen correct
 * lines to rely on one inherited one is a worse trade than keeping both.
 *
 * Proved rather than reasoned, because every page in this group already carries
 * its own directive and so none of them can demonstrate what is inherited. A
 * throwaway page was added under this layout declaring no `robots` at all, the
 * app was built with `NEXT_PUBLIC_ALLOW_INDEXING=true` so the site-wide default
 * was the permissive one, and it served exactly one tag: `noindex, nofollow`.
 * `/pricing` in the same build served `index, follow`. Then the page was
 * deleted. `npm run seo:probe` covers the standing routes; this was the one
 * claim it structurally cannot reach.
 */
export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Auth and onboarding run without the marketing header and footer. On a phone
 * the screen should feel like an app; on a desktop it becomes a centred column
 * with room around it rather than a stretched mobile view.
 *
 * The session is read here, on the server, and handed down. Screens receive
 * who they are rendering for as data rather than discovering it after mount,
 * which is what removes the loading flash and makes the stage trustworthy.
 */
export default async function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await loadAuthSession();

  return (
    <main id="main" className="flex min-h-dvh flex-1 flex-col bg-canvas">
      <AuthSessionProvider serverSession={session}>
        {children}

        {/*
          Where MSG91's captcha lives when no screen is showing it.

          The element cannot be unmounted between screens and cannot be
          re-created. MSG91 renders the challenge once, during `initSendOTP`,
          into whatever element `captchaRenderId` names at that moment, and
          never again -- so a screen that owns the element takes the challenge
          down with it when it unmounts, and the next screen gets an empty box
          that nothing will ever fill. That is what broke resend, and giving the
          code screen a second container did not help: a second empty box is
          still empty.

          This layout does not remount between `/auth/phone` and `/auth/otp`,
          so an element it owns survives the journey. What it must not do is be
          *seen* on every screen in the group -- a challenge has no business on
          the name, birthday or photograph screens, and it used to be stuck to
          the bottom of the viewport on all of them.

          So this is a parked position rather than a display position. Off to
          the side, out of the reading order, rendered and idle. `CaptchaSlot`
          borrows the container while a screen wants it and returns it here on
          the way out, which is what confines the challenge to the two screens
          that verify a number while keeping one element and one
          initialisation.

          Off-screen rather than `display: none`, and that distinction is the
          whole reason this works: a hidden subtree has no layout, and an
          hCaptcha asked to render into one comes back wrong or not at all. A
          negative offset leaves it laid out and perfectly renderable, and
          leaves nothing for a person to see or reach -- a negative `left` does
          not extend the scrollable area.
        */}
        <div
          id={CAPTCHA_HOME_ID}
          aria-hidden="true"
          className="pointer-events-none absolute left-[-9999px] top-0"
        >
          <div id={CAPTCHA_CONTAINER_ID} />
        </div>
      </AuthSessionProvider>
    </main>
  );
}
