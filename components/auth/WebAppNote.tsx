import { webVsApp } from "@/content/auth";

/**
 * Sets expectations about web vs. the mobile app without ever reading as a
 * refusal: the account made here is real, and the full experience arrives on
 * the phone. Quiet by design — a hairline box, no icon, no call to action.
 */
export function WebAppNote({ className = "" }: { className?: string }) {
  return (
    <aside
      className={`rounded-xl border border-line bg-sand/60 px-5 py-4 ${className}`.trim()}
    >
      <p className="text-[0.95rem] font-medium text-ink">{webVsApp.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        {webVsApp.body}
      </p>
    </aside>
  );
}
