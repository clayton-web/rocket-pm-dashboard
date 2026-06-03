import type { OffboardingStep } from "@/lib/leasing/offboarding-progress";

export function OffboardingStepper({ steps }: { steps: OffboardingStep[] }) {
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
                    step.state === "complete" ? "bg-neutral-400" : "bg-neutral-200"
                  }`}
                  aria-hidden
                />
              ) : null}
            </div>
            <span
              className={`mt-2 pr-2 text-xs leading-tight ${
                step.state === "current"
                  ? "font-semibold text-neutral-900"
                  : step.state === "complete"
                    ? "text-neutral-600"
                    : "text-neutral-400"
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
                  ? "font-semibold text-neutral-900"
                  : step.state === "complete"
                    ? "text-neutral-700"
                    : "text-neutral-400"
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

function StepDot({ state }: { state: OffboardingStep["state"] }) {
  if (state === "complete") {
    return (
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs text-white"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-neutral-800 bg-white"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-neutral-200 bg-white"
      aria-hidden
    />
  );
}
