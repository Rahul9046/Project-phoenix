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
        className="font-serif text-sm font-medium tracking-[0.18em] text-ember-text"
      >
        {number}
      </span>
      <h3 className="mt-4 font-serif text-2xl leading-snug tracking-[-0.015em] text-ink">
        {title}
      </h3>
      <p className="mt-3 max-w-sm text-[0.975rem] leading-relaxed text-ink-muted">
        {description}
      </p>
    </li>
  );
}
