"use client";

import type { ReactNode } from "react";

import type { TFunction } from "@eraya/i18n";

import { relationshipOptions } from "@/features/auth/content";
import { useT } from "@/features/i18n/LocaleProvider";
import type { MemberCard } from "@/features/members/data";

/**
 * How a person is shown to another person.
 *
 * This file carries most of the difference between Eraya and a dating app, so
 * the choices are worth stating.
 *
 * A member's photograph is drawn by `MemberAvatar`, which falls back to the
 * monogram below. Every surface that shows another person goes through it, so
 * the choice between a face and an initial is made once.
 *
 * The monogram is not a placeholder. A silhouette would imply a photo is
 * missing, turning every profile without one into an incomplete-looking listing
 * — and photos are optional here on purpose, because some of Eraya's members
 * will not want a face on a screen for a long time. A person's initial on a warm
 * ground is a real piece of them rather than an absence.
 *
 * One photograph, not a gallery. A card shows one picture and `member_card`
 * carries one path for exactly that reason; `member_photos` exists for a screen
 * that wants all of them, and the web does not have one.
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
      className={`inline-flex ${dimensions} shrink-0 items-center justify-center rounded-2xl bg-ember-tint font-semibold text-ember-text`}
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
 * "Phone verified" was removed from here when the mock was still in place: any
 * six digits were accepted and no SMS was ever sent, so the strongest safety
 * signal on the card was also the only untrue one. In a product for people
 * deliberately meeting strangers, that is the claim that must never run ahead
 * of the system.
 *
 * It is back, and it is back on a narrower footing than the one it left on.
 * `member_card.phone_verified` now answers `phone_is_verified()` in the
 * database, which requires `phone_verified_via = 'msg91'` -- so the accounts the
 * stand-in marked, the demo members among them, do not qualify and cannot start
 * qualifying by somebody widening a query.
 *
 * Absence is silent on purpose. Verification is optional and a member may
 * decline it for perfectly good reasons, so there is no "phone unverified" and
 * no missing-mark placeholder: what is shown is what has been checked, and
 * nothing is inferred from the rest. Neither mark says "verified profile" or
 * "verified member" either. Eraya has checked a mailbox and sometimes a
 * handset. It has not checked a person.
 */
export function TrustMarks({ member }: { member: MemberCard }) {
  const t = useT();
  const marks: string[] = [];
  if (member.emailVerified) marks.push(t("common.emailVerified"));
  if (member.phoneVerified) marks.push(t("common.phoneVerified"));

  if (!marks.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {marks.map((mark) => (
        <TrustMark key={mark}>{mark}</TrustMark>
      ))}
    </div>
  );
}

export function chapterLabel(
  member: MemberCard,
  t: TFunction,
): string | null {
  const key = relationshipOptions.find(
    (o) => o.value === member.relationshipStatus,
  )?.labelKey;

  return key ? t(key) : null;
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
  const t = useT();

  const parts = [
    member.age ? `${member.age}` : null,
    placeLabel(member),
    chapterLabel(member, t),
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
