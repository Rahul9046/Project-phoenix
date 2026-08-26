import type { ReactNode } from "react";

/** The column every signed-in screen sits in. */
export function AppPage({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
      <h1 className="font-serif text-[2rem] leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
        {title}
      </h1>
      {lede ? (
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-muted">
          {lede}
        </p>
      ) : null}
      <div className="mt-8 sm:mt-10">{children}</div>
    </div>
  );
}

/** A bordered block. The only container shape the signed-in area uses. */
export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}
    >
      {title ? (
        <h2 className="font-serif text-xl tracking-[-0.01em] text-ink">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/**
 * A label and its value, stacked on a phone and side by side once there is
 * room. Used for every read-only detail in the account area.
 */
export function DetailRow({
  label,
  value,
  action,
}: {
  label: string;
  value: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-[0.95rem] text-ink-subtle">{label}</dt>
      <dd className="flex items-center gap-3 text-[0.95rem] text-ink">
        {value}
        {action}
      </dd>
    </div>
  );
}

/** A small status word — verified, free, premium. */
export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "positive" | "attention";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-sand text-ink-muted",
    positive: "bg-ember-tint text-ember-text",
    attention: "border border-line-strong text-ink-muted",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.8rem] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
