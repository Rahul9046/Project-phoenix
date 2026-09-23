"use client";

import { useEffect, useState } from "react";

import { captchaState, subscribeCaptcha } from "@/features/auth/msg91-widget";

/**
 * Whether a screen should be holding its send button back.
 *
 * Two sources, because neither alone is trustworthy. MSG91 calls back when the
 * challenge is satisfied or lost, which is immediate and is what makes the
 * button follow a solved captcha without a perceptible pause; and the state is
 * re-read on a timer, because that callback reaches us through a config key
 * their own widget spells inconsistently, and because an hCaptcha token can
 * expire on its own without anybody being told. The poll is the floor, the
 * callback is the polish.
 *
 * Both only ever *read* `isCaptchaVerified` -- MSG91's own view of the access
 * token it holds. Nothing here inspects a checkbox or an iframe, and nothing
 * here can make the answer be yes.
 *
 * What it returns is `blocking`, and the default is not to block. A widget
 * with captcha validation switched off, a script that never loaded, a browser
 * where the challenge failed to render: every one of those reports `absent`
 * and leaves the button alone. Disabling Continue forever because a captcha
 * could not be found would be a worse fault than the one this prevents, and
 * the server refuses an unsatisfied send regardless -- this is a courtesy to
 * the person, never the thing that stops an abuser.
 */
export function useCaptchaGate(): { blocking: boolean } {
  const [state, setState] = useState<ReturnType<typeof captchaState>>("absent");

  useEffect(() => {
    const read = () => setState(captchaState());

    read();
    const unsubscribe = subscribeCaptcha(read);
    /*
     * Often enough that pressing Continue straight after solving feels
     * immediate, rarely enough to be free. The callback usually beats it.
     */
    const timer = window.setInterval(read, 600);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  return { blocking: state === "unsolved" };
}
