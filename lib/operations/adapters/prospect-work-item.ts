import type { ProspectQueueRow } from "@/lib/leasing/staff-queue";
import type { ProspectPipelineStage } from "@/lib/leasing/prospect-pipeline-stage";
import { labelForProspectPipelineNextAction } from "@/lib/operations/next-action-labels";
import {
  isDateTimeOverdue,
  isDateTimeWithinUpcomingWindow,
  isDateWithinUpcomingWindow,
} from "@/lib/operations/date-windows";
import type { OperationalWorkItemDraft } from "@/lib/operations/work-item";

/**
 * Prospect stages already covered by application review / conversion queues.
 * Excluded here to avoid duplicate Operations cards.
 */
const STAGES_DEFERRED_TO_APPLICATION_QUEUES = new Set<ProspectPipelineStage | string>([
  "application_received",
  "approved",
]);

function formatName(firstName: string | null, lastName: string | null, email: string): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || email;
}

function detailHref(row: ProspectQueueRow): string {
  if (
    (row.pipelineNextAction === "view_application" ||
      row.pipelineNextAction === "convert_application" ||
      row.pipelineNextAction === "complete_placement") &&
    row.primaryApplicationId
  ) {
    return `/leasing/applications/${row.primaryApplicationId}`;
  }
  if (row.pipelineNextAction === "view_tenancy" && row.tenancyId) {
    return `/leasing/tenancies/${row.tenancyId}`;
  }
  return `/leasing/prospects/${row.id}`;
}

/**
 * Normalize a prospect queue row. Returns null when the stage is represented
 * by application queues or the item is not operationally relevant.
 */
export function adaptProspectToWorkItemDraft(
  row: ProspectQueueRow,
  opts?: { referenceDate?: Date },
): OperationalWorkItemDraft | null {
  if (STAGES_DEFERRED_TO_APPLICATION_QUEUES.has(row.pipelineStage)) {
    return null;
  }

  const reference = opts?.referenceDate ?? new Date();
  const nextActionLabel = labelForProspectPipelineNextAction(row.pipelineNextAction);
  const showingOverdue = isDateTimeOverdue(row.nextScheduledShowingStart, reference);
  const showingComingUp = isDateTimeWithinUpcomingWindow(row.nextScheduledShowingStart, {
    reference,
  });
  const moveInComingUp = isDateWithinUpcomingWindow(row.desiredMoveInDate);

  const isApplicationSentWaiting =
    row.pipelineStage === "application_sent" &&
    (row.pipelineNextAction === "none" || row.pipelineNextAction === "view_application");

  const requiresStaffAction =
    row.pipelineNextAction === "schedule_viewing" ||
    row.pipelineNextAction === "mark_application_sent" ||
    row.pipelineNextAction === "convert_application" ||
    row.pipelineNextAction === "complete_placement" ||
    (row.pipelineNextAction === "view_application" && row.pipelineStage !== "application_sent");

  const secondaryIndicators: string[] = [];
  if (row.nextScheduledShowingStart) {
    secondaryIndicators.push(showingOverdue ? "Showing overdue" : "Showing scheduled");
  }

  return {
    key: `prospect:${row.id}`,
    recordType: "prospect",
    recordId: row.id,
    title: formatName(row.firstName, row.lastName, row.email),
    subtitle: row.email,
    propertyLabel: row.propertyName,
    unitLabel: row.unitLabel,
    statusLabel: row.pipelineStageLabel,
    nextActionLabel:
      isApplicationSentWaiting && row.pipelineNextAction === "none"
        ? "Await application"
        : nextActionLabel,
    href: detailHref(row),
    viewAllHref: "/leasing/prospects",
    workflowBadge: "Viewing / prospect",
    dueAt: row.nextScheduledShowingStart ?? row.desiredMoveInDate,
    waitingOn: isApplicationSentWaiting ? "applicant" : "staff",
    assignedToLabel: null,
    urgency: showingOverdue ? "high" : "normal",
    secondaryIndicators,
    signals: {
      requiresStaffAction: requiresStaffAction && !isApplicationSentWaiting,
      isOverdue: showingOverdue,
      isWaitingOnOther: isApplicationSentWaiting,
      isComingUp: !showingOverdue && (showingComingUp || moveInComingUp) && !requiresStaffAction,
    },
  };
}
