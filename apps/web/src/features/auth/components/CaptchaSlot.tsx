"use client";

import { useEffect, useRef } from "react";

import { CAPTCHA_CONTAINER_ID, CAPTCHA_HOME_ID } from "@/features/auth/msg91-widget";

/**
 * Where a screen wants MSG91's challenge to appear.
 *
 * The constraint this works around is MSG91's, not ours. The challenge is
 * rendered once, during `initSendOTP`, into whatever element `captchaRenderId`
 * names at that moment, and it is never rendered again -- the widget
 * initialises once per document. So the element must outlive every screen, and
 * for a long time it did that by sitting in the `(auth)` layout stuck to the
 * bottom of the viewport: visible on screens that had no use for it, and
 * floating rather than sitting in the form it belongs to.
 *
 * This borrows it instead. On mount the container is moved into this slot; on
 * unmount it goes back to its parked position off-screen. The element is never
 * destroyed and the widget is never re-initialised, so the thing MSG91 will
 * only do once is still only done once.
 *
 * Moving it is safe, and that was established by experiment rather than
 * assumed -- three deploys were spent on guesses about this element. A
 * standalone page was served, the real widget initialised into one container,
 * and the container reparented: the challenge survived, re-rendered, and
 * remained interactive. What a move does cost is an iframe reload, because
 * browsers reload a reparented iframe, which is why the borrowing happens when
 * a screen opens rather than at some point during it.
 *
 * `aria-hidden` is deliberately not set here. While the slot holds it the
 * challenge is a real control a person has to operate, and hiding it from
 * assistive technology would make the disabled Continue button inexplicable to
 * anybody who cannot see the box above it.
 */
export function CaptchaSlot({ className = "" }: { className?: string }) {
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = document.getElementById(CAPTCHA_CONTAINER_ID);
    const here = slot.current;
    if (!container || !here) return;

    here.appendChild(container);

    return () => {
      /*
       * Back to the parked position, not left here to be destroyed with this
       * screen. A container removed from the document takes the only rendered
       * challenge with it, and nothing would ever draw another.
       */
      const home = document.getElementById(CAPTCHA_HOME_ID);
      if (home) home.appendChild(container);
    };
  }, []);

  return <div ref={slot} className={className} />;
}
