"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { recordPhoneStepComplete } from "@/features/auth/actions";
import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { OTPInput, OTP_LENGTH } from "@/features/auth/components/OTPInput";
import { SuccessMessage } from "@/features/auth/components/SuccessMessage";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";

import { useAuth } from "@/features/auth/AuthSessionProvider";
import { describePhoneError } from "@/features/auth/describeAuthError";
import { authRoutes, nextRoute } from "@/features/auth/flow";
import { appRoutes } from "@/features/app-shell/nav";
import { getCodeSentAt } from "@/features/auth/pending-phone";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import { AuthError, maskPhone, stageAtLeast } from "@/features/auth/types";
import { useT } from "@/features/i18n/LocaleProvider";
import { ensureWidget, widgetConfig } from "@/features/auth/msg91-widget";

/** Long enough to register as confirmation, short enough not to be a wait. */
const SUCCESS_PAUSE_MS = 1100;

/**
 * The wait this screen offers before it will ask again.
 *
 * It matches `otp_resend_cooldown_seconds` in `ops_config`, which is the one
 * that decides. Matching is a courtesy so the button appears at roughly the
 * moment it starts working; if the two ever drift, the server refuses with the
 * seconds it actually wants and the countdown is corrected from the answer.
 * Nothing here is a limit -- it is a label on somebody else's limit.
 */
const RESEND_AFTER_SECONDS = 60;

