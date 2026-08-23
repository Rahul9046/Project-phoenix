/** A hairline with a word in it. Used between the social buttons and email. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-4" role="separator">
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      <span className="text-sm text-ink-subtle">{label}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}
