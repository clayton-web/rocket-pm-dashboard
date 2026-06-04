"use client";

import { InlineNotice, SURFACE_CARD, SURFACE_PANEL } from "@/components/portal/ui";
import { OnboardingStepper } from "@/components/leasing/onboarding-stepper";
import type { OnboardingNextStep, OnboardingStep } from "@/lib/leasing/onboarding-progress";
import { isOverdueMoveIn } from "@/lib/leasing/onboarding-progress";
import Link from "next/link";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function portalStatusLabel(portalAccessEnabled: boolean | null): string {
  if (portalAccessEnabled === true) return "Enabled";
  if (portalAccessEnabled === false) return "Disabled";
  return "No contact on file";
}

export type OnboardingSummaryProps = {
  steps: OnboardingStep[];
  nextStep: OnboardingNextStep;
  moveInDate: string;
  leaseStartDate: string;
  portalAccessEnabled: boolean | null;
};

export function OnboardingSummary({
  steps,
  nextStep,
  moveInDate,
  leaseStartDate,
  portalAccessEnabled,
}: OnboardingSummaryProps) {
  const overdue = isOverdueMoveIn(moveInDate);

  return (
    <div className={`${SURFACE_CARD} mb-6 px-4 py-4`} id="onboarding-summary">
      <h2 className="text-sm font-semibold text-neutral-900">Onboarding</h2>
      <div className="mt-4">
        <OnboardingStepper steps={steps} />
      </div>

      {overdue ? (
        <InlineNotice className="mt-4 border-amber-300 bg-amber-50 text-amber-950">
          Move-in date has passed. Review this tenancy and mark active when the tenant has moved in.
        </InlineNotice>
      ) : null}

      <div className={`${SURFACE_PANEL} mt-4 flex flex-col gap-2 px-3.5 py-3 text-sm text-neutral-700`}>
        <p>
          <span className="text-neutral-500">Move-in · </span>
          {formatDate(moveInDate)}
        </p>
        <p>
          <span className="text-neutral-500">Lease start · </span>
          {formatDate(leaseStartDate)}
        </p>
        <p>
          <span className="text-neutral-500">Portal access · </span>
          {portalStatusLabel(portalAccessEnabled)}
          {portalAccessEnabled === true ? (
            <span className="text-neutral-500">
              {" "}
              (sign-in and documents work after tenancy is active; signing uses the email link until
              then)
            </span>
          ) : null}
        </p>
      </div>

      {nextStep.kind !== "none" ? (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <p className="text-sm font-semibold text-neutral-900">Next step</p>
          <p className="mt-1 text-sm font-medium text-neutral-800">{nextStep.title}</p>
          <p className="mt-1 text-sm text-neutral-600">{nextStep.description}</p>
          {nextStep.href ? (
            <p className="mt-3">
              <Link href={nextStep.href} className="text-sm font-medium text-neutral-900 underline">
                Go to {nextStep.title} →
              </Link>
            </p>
          ) : nextStep.anchorId ? (
            <p className="mt-3">
              <a
                href={`#${nextStep.anchorId}`}
                className="text-sm font-medium text-neutral-900 underline"
              >
                Go to {nextStep.title} →
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
