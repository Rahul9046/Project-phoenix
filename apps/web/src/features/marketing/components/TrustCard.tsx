import { Icon, type IconName } from "@/shared/ui/Icon";

export function TrustCard({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <article className="flex gap-5 border-t border-line pt-6">
      <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-ember-tint text-ember-text">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-base font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h3>
        <p className="mt-2 text-[0.975rem] leading-relaxed text-ink-muted">
          {description}
        </p>
      </div>
    </article>
  );
}
