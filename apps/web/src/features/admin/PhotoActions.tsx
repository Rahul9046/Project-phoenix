"use client";

import { useState, useTransition } from "react";

import {
  approvePhoto,
  rejectPhoto,
  PHOTO_REJECTION_REASONS,
  REJECTION_LABELS,
  type PhotoRejectionReason,
} from "@/features/admin/photo-actions";

/**
 * Two decisions about one photograph.
 *
 * Approving is a single click: it publishes a photograph somebody chose to
 * upload, which is the expected outcome for nearly every row in the queue, and
 * making the common case cost two clicks is how a queue stops getting worked.
 *
 * Rejecting asks for a reason first, because the member is told what it was.
 * The database refuses a rejection with no reason -- a member who hears only
 * "no" cannot fix anything, and would reasonably upload the same photograph
 * again.
 *
 * No "skip" and no "maybe". A photograph left pending is already the skipped
 * state, and it is visible to its owner as "waiting", so there is nothing a
 * third button would add except a way to feel finished without deciding.
 */
export function PhotoActions({
  photoId,
  firstName,
}: {
  photoId: string;
  firstName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState<PhotoRejectionReason | "">("");
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  const who = firstName ?? "this member";

  function act(run: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) setError(result.message ?? "That did not go through.");
    });
  }

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => act(() => approvePhoto(photoId))}
        >
          Approve
        </button>

        {choosing ? (
          <button type="button" disabled={pending} onClick={() => setChoosing(false)}>
            Cancel
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => setChoosing(true)}>
            Reject…
          </button>
        )}
      </div>

      {choosing ? (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <label>
            <span style={{ display: "block", fontSize: "0.8rem" }}>
              Why is this being refused? {who} is told this.
            </span>
            <select
              value={reason}
              onChange={(event) =>
                setReason(event.target.value as PhotoRejectionReason | "")
              }
            >
              <option value="">Pick a reason…</option>
              {PHOTO_REJECTION_REASONS.map((value) => (
                <option key={value} value={value}>
                  {REJECTION_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={pending || reason === ""}
            onClick={() => {
              if (reason === "") return;
              act(() => rejectPhoto(photoId, reason));
            }}
          >
            Reject this photograph
          </button>
        </div>
      ) : null}

      {error ? <p style={{ color: "#b00" }}>{error}</p> : null}
    </div>
  );
}
