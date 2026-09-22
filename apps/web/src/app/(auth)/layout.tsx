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
        */}
        <div id={CAPTCHA_CONTAINER_ID} />
      </AuthSessionProvider>
    </main>
  );
}
