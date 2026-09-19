"use client";

import { useState } from "react";

/**
 * The signed-in member, as themselves: their own photograph, or their initial.
 *
 * The initial is not a placeholder. Photos are optional here on purpose --
 * some of Eraya's members will not want a face on a screen for a long time --
 * so a member without one gets a considered mark rather than a silhouette
 * implying something is missing.
 *
 * A member who did add a photo should meet it in the header, which is the one
 * place they see themselves on every page; the app has always done this on the
 * You tab, and a laptop showing an initial for somebody the phone shows as a
 * face reads as the upload having failed.
 *
 * `onError` is why this is a client component. A signed URL expires, a network
 * drops, an object is deleted between the page rendering and the image loading
 * -- and the failure mode of an `<img>` that cannot load is a broken-image
 * icon, which here reads as something wrong with the account. Falling back to
 * the initial means the worst case is a state the product already handles.
 *
 * No `next/image`, for the same reason `MemberAvatar` avoids it: this is a
 * signed URL on a Supabase domain with an expiry in the query string, and
 * routing it through the optimiser would mean caching a URL that is meant to
 * stop working.
 */
export function Avatar({
  name,
  photoUrl = null,
  size = "md",
}: {
  name: string | null;
  /** A short-lived signed URL, or null when the member has no photo. */
  photoUrl?: string | null;
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);

  const initial = (name?.trim()?.[0] ?? "E").toUpperCase();

  const dimensions =
    size === "sm" ? "h-8 w-8 text-[0.85rem]" : "h-10 w-10 text-[0.95rem]";

  // The photo takes the exact tile the initial would -- same size, same
  // rounding, same ground -- so nothing reflows when one appears.
  const shape = `inline-flex ${dimensions} shrink-0 items-center justify-center overflow-hidden rounded-full bg-ember-tint`;

  if (!photoUrl || failed) {
    return (
      <span aria-hidden="true" className={`${shape} font-medium text-ember-text`}>
        {initial}
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={shape}>
      {/*
        Empty alt: the button carries its own label, and the member's name is
        rendered beside this. Announcing "your photo" adds nothing to it.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl}
        alt=""
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
