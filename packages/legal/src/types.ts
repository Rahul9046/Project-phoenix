/**
 * The shape of a legal document, as data rather than markup.
 *
 * Two clients render these: a Next.js app that wants HTML and an Expo app that
 * has no DOM at all. Neither can consume the other's markup, and a document
 * written twice is a document that disagrees with itself the first time one copy
 * is edited -- which for a privacy policy is not a cosmetic problem.
 *
 * So the documents are structured data and each client renders them with its
 * own components. The words live in exactly one place.
 */

/** A paragraph, a list, or a heading below the section's own. */
export type LegalBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "subheading"; text: string }
  | { kind: "list"; items: readonly string[] };

export type LegalSection = {
  /** Stable across edits to the words, so links and anchors survive rewording. */
  id: string;
  heading: string;
  blocks: readonly LegalBlock[];
};

export type LegalDocument = {
  id: "privacy" | "terms" | "safety";
  title: string;
  /** One or two sentences, shown under the title. */
  lede: string;
  sections: readonly LegalSection[];
};
