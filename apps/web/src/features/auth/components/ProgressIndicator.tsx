import { onboardingSteps } from "@/features/auth/flow";

/**
 * Where someone is in onboarding, said quietly.
 *
 * "Step 2 of 4" over a filling bar is the visual language of a checkout, and it
 * frames the next question as an obstacle between the person and their account.
 * This says the same thing in the product's own vocabulary — a chapter being
 * written — and shows position with marks rather than a progress bar that
 * measures how much is left to endure.
 *
 * The count is still announced to screen readers, because "how much more is
 * there" is a fair question and hiding the answer to seem calm would be style
 * over substance.
 */
export function ProgressIndicator({
  currentIndex,
  className = "",
}: {
  /** Zero-based index into `onboardingSteps`. */
  currentIndex: number;
  className?: string;
}) {
  const total = onboardingSteps.length;
  const step = Math.min(Math.max(currentIndex, 0), total - 1);

  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-subtle">
        <span aria-hidden="true">{onboardingSteps[step].label}</span>
        <span className="sr-only">
          {onboardingSteps[step].label} — question {step + 1} of {total}
        </span>
      </p>

      {/*
        Marks, not a bar. A filled segment says "progress"; a small dot says
        "you are here", which is the honest amount of pressure to apply to
        someone answering questions about their divorce.
      */}
      <ol className="mt-3 flex items-center gap-2" aria-hidden="true">
        {onboardingSteps.map((item, index) => (
          <li
            key={item.route}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              index === step
                ? "w-6 bg-ember"
                : index < step
                  ? "w-1.5 bg-ember/45"
                  : "w-1.5 bg-line"
            }`}
          />
        ))}
      </ol>
    </div>
  );
}
