"use client";

import { SURFACE_CARD, SURFACE_PANEL } from "@/components/portal/ui";
import { OffboardingStepper } from "@/components/leasing/offboarding-stepper";
import type { OffboardingNextStep, OffboardingStep } from "@/lib/leasing/offboarding-progress";
import Link from "next/link";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export type OffboardingSummaryProps = {
  steps: OffboardingStep[];
  nextStep: OffboardingNextStep;
  requestedMoveOutDate: string | null;
  scheduledMoveOutDate: string | null;
  inspectionDate: string | null;
  inspectionReportUrl: string | null;
  inspectionNotes: string | null;
  acceptedNoticeId: string | null;
  missingAcceptedNotice: boolean;
};

export function OffboardingSummary({
  steps,
  nextStep,
  requestedMoveOutDate,
  scheduledMoveOutDate,
  inspectionDate,
  inspectionReportUrl,
  inspectionNotes,
  acceptedNoticeId,
  missingAcceptedNotice,
}: OffboardingSummaryProps) {
  return (
    <div className={`${SURFACE_CARD} mb-6 px-4 py-4`} id="offboarding-summary">
      <h2 className="text-sm font-semibold text-neutral-900">Offboarding</h2>
      <div className="mt-4">
        <OffboardingStepper steps={steps} />
      </div>

      <div className={`${SURFACE_PANEL} mt-4 flex flex-col gap-2 px-3.5 py-3 text-sm text-neutral-700`}>
        <p>
          <span className="text-neutral-500">Requested move-out · </span>
          {formatDate(requestedMoveOutDate)}
        </p>
        <p>
          <span className="text-neutral-500">Scheduled move-out · </span>
          {formatDate(scheduledMoveOutDate)}
        </p>
        <p>
          <span className="text-neutral-500">Inspection date · </span>
          {formatDate(inspectionDate)}
        </p>
        <p>
          <span className="text-neutral-500">Inspection report · </span>
          {inspectionReportUrl ? (
            <a
              href={inspectionReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              View report
            </a>
          ) : (
            "—"
          )}
        </p>
        {inspectionNotes ? (
          <p>
            <span className="text-neutral-500">Inspection notes · </span>
            <span className="whitespace-pre-wrap">{inspectionNotes}</span>
          </p>
        ) : null}
        {acceptedNoticeId ? (
          <p>
            <span className="text-neutral-500">Notice · </span>
            <Link
              href={`/leasing/notices/${acceptedNoticeId}`}
              className="font-medium underline"
            >
              View tenant notice
            </Link>
          </p>
        ) : null}
      </div>

      {missingAcceptedNotice ? (
        <p className="mt-4 text-sm text-amber-900">
          No accepted notice on file for this tenancy. Accept a tenant notice on{" "}
          <Link href="/leasing/offboarding" className="font-medium underline">
            Offboarding
          </Link>{" "}
          before scheduling move-out.
        </p>
      ) : null}

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
