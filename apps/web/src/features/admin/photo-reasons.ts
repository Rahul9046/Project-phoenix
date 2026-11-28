/**
 * Why a photograph was refused — the values and the moderator-facing labels.
 *
 * ❗ THIS FILE EXISTS BECAUSE OF A NEXT.JS RULE, NOT BECAUSE OF TASTE.
 *
 * These constants used to live in `photo-actions.ts`, which carries
 * `"use server"`. A `"use server"` module may export **async functions only**:
 * every export is turned into a server-action reference, so a client importing
 * an array from one receives an action stub instead. The symptom is a runtime
 * crash the moment the value is used as what it claims to be:
 *
 *     TypeError: PHOTO_REJECTION_REASONS.map is not a function
 *         at PhotoActions.tsx — the reason dropdown
 *
 * Nothing static catches it. The types say `readonly string[]` and are correct
 * about the source; `tsc` passes, ESLint passes, `next build` passes, and the
 * page renders — until a moderator clicks "Reject…", at which point the whole
 * rejection half of the photo queue is unusable. It was found by clicking the
 * button in a browser, which is the only thing that could have found it.
 *
 * So: plain module, no directive, imported by both the server action and the
 * client component. Do not move these back.
 */

/**
 * The same values as the `photo_rejection_reason` enum, and a rejection must
 * carry one -- the database refuses a rejection with no reason, because a
 * member who is told only "no" cannot fix anything.
 */
export const PHOTO_REJECTION_REASONS = [
  "no_person",
  "multiple_people",
  "not_the_member",
  "explicit",
  "contact_details",
  "unclear",
  "other",
] as const;

export type PhotoRejectionReason = (typeof PHOTO_REJECTION_REASONS)[number];

/** What a moderator reads beside each reason. Not shown to members. */
export const REJECTION_LABELS: Record<PhotoRejectionReason, string> = {
  no_person: "Not a photograph of a person",
  multiple_people: "A group photo — unclear who this is",
  not_the_member: "Someone else, a celebrity or a stock image",
  explicit: "Sexual or otherwise not permitted",
  contact_details: "A phone number or handle written into the image",
  unclear: "Too dark, small or blurred to show a face",
  other: "Something else",
};
