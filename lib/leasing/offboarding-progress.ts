import type { TenancyStatus } from "@prisma/client";

export type OffboardingStepId =
  | "notice_accepted"
  | "move_out_scheduled"
  | "inspection_scheduled"
  | "inspection_completed"
  | "ended"
  | "archived";

export type OffboardingStepState = "complete" | "current" | "upcoming";

export type OffboardingStep = {
  id: OffboardingStepId;
  label: string;
  state: OffboardingStepState;
};

export type OffboardingNextStepKind =
  | "accept_notice"
  | "schedule_move_out"
  | "schedule_inspection"
  | "complete_inspection"
  | "mark_ended"
  | "archive"
  | "none";

export type OffboardingNextStep = {
  kind: OffboardingNextStepKind;
  title: string;
  description: string;
  href?: string;
  anchorId?: string;
};

const OFFBOARDING_STATUSES: ReadonlySet<TenancyStatus> = new Set([
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
  "ended",
  "archived",
]);

const STATUS_ORDER: TenancyStatus[] = [
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
  "ended",
  "archived",
];

function statusRank(status: TenancyStatus): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx === -1 ? -1 : idx;
}

export function showsOffboardingSummary(status: TenancyStatus): boolean {
  return OFFBOARDING_STATUSES.has(status);
}

export function getOffboardingSteps(status: TenancyStatus): OffboardingStep[] {
  const rank = statusRank(status);
  const stepDefs: { id: OffboardingStepId; label: string; minRank: number }[] = [
    { id: "notice_accepted", label: "Notice accepted", minRank: 0 },
    { id: "move_out_scheduled", label: "Move-out scheduled", minRank: 1 },
    { id: "inspection_scheduled", label: "Inspection date set", minRank: 2 },
    { id: "inspection_completed", label: "Inspection completed", minRank: 3 },
    { id: "ended", label: "Tenancy ended", minRank: 4 },
    { id: "archived", label: "Archived", minRank: 5 },
  ];

  if (status === "archived") {
    return stepDefs.map((step) => ({ id: step.id, label: step.label, state: "complete" as const }));
  }

  const currentIndex = Math.max(0, stepDefs.findIndex((s) => s.minRank === rank));

  return stepDefs.map((step, index) => {
    let state: OffboardingStepState = "upcoming";
    if (index < currentIndex) state = "complete";
    else if (index === currentIndex) state = "current";
    return { id: step.id, label: step.label, state };
  });
}

export function getOffboardingNextStep(
  status: TenancyStatus,
  opts: {
    acceptedNoticeId: string | null;
    awaitingScheduleNoticeId: string | null;
  },
): OffboardingNextStep {
  switch (status) {
    case "notice_received":
      if (opts.awaitingScheduleNoticeId) {
        return {
          kind: "schedule_move_out",
          title: "Schedule move-out",
          description: "Confirm the vacate date on the accepted tenant notice.",
          href: `/leasing/notices/${opts.awaitingScheduleNoticeId}`,
        };
      }
      return {
        kind: "schedule_move_out",
        title: "Schedule move-out",
        description:
          opts.acceptedNoticeId == null
            ? "No accepted notice on file. Review Offboarding or accept a tenant notice first."
            : "Confirm the scheduled move-out date on the tenant notice.",
        href: opts.acceptedNoticeId
          ? `/leasing/notices/${opts.acceptedNoticeId}`
          : "/leasing/offboarding",
      };
    case "move_out_scheduled":
      return {
        kind: "schedule_inspection",
        title: "Schedule move-out inspection",
        description: "Record the inspection date for this tenancy.",
        anchorId: "offboarding-schedule-inspection",
      };
    case "inspection_scheduled":
      return {
        kind: "complete_inspection",
        title: "Complete move-out inspection",
        description: "Confirm the inspection is done and add a report link or notes if available.",
        anchorId: "offboarding-complete-inspection",
      };
    case "inspection_completed":
      return {
        kind: "mark_ended",
        title: "Mark tenancy ended",
        description:
          "Mark ended when the tenant has vacated and the move-out inspection is recorded. This does not process deposits or close financials.",
        anchorId: "offboarding-lifecycle",
      };
    case "ended":
      return {
        kind: "archive",
        title: "Archive tenancy",
        description:
          "Archive when this record is fully closed in your process and no further staff actions are needed. Archived tenancies remain searchable.",
        anchorId: "offboarding-lifecycle",
      };
    default:
      return {
        kind: "none",
        title: "No action required",
        description: "Offboarding is complete for this tenancy.",
      };
  }
}
