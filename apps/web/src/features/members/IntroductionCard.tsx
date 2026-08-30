"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { discovery } from "@/features/app-shell/content";
import { expressInterest, passOnMember } from "@/features/members/actions";
import {
  MemberLanguages,
  MemberMonogram,
  MemberSummary,
  TrustMarks,
} from "@/features/members/MemberPresentation";
import type { MemberCard } from "@/features/members/data";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";

/**
 * One introduction, and the two things you can do about it.
 *
 * The interaction is the argument. There is no swipe, no card stack, no heart:
 * both actions are full sentences on equally weighted buttons, because a
 * decision about a person should cost a moment's thought and look like it does.
 *
 * After acting, the card resolves in place with a quiet line rather than
 * snapping to the next person. A queue that advances the instant you choose is
 * what turns deciding into scrolling.
 */
export function IntroductionCard({ member }: { member: MemberCard }) {
  const router = useRouter();
  const [state, setState] = useState<
    "idle" | "working" | "interested" | "connected" | "passed"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function decide(interested: boolean) {
    if (state === "working") return;
    setState("working");
    setError(null);

    const result = interested
      ? await expressInterest(member.id)
      : await passOnMember(member.id);

    if (!result.ok) {
      setError(result.message);
      setState("idle");
      return;
    }

    if (!interested) {
      setState("passed");
      // Let the resolved state be seen before the card leaves.
      setTimeout(() => router.refresh(), 900);
      return;
    }

    setState(result.connected ? "connected" : "interested");
    setTimeout(() => router.refresh(), 1600);
  }

  if (state === "passed") {
    return (
      <div className="rounded-2xl border border-line bg-surface/60 p-6 text-center">
        <p className="text-[0.95rem] text-ink-subtle">
          {member.firstName} will not be shown again.
        </p>
      </div>
    );
  }

  if (state === "interested" || state === "connected") {
    const connected = state === "connected";
    return (
      <div className="rounded-2xl border border-ember/30 bg-surface p-6 sm:p-8">
        <p className="font-serif text-xl text-ink">
          {connected ? discovery.connected : discovery.interestSent}
        </p>
        <p className="mt-2.5 leading-relaxed text-ink-muted">
          {connected ? discovery.connectedBody : discovery.interestSentBody}
        </p>
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex items-start gap-5">
        <MemberMonogram name={member.firstName} size="lg" />
        <div className="min-w-0 pt-1">
          <h3 className="font-serif text-2xl tracking-[-0.01em] text-ink">
            {member.firstName}
          </h3>
          <div className="mt-1.5">
            <MemberSummary member={member} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-2.5">
        <MemberLanguages member={member} />
        <TrustMarks member={member} />
      </div>

      {error ? <ErrorMessage className="mt-5">{error}</ErrorMessage> : null}

      {/*
        Equal weight, deliberately. Making "interested" the loud primary and
        "not for me" a grey whisper is how an interface leans on someone.
      */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={state === "working"}
          className="inline-flex min-h-13 items-center justify-center rounded-full border border-ember bg-ember px-5 py-3.5 text-[0.95rem] font-medium text-canvas transition-colors hover:bg-ember-strong disabled:opacity-60"
        >
          {discovery.interested}
        </button>
        <button
          type="button"
          onClick={() => decide(false)}
          disabled={state === "working"}
          className="inline-flex min-h-13 items-center justify-center rounded-full border border-line-strong bg-surface px-5 py-3.5 text-[0.95rem] font-medium text-ink transition-colors hover:border-ink hover:bg-sand disabled:opacity-60"
        >
          {discovery.pass}
        </button>
      </div>
    </article>
  );
}
