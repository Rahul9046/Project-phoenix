/**
 * Eraya's legal documents.
 *
 * English only, deliberately.
 *
 * The rest of the product speaks six languages and should. These three
 * documents do not, yet, and pretending otherwise would be worse than the gap:
 * a machine translation of a privacy policy reads exactly like a reviewed one,
 * and the person relying on it cannot tell which they have. Until a translation
 * has been read by somebody qualified in that language, English is the version
 * that governs, and every screen that shows these documents says so in the
 * reader's own language.
 *
 * That is why the words here are not in `@eraya/i18n`. Putting them there would
 * require six copies to satisfy key parity, and five of them would be invented.
 *
 * Everything these documents claim is a claim about the product as it is built
 * today. Where a capability exists but is not switched on -- phone verification,
 * live payments -- they say so rather than describing the finished thing.
 */
import { privacyPolicy } from "./privacy";
import { termsOfService } from "./terms";
import { communityGuidelines } from "./safety";
import type { LegalDocument } from "./types";

export type { LegalBlock, LegalDocument, LegalSection } from "./types";
export { privacyPolicy, termsOfService, communityGuidelines };

/**
 * The version a member is recorded as having accepted.
 *
 * A date, because these documents change together and the question anybody ever
 * asks is "which wording was in front of them at the time". Bump it when the
 * substance changes -- not for a typo.
 */
export const LEGAL_VERSION = "2026-09-16";

/** Shown on each document, and the date the current wording took effect. */
export const LEGAL_EFFECTIVE_DATE = "16 September 2026";

/**
 * Who operates Eraya.
 *
 * A sole proprietor trading under a product name. The postal address that
 * consumer and payment rules will eventually require is a business decision
 * that has not been made -- a home address is not going on a public page -- so
 * nothing here invents one.
 */
export const operator = {
  name: "Rahul Das",
  tradingAs: "Eraya",
  country: "India",
  /** Privacy, grievances and support are one address, and it is a real one. */
  contactEmail: "support@eraya.app",
} as const;

export const legalDocuments: readonly LegalDocument[] = [
  privacyPolicy,
  termsOfService,
  communityGuidelines,
];

/** The canonical path for each document on the website. */
export const legalRoutes = {
  privacy: "/privacy",
  terms: "/terms",
  safety: "/safety",
} as const;
