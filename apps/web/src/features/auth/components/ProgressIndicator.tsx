import { onboardingSteps } from "@/features/auth/flow";

/**
 * Four segments, one per onboarding screen. Shows how much is left so nobody
 * wonders how long this will take — and stays readable for screen readers
 * through the label rather than the bars.
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
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-subtle">
        Step {step + 1} of {total}
        <span className="sr-only">: {onboardingSteps[step].label}</span>
      </p>
      <ol className="mt-3 flex gap-1.5" aria-hidden="true">
        {onboardingSteps.map((item, index) => (
          <li
            key={item.route}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              index <= step ? "bg-ember" : "bg-line"
            }`}
          />
        ))}
      </ol>
    </div>
  );
}
