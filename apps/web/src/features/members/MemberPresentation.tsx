import type { ReactNode } from "react";

import { relationshipOptions } from "@/features/auth/content";
import type { MemberCard } from "@/features/members/data";

/**
 * How a person is shown to another person.
 *
 * This file carries most of the difference between Eraya and a dating app, so
 * the choices are worth stating.
 *
 * There is no photograph. Not because photographs are wrong, but because Eraya
 * has no photo upload yet, and a placeholder silhouette would imply one is
 * missing — turning every profile into an incomplete-looking listing. A person's
 * initial on a warm ground is a real piece of them rather than an absence.
 *
 * There is no heart, no swipe, no card stack. The actions are sentences, sized
 * equally: "I'd like to know more" does not shout louder than "Not for me",
 * because a considered decision needs both options to look like decisions.
 *
 * Name and age sit together in prose rather than as a headline and a number
 * beside it. "Ananya, 42" reads as a person; "ANANYA" over "42" reads as a
 * listing with attributes.
 */

/** A member's initial on a warm tile. Same treatment as the account menu. */
export function MemberMonogram({
  name,
  size = "md",
}: {
  name: string;
  size?: "md" | "lg";
}) {
  const initial = (name.trim()[0] ?? "E").toUpperCase();

  const dimensions =
    size === "lg"
      ? "h-24 w-24 text-3xl sm:h-28 sm:w-28 sm:text-4xl"
      : "h-16 w-16 text-xl";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex ${dimensions} shrink-0 items-center justify-center rounded-2xl bg-ember-tint font-serif text-ember-text`}
    >
      {initial}
    </span>
  );
}

/**
 * A verification Eraya can actually stand behind.
 *
 * Only states the system genuinely holds are ever rendered. There is no
 * "identity verified" here because identity verification does not exist, and a
 * tick that means nothing is worse than no tick — it is the one element of a
 * profile people are asked to trust.
 */
export function TrustMark({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.85rem] text-ink-muted">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-3.5 w-3.5 text-ember-text"
      >
        <path d="M3.5 8.5l3 3 6-6.5" />
      </svg>
      {children}
    </span>
  );
}

/**
 * What Eraya can actually vouch for about a stranger.
 *
 * "Phone verified" used to appear here. It was the strongest safety signal on
 * the card and it was not true: phone verification is mocked, any six digits are
 * accepted, and no SMS is ever sent. Telling one member that another's number
 * has been checked -- in a product for people who are deliberately meeting
 * strangers -- is the one claim that must never run ahead of the system.
 *
 * `phoneVerified` stays on the card and in the database. When an SMS provider is
 * connected (see features/auth/phone-verification.ts) the mark comes back by
 * restoring the line below, and nothing else needs to change.
 */
export function TrustMarks({ member }: { member: MemberCard }) {
  const marks: string[] = [];
  if (member.emailVerified) marks.push("Email verified");

  if (!marks.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {marks.map((mark) => (
        <TrustMark key={mark}>{mark}</TrustMark>
      ))}
    </div>
  );
}

export function chapterLabel(member: MemberCard): string | null {
  return (
    relationshipOptions.find((o) => o.value === member.relationshipStatus)
      ?.label ?? null
  );
}

export function placeLabel(member: MemberCard): string | null {
  if (!member.city) return null;
  return member.state ? `${member.city}, ${member.state}` : member.city;
}

/**
 * The line that introduces someone.
 *
 * Deliberately a sentence and not a spec sheet. Age, place and chapter separated
 * by middots reads as a description; the same three in a bordered table reads as
 * a product listing.
 */
export function MemberSummary({ member }: { member: MemberCard }) {
  const parts = [
    member.age ? `${member.age}` : null,
    placeLabel(member),
    chapterLabel(member),
  ].filter(Boolean);

  return (
    <p className="text-[0.95rem] leading-relaxed text-ink-muted">
      {parts.join(" · ")}
    </p>
  );
}

export function MemberLanguages({ member }: { member: MemberCard }) {
  if (!member.languages.length) return null;

  return (
    <p className="text-[0.95rem] leading-relaxed text-ink-muted">
      Speaks {member.languages.join(", ")}
    </p>
  );
}
