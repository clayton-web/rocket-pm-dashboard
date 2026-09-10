import type { OnboardingStep } from "@/lib/leasing/onboarding-progress";

export function OnboardingStepper({ steps }: { steps: OnboardingStep[] }) {
  return (
    <>
      <ol className="hidden list-none flex-row gap-0 p-0 sm:flex">
        {steps.map((step, index) => (
          <li key={step.id} className="flex min-w-0 flex-1 flex-col items-start">
            <div className="flex w-full items-center">
              <StepDot state={step.state} />
              {index < steps.length - 1 ? (
                <div
                  className={`mx-1 h-0.5 flex-1 ${
                    step.state === "complete" ? "bg-foreground-subtle" : "bg-border"
                  }`}
                  aria-hidden
                />
              ) : null}
            </div>
            <span
              className={`mt-2 pr-2 text-xs leading-tight ${
                step.state === "current"
                  ? "font-semibold text-foreground"
                  : step.state === "complete"
                    ? "text-foreground-muted"
                    : "text-foreground-subtle"
              }`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      <ul className="flex list-none flex-col gap-2 p-0 sm:hidden">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            <StepDot state={step.state} />
            <span
              className={
                step.state === "current"
                  ? "font-semibold text-foreground"
                  : step.state === "complete"
                    ? "text-foreground-muted"
                    : "text-foreground-subtle"
              }
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function StepDot({ state }: { state: OnboardingStep["state"] }) {
  if (state === "complete") {
    return (
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-surface"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface"
      aria-hidden
    />
  );
}
