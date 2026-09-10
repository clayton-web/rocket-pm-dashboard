"use client";

import { FOCUS_RING } from "@/components/portal/focus";
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
      <h2 className="text-sm font-semibold text-foreground">Offboarding</h2>
      <div className="mt-4">
        <OffboardingStepper steps={steps} />
      </div>

      <div className={`${SURFACE_PANEL} mt-4 flex flex-col gap-2 px-3.5 py-3 text-sm text-foreground-muted`}>
        <p>
          <span className="text-foreground-subtle">Requested move-out · </span>
          {formatDate(requestedMoveOutDate)}
        </p>
        <p>
          <span className="text-foreground-subtle">Scheduled move-out · </span>
          {formatDate(scheduledMoveOutDate)}
        </p>
        <p>
          <span className="text-foreground-subtle">Inspection date · </span>
          {formatDate(inspectionDate)}
        </p>
        <p>
          <span className="text-foreground-subtle">Inspection report · </span>
          {inspectionReportUrl ? (
            <a
              href={inspectionReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-medium underline ${FOCUS_RING}`}
            >
              View report
            </a>
          ) : (
            "—"
          )}
        </p>
        {inspectionNotes ? (
          <p>
            <span className="text-foreground-subtle">Inspection notes · </span>
            <span className="whitespace-pre-wrap">{inspectionNotes}</span>
          </p>
        ) : null}
        {acceptedNoticeId ? (
          <p>
            <span className="text-foreground-subtle">Notice · </span>
            <Link
              href={`/leasing/notices/${acceptedNoticeId}`}
              className={`font-medium underline ${FOCUS_RING}`}
            >
              View tenant notice
            </Link>
          </p>
        ) : null}
      </div>

      {missingAcceptedNotice ? (
        <p className="mt-4 text-sm text-warning-foreground">
          No accepted notice on file for this tenancy. Accept a tenant notice on{" "}
          <Link href="/leasing/offboarding" className={`font-medium underline ${FOCUS_RING}`}>
            Offboarding
          </Link>{" "}
          before scheduling move-out.
        </p>
      ) : null}

      {nextStep.kind !== "none" ? (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm font-semibold text-foreground">Next step</p>
          <p className="mt-1 text-sm font-medium text-foreground">{nextStep.title}</p>
          <p className="mt-1 text-sm text-foreground-muted">{nextStep.description}</p>
          {nextStep.href ? (
            <p className="mt-3">
              <Link href={nextStep.href} className={`text-sm font-medium text-foreground underline ${FOCUS_RING}`}>
                Go to {nextStep.title} →
              </Link>
            </p>
          ) : nextStep.anchorId ? (
            <p className="mt-3">
              <a
                href={`#${nextStep.anchorId}`}
                className={`text-sm font-medium text-foreground underline ${FOCUS_RING}`}
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
