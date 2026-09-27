import type { TFunction } from "@eraya/i18n";

import { Button } from "@/shared/ui/Button";

import type { GuideCta as GuideCtaKind } from "../types";

/**
 * The one invitation at the end of a guide.
 *
 * One, at the end, and from a fixed set. The copy comes from the dictionary
 * rather than from the article, which is what stops a guide inventing its own
 * pitch -- and what keeps a claim like "India's safest community" from appearing
 * in one article because somebody typed it there.
 *
 * Set in sand with a rule above it rather than as an ember-filled banner. A
 * reader who has just finished something about dating after a bereavement should
 * reach an invitation, not an advertisement; the page's only saturated colour
 * stays on the button, where the action is.
 *
 * `none` renders nothing at all, and is a real option rather than a fallback. A
 * guide about recognising an unsafe situation should be able to end without
 * asking the reader to sign up for anything.
 */
export function GuideCta({
  kind = "join",
  t,
}: {
  kind?: GuideCtaKind;
  t: TFunction;
}) {
  if (kind === "none") return null;

  const copy =
    kind === "safety"
      ? {
          title: t("marketing.guides.ctaSafetyTitle"),
          body: t("marketing.guides.ctaSafetyBody"),
          action: t("marketing.guides.ctaSafetyAction"),
          href: "/safety",
          variant: "secondary" as const,
        }
      : {
          title: t("marketing.guides.ctaJoinTitle"),
          body: t("marketing.guides.ctaJoinBody"),
          action: t("marketing.guides.ctaJoinAction"),
          href: "/signup",
          variant: "primary" as const,
        };

  return (
    <aside className="mt-16 border-t border-line pt-10">
      <div className="rounded-2xl bg-sand px-7 py-9 sm:px-9">
        <h2 className="text-subhead text-ink">{copy.title}</h2>
        <p className="mt-3 text-[1.02rem] leading-relaxed text-ink-muted">
          {copy.body}
        </p>
        <Button href={copy.href} variant={copy.variant} className="mt-7">
          {copy.action}
        </Button>
      </div>
    </aside>
  );
}
