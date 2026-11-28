import type { TranslationKey } from "@eraya/i18n";

/**
 * Turning a refused write into a sentence in the member's own language.
 *
 * The screening triggers raise with SQLSTATE `ERA01` and a message of the form
 * `content_rejected:<reason>`. That token is deliberately machine-readable and
 * deliberately not a sentence: the database does not know what language anybody
 * reads, and an English string from a trigger would reach a Tamil member as
 * English.
 *
 * `null` means "this was not a content refusal" -- the caller should fall back
 * to whatever it already said about a failed save. That matters because the
 * same PATCH can fail for ordinary reasons, and telling somebody their words
 * were refused when the network dropped would be both wrong and insulting.
 *
 * Unknown reasons map to `content.refused.unknown` rather than throwing. A
 * reason added to the database later should degrade to a vague-but-true
 * sentence on an older build, not to a crash.
 */

const REASONS = {
  contact_details: "content.refused.contact_details",
  external_link: "content.refused.external_link",
  sexual_solicitation: "content.refused.sexual_solicitation",
  abuse: "content.refused.abuse",
  prohibited: "content.refused.prohibited",
} as const satisfies Record<string, TranslationKey>;

export function contentRefusalKey(
  error: { message?: string | null } | null | undefined,
): TranslationKey | null {
  const message = error?.message;
  if (!message) return null;

  const match = /content_rejected:([a-z_]+)/.exec(message);
  if (!match) return null;

  const reason = match[1];
  if (reason && reason in REASONS) {
    return REASONS[reason as keyof typeof REASONS];
  }

  return "content.refused.unknown";
}
