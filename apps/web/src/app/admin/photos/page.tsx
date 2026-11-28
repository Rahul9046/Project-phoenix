import type { Metadata } from "next";
import Link from "next/link";

import { requireModerator } from "@/features/admin/access";
import { PhotoActions } from "@/features/admin/PhotoActions";
import { listPhotosForReview, photoReviewCounts } from "@/features/admin/photo-data";

/**
 * The photo review queue.
 *
 * App Store Review Guideline 1.2 asks for "a method for filtering objectionable
 * material from being posted to the app". For photographs the method is a
 * person, because there is no automated check worth trusting with the single
 * most consequential thing a member publishes here -- a photograph is what a
 * stranger decides about.
 *
 * Deliberately plain, for the same reasons `admin/reports` is: a list, two
 * actions, and the one piece of context that matters (whose photograph, and how
 * long they have been waiting). No throughput counters and no queue-clearing
 * pressure. Somebody is waiting to be seen.
 *
 * Two views, because they are different jobs:
 *
 *   "Waiting"       -- uploaded since moderation began, invisible to everybody
 *                      but their owner until someone decides.
 *   "Not yet reviewed" -- the backlog that predates this feature. Those are
 *                      VISIBLE in the product right now. They were grandfathered
 *                      rather than hidden, because hiding every existing
 *                      photograph would have punished members for a policy
 *                      change they never saw; and rather than approved, because
 *                      recording a human decision nobody made would be a lie in
 *                      the audit trail. This view is how that backlog gets
 *                      worked through without a deadline attached to it.
 *
 * Images load through five-minute signed URLs. The bucket is private and there
 * is no unsigned form that works, so a URL copied out of this page is useless
 * by the time it reaches anybody.
 *
 * Not part of the signed-in shell and not linked from anywhere.
 * `requireModerator()` answers with a 404 rather than a 403, so the page does
 * not confirm its own existence to somebody probing for it.
 */

export const metadata: Metadata = {
  title: "Photo review",
  robots: { index: false, follow: false },
};

function when(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function waitedFor(value: string): string {
  const hours = Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function PhotoReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireModerator();

  const { view } = await searchParams;
  const showBacklog = view === "backlog";

  const [photos, counts] = await Promise.all([
    listPhotosForReview(showBacklog),
    photoReviewCounts(),
  ]);

  // `photo_review_queue` returns pending rows always, and grandfathered ones as
  // well when asked. The backlog view wants only the latter.
  const rows = showBacklog
    ? photos.filter((photo) => photo.state === "grandfathered")
    : photos;

  return (
    <main style={{ padding: "2rem", maxWidth: "70rem", margin: "0 auto" }}>
      <h1>Photo review</h1>

      <p style={{ color: "#555" }}>
        A photograph uploaded today is visible only to the person who uploaded it
        until it is approved here. {counts.pending} waiting,{" "}
        {counts.grandfathered} never reviewed, {counts.rejected} refused.
      </p>

      <nav style={{ display: "flex", gap: "1rem", margin: "1rem 0" }}>
        <Link href="/admin/photos" aria-current={!showBacklog ? "page" : undefined}>
          Waiting ({counts.pending})
        </Link>
        <Link
          href="/admin/photos?view=backlog"
          aria-current={showBacklog ? "page" : undefined}
        >
          Not yet reviewed ({counts.grandfathered})
        </Link>
        <Link href="/admin/reports">Reports</Link>
      </nav>

      {showBacklog ? (
        <p
          style={{
            background: "#fff8e1",
            border: "1px solid #e0c060",
            padding: "0.75rem",
            borderRadius: "0.25rem",
          }}
        >
          <strong>These photographs are visible in the product now.</strong> They
          were uploaded before review existed. They are listed as never reviewed
          rather than approved, because nobody has looked at them — not because
          anything is wrong with them. There is no deadline on this list.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p>
          {showBacklog
            ? "The backlog is clear."
            : "Nothing is waiting. Every photograph has been decided."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1.5rem" }}>
          {rows.map((photo) => (
            <li
              key={photo.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "0.5rem",
                padding: "1rem",
                display: "grid",
                gridTemplateColumns: "minmax(0, 14rem) 1fr",
                gap: "1rem",
                alignItems: "start",
              }}
            >
              {photo.signedUrl ? (
                /*
                 * A plain <img>, not next/image. The URL is signed and expires,
                 * so the optimiser would cache a URL that stops working and
                 * there is nothing to gain from resizing a photograph somebody
                 * is about to judge at full size.
                 */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.signedUrl}
                  alt={`Photograph awaiting review from ${photo.firstName ?? "a member"}`}
                  style={{
                    width: "100%",
                    maxHeight: "18rem",
                    objectFit: "contain",
                    background: "#f4f4f4",
                  }}
                />
              ) : (
                <div style={{ padding: "2rem", background: "#f4f4f4" }}>
                  The image could not be loaded. Decide from the queue later.
                </div>
              )}

              <div style={{ display: "grid", gap: "0.5rem" }}>
                <div>
                  <strong>{photo.firstName ?? "A member"}</strong>{" "}
                  <span style={{ color: "#777" }}>
                    · position {photo.position} · uploaded {waitedFor(photo.uploadedAt)}
                  </span>
                </div>
                <div style={{ color: "#777", fontSize: "0.85rem" }}>
                  {when(photo.uploadedAt)}
                </div>
                <div>
                  <Link href={`/members/${photo.profileId}`}>
                    Open this member&rsquo;s profile
                  </Link>
                </div>

                <PhotoActions photoId={photo.id} firstName={photo.firstName} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
