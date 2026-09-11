"use client";

import { useState } from "react";

import { MemberMonogram } from "@/features/members/MemberPresentation";

/**
 * A member's photograph, or their initial.
 *
 * The web collected photos and then drew a monogram for everybody, so somebody
 * who added a picture was seen with it by app users and without it here. This is
 * the one place that decides between the two, which is why every surface showing
 * another person uses it rather than choosing for itself.
 *
 * A client component for one reason: `onError`. A signed URL expires, a network
 * drops, an object is deleted between the page rendering and the image loading —
 * and the failure mode of an `<img>` that cannot load is a broken-image icon,
 * which on a profile reads as something wrong with the person rather than with
 * the request. Falling back to the monogram means the worst case is a member
 * shown as themselves-without-a-picture, which is a state the product already
 * has and already handles well.
 *
 * The monogram keeps its exact tile — same rounding, same size classes, same
 * ground — so a photo occupies the space an initial would and nothing reflows
 * when one appears.
 *
 * No `next/image`. These are signed URLs on a Supabase domain with an expiry in
 * the query string; routing them through the optimiser would mean either
 * allow-listing that host for remote loading or caching a URL that is meant to
 * stop working. A plain `<img>` with explicit dimensions is the honest choice
 * for an image that is deliberately short-lived.
 */

const dimensions = {
  md: "h-16 w-16",
  lg: "h-24 w-24 sm:h-28 sm:w-28",
} as const;

export function MemberAvatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  /** A short-lived signed URL, or null when the member has no photo. */
  photoUrl: string | null;
  size?: "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);

  if (!photoUrl || failed) return <MemberMonogram name={name} size={size} />;

  return (
    <span
      className={`inline-flex ${dimensions[size]} shrink-0 overflow-hidden rounded-2xl bg-ember-tint`}
    >
      {/*
        Empty alt, deliberately. The name is always rendered beside this, so a
        screen reader announcing "photo of Ananya" before the heading that says
        Ananya is repetition — and describing what a stranger looks like is not
        something the product can honestly do.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
