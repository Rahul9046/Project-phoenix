import { AuthSessionProvider } from "@/features/auth/AuthSessionProvider";
import { loadAuthSession } from "@/features/auth/load-session";
import { CAPTCHA_CONTAINER_ID } from "@/features/auth/msg91-widget";

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
          Where MSG91 draws its captcha, for the whole of the flow.

          It lives here rather than on a screen because of what MSG91 does and
          when. The challenge is rendered once, during `initSendOTP`, into
          whatever element `captchaRenderId` names at that moment -- and it is
          never rendered again, because the widget initialises once per
          document. A screen that owns the element therefore takes the
          challenge down with it when it unmounts, and the next screen gets an
          empty box that nothing will ever fill.

          That is exactly what broke resend. The phone screen drew the
          challenge, the code screen destroyed it by being navigated to, and
          asking for another code -- a send, which needs a captcha -- failed
          with nowhere to draw. Giving the code screen its own container did
          not help: a second empty box is still empty.

          This layout does not remount between `/auth/phone` and `/auth/otp`,
          so the element MSG91 drew into survives the journey, along with the
          challenge already satisfied in it. One element, one initialisation,
          one solved captcha, both screens.

          Rendered on every screen in the group, not only the two that verify.
          An empty div costs no height, and the alternative -- mounting it
          conditionally -- would reintroduce the unmount that caused this.

          It is `sticky` rather than simply last in the column, and that is the
          whole of the second problem. `AuthLayout` opens with `min-h-dvh` and
          fills the viewport deliberately, so its next sibling begins one
          screen below the fold -- which is where this sat when the captcha
          "disappeared". It was drawn, correctly, out of sight.

          Sticking it to the bottom of the viewport is the way to have one
          element serve two screens. It cannot be moved into each screen's
          column as they are shown: relocating the node would reparent the
          iframe MSG91 drew into, browsers reload a reparented iframe, and the
          solved challenge would be destroyed -- which is the thing this whole
          arrangement exists to prevent. So the element stays still and the
          viewport comes to it.

          Empty, it is a zero-height box and nothing is painted: no margin, no
          background, no shadow, because every one of those is conditioned on
          it having content. A person on a screen that never asks for a captcha
          sees exactly what they saw before.
        */}
        <div className="pointer-events-none sticky bottom-0 z-40 mx-auto flex w-full max-w-[27rem] justify-center px-5 sm:px-8">
          <div
            id={CAPTCHA_CONTAINER_ID}
            className="pointer-events-auto [&:not(:empty)]:mb-5 [&:not(:empty)]:rounded-2xl [&:not(:empty)]:bg-canvas [&:not(:empty)]:p-3 [&:not(:empty)]:shadow-lg"
          />
        </div>
      </AuthSessionProvider>
    </main>
  );
}