export function OTPScreen() {
  const t = useT();
  const router = useRouter();
  const { verifyCode, resendVerificationCode } = useAuth();
  const fieldId = useId();

  const [verified, setVerified] = useState(false);
  // Once verified this screen navigates itself, so the guard stands down.
  const { session, allowed } = useAuthGuard(authRoutes.otp, {
    enabled: !verified,
  });

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [skipping, setSkipping] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);
  /*
   * Null until the first tick, because the answer lives in `sessionStorage`
   * and the server render cannot see it. Rendering nothing for that instant is
   * better than rendering a countdown that is about to be replaced, or an
   * enabled button a moment before it is allowed.
   */
  const [resendIn, setResendIn] = useState<number | null>(null);

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  /*
   * The widget, ready before the button is.
   *
   * Asking for another code is a *send*, and MSG91 puts a captcha in front of
   * every send. Initialising inside the click is what made the very first send
   * fail on the phone screen -- the challenge appeared and the send was
   * attempted in the same breath -- and a resend has exactly the same shape.
   * Doing it on arrival means the challenge is on screen, and solved, while
   * the countdown is still running.
   *
   * It also covers arriving here directly: a reload on this screen leaves a
   * document where the script was never loaded and `initSendOTP` never ran.
   *
   * Silent on failure, as on the phone screen. There is nothing useful to say
   * about a button that has not been pressed, and the resend path reports it
   * properly when it is.
   */
  useEffect(() => {
    const config = widgetConfig();
    if (!config) return;
    void ensureWidget(config).catch(() => {});
  }, []);

  /*
   * Recomputed from the recorded moment every second rather than decremented.
   * A background tab has its timers throttled, and a counter that subtracts
   * one per tick would drift behind real time and keep the button hidden long
   * after the wait was over.
   */
  useEffect(() => {
    function tick() {
      const sentAt = getCodeSentAt();
      if (sentAt === null) {
        setResendIn(0);
        return;
      }
      const elapsed = Math.floor((Date.now() - sentAt) / 1000);
      setResendIn(Math.max(0, RESEND_AFTER_SECONDS - elapsed));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!allowed) return <AuthLoading />;

  async function submit(value: string) {
    if (pending || verified) return;

    if (value.length < OTP_LENGTH) {
      setError(t("auth.otp.incompleteError"));
      return;
    }

    setError(null);
    setPending(true);

    try {
      await verifyCode(value);

      // The code was checked by the server, which also wrote the verification.
      // This only advances the stored stage.
      const saved = await recordPhoneStepComplete();
      if (!saved.ok) {
        setError(saved.message);
        setPending(false);
        return;
      }

      setVerified(true);
      setPending(false);

      /*
       * Back where they came from.
       *
       * Somebody verifying during signup carries on through the questions.
       * Somebody who skipped months ago and came back from the account area to
       * do this has no questions left, and `nextRoute` would land them on the
       * end-of-onboarding screen -- a congratulation for finishing something
       * they finished long ago, and no way back to the page they were on.
       */
      const returningMember = stageAtLeast(session.stage, "onboardingCompleted");

      // Let the confirmation land before moving on.
      timeout.current = setTimeout(() => {
        router.push(
          returningMember
            ? appRoutes.verification
            : nextRoute({
                ...session,
                stage: "phoneStepDone",
                phoneVerified: true,
              }),
        );
      }, SUCCESS_PAUSE_MS);
    } catch (cause) {
      setError(describePhoneError(cause));
      setPending(false);
    }
  }

  /*
   * Asking again for the same number.
   *
   * The countdown is not the gate. It decides what this screen offers, and
   * `begin_phone_otp` decides what actually happens -- so a cleared storage
   * key, an edited clock or a reload reaching this early costs one refused
   * request and nothing else. When the server refuses with a wait of its own,
   * that number replaces ours: it is the one that is true.
   */
  async function resend() {
    if (resending || pending || verified) return;
    if (resendIn === null || resendIn > 0) return;

    setError(null);
    setResendNote(null);
    setResending(true);

    try {
      await resendVerificationCode();
      // Only now, and only because the server agreed to this one.
      setResendIn(RESEND_AFTER_SECONDS);
      setResendNote(t("auth.otp.resendSent"));
    } catch (cause) {
      setError(describePhoneError(cause));
      const wait =
        cause instanceof AuthError ? cause.retryAfterSeconds : undefined;
      if (typeof wait === "number" && wait > 0) setResendIn(wait);
    } finally {
      setResending(false);
    }
  }

  /**
   * Past the step, from the screen where somebody is most likely to be stuck.
   *
   * The same decision the phone screen offers, moved to where the code never
   * arrived -- which is the moment it is actually wanted. It reuses
   * `recordPhoneStepComplete`, so it writes the stage and nothing else: no
   * number, no timestamp, no status, and not a word to MSG91. A member who
   * skips is indistinguishable from one who was never asked.
   *
   * Two people leave by this door. Somebody in the middle of signing up moves
   * to the next question. Somebody who came from Account -> Verification goes
   * back where they came from, and nothing is written for them at all: their
   * stage passed this point long ago, and recording a decision they already
   * made would be a second source of truth about it.
   */
  async function skip() {
    if (pending || resending || skipping || verified) return;

    setError(null);

    if (!duringOnboarding) {
      router.push(appRoutes.verification);
      return;
    }

    setSkipping(true);

    const saved = await recordPhoneStepComplete();
    if (!saved.ok) {
      setError(saved.message);
      setSkipping(false);
      return;
    }

    router.push(nextRoute({ ...session, stage: "phoneStepDone" }));
  }

  const duringOnboarding = !stageAtLeast(session.stage, "onboardingCompleted");

  // Masked: they typed it one screen ago, and the last digits are enough to
  // show it went where they meant.
  const lede = session.phone
    ? t("auth.otp.lede", { phone: maskPhone(session.phone) })
    // No number to name, so the line is left off rather than said with a gap
    // in it. The guard makes this all but unreachable.
    : undefined;

  return (
    <AuthLayout backHref={authRoutes.phone} backLabel={t("auth.otp.changeCta")}>
      <AuthHeader title={t("auth.otp.title")} lede={lede} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(code);
        }}
        noValidate
        className="mt-9"
      >
        <OTPInput
          id={fieldId}
          label={t("auth.otp.label")}
          value={code}
          onChange={(value) => {
            setCode(value);
            if (error) setError(null);
          }}
          // Submitting on the sixth digit saves a tap for most people; the
          // button stays for anyone who prefers it.
          onComplete={(value) => void submit(value)}
          invalid={Boolean(error)}
          disabled={pending || verified}
        />

        {/*
          The way out of a code that never arrived.

          A countdown while the wait runs, then a button. Both are the same
          line in the same place, so the control does not appear from nowhere
          once it becomes usable -- somebody watching the seconds run down is
          watching the thing they are about to press.

          `aria-live="polite"` because the text changes underneath a reader
          without anything being focused; `off` while verified, when the screen
          is about to navigate and has nothing left to announce.
        */}
        {!verified && resendIn !== null ? (
          <p
            aria-live="polite"
            className="mt-4 text-sm leading-relaxed text-ink-muted"
          >
            {resendIn > 0 ? (
              t("auth.otp.resendIn", { seconds: resendIn })
            ) : (
              <button
                type="button"
                onClick={() => void resend()}
                disabled={resending || pending}
                className="rounded-full font-medium text-ember-text underline underline-offset-4 transition-colors hover:text-ember-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resending ? t("common.saving") : t("auth.otp.resend")}
              </button>
            )}
          </p>
        ) : null}

        {resendNote && !error ? (
          <SuccessMessage className="mt-4">{resendNote}</SuccessMessage>
        ) : null}

        {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

        {verified ? (
          <SuccessMessage className="mt-7">{t("auth.otp.success")}</SuccessMessage>
        ) : (
          <>
            {/*
              Held until there is a code to check.

              It used to be pressable with an empty field, which spends a
              network round trip to be told what the screen already knew, and
              answers somebody who has typed nothing with an error about what
              they typed. `incompleteError` still exists and still fires --
              nothing about the server's validation has moved -- but it is now
              for the paths that can reach it rather than the ordinary one.
            */}
            <PrimaryButton
              type="submit"
              loading={pending}
              loadingLabel={t("common.saving")}
              disabled={code.length !== OTP_LENGTH || skipping}
              className="mt-7"
            >
              {t("auth.otp.cta")}
            </PrimaryButton>

            {/*
              And the way past the question, on the screen where somebody is
              most likely to want it.

              The phone screen has always offered this, but the person who
              needs it is usually here: they gave a number, the code did not
              come, and until now the only ways out were backwards or a resend
              that may not help either. Below Continue rather than beside it --
              a real choice and the second of the two.
            */}
            <p className="mt-5 text-center">
              <button
                type="button"
                onClick={() => void skip()}
                disabled={pending || resending || skipping}
                className="rounded-full font-medium text-ember-text underline underline-offset-4 transition-colors hover:text-ember-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {skipping ? t("auth.phone.skipping") : t("auth.phone.skip")}
              </button>
            </p>
          </>
        )}
      </form>

    </AuthLayout>
  );
}
