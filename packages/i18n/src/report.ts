import type { TranslationKey } from "./types";

/**
 * The reasons a member can give for reporting another, in the order they are
 * offered.
 *
 * Here rather than in either app because the two clients must offer the same
 * list in the same order, and the only thing keeping them in step otherwise is
 * somebody remembering to edit twice. The consequence of drift is not cosmetic:
 * a moderator reading the queue cannot tell whether "other" means the reporter
 * had nothing better to choose or that the app they were using never offered
 * the category that fitted.
 *
 * The codes are values of the `report_reason` enum in Postgres, which is what
 * actually refuses an identifier that is not on this list. This array decides
 * what is *offered*; the database decides what is *accepted*, and the two are
 * deliberately not the same thing -- `incorrect_relationship_status` is still
 * accepted, because reports were filed under it before it stopped being
 * offered, and the admin queue still has to label them.
 *
 * Order is a product decision, not an alphabet. The reasons somebody reaches
 * for when frightened come first; "Something else" is last because reading
 * past it costs nothing and reaching it too early ends the search.
 *
 * Which is why `csae` is first. It is the worst thing on the list and the one
 * where a few seconds of scrolling is a few seconds somebody spends deciding
 * whether to bother -- and Google Play's Child Safety Standards expect an
 * in-app way to report child sexual abuse and exploitation by name, not a
 * general category somebody has to interpret. Before it existed the published
 * /child-safety page had to tell people to pick "Under 18" or "Threats or
 * safety concern" instead, which asked a frightened person to translate.
 */
export const REPORT_REASONS = [
  "csae",
  "harassment",
  "inappropriate_content",
  "fake_profile",
  "scam",
  "spam",
  "safety_threat",
  "underage",
  "other",
] as const;

export type ReportReasonCode = (typeof REPORT_REASONS)[number];

/**
 * The one reason that carries no meaning of its own, so the one that cannot be
 * filed without an explanation. Named rather than compared inline, because
 * `reason === "other"` in three files is three places to forget.
 */
export const OTHER_REASON = "other" satisfies ReportReasonCode;

/**
 * The reasons that make a report a child-safety report.
 *
 * Named once, for the same reason `OTHER_REASON` is: this set decides which
 * reports get the emergency guidance in both clients and which sort to the top
 * of the moderation queue, and `reason === "csae" || reason === "underage"`
 * written out in four places is four places to forget the second one.
 *
 * `underage` is here as well as `csae`. A member who believes somebody is a
 * child is reporting a child-safety matter whether or not they reach for the
 * word abuse, and the queue must treat it that way. The database agrees: the
 * ordering in `admin_list_reports` lists both.
 */
export const CSAE_REASONS = ["csae", "underage"] as const satisfies readonly ReportReasonCode[];

/** Whether a reason needs the emergency guidance shown beside it. */
export function isChildSafetyReason(code: ReportReasonCode): boolean {
  return (CSAE_REASONS as readonly string[]).includes(code);
}

/** Where a reason's label lives. Typed, so a missing translation will not compile. */
export function reportReasonKey(code: ReportReasonCode): TranslationKey {
  return `report.reasons.${code}`;
}

/**
 * Whether a report may be filed as written.
 *
 * The same rule the database enforces, run first so a member is told what is
 * missing instead of being handed a failed request. The database still checks:
 * this is a courtesy, not a boundary.
 */
export function reportNeedsDetails(code: ReportReasonCode): boolean {
  return code === OTHER_REASON;
}
