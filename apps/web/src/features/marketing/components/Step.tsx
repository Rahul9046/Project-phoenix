export function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <li className="relative border-t border-line pt-6">
      <span
        aria-hidden="true"
        className="text-eyebrow text-ember-text"
      >
        {number}
      </span>
      <h3 className="mt-4 text-subhead text-ink">
        {title}
      </h3>
      <p className="mt-3 max-w-sm text-[0.975rem] leading-relaxed text-ink-muted">
        {description}
      </p>
    </li>
  );
}
