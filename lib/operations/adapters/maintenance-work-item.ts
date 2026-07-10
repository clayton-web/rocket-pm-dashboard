import type { MaintenanceUrgency } from "@prisma/client";
import {
  deriveMaintenanceNextAction,
  labelForManagerWorkflowStatus,
} from "@/lib/maintenance/maintenance-next-action";
import type { MaintenanceOpsQueueRow } from "@/lib/maintenance/maintenance-ops-queue";
import type { OperationalWorkItemDraft, WorkItemUrgency } from "@/lib/operations/work-item";

/**
 * Map maintenance domain urgency onto Operations WorkItemUrgency ranks:
 * emergency → high, urgent → normal, routine → low
 * (intra-section sort uses WORK_ITEM_URGENCY_RANK).
 */
export function mapMaintenanceUrgencyToWorkItemUrgency(
  urgency: MaintenanceUrgency,
): WorkItemUrgency {
  switch (urgency) {
    case "emergency":
      return "high";
    case "urgent":
      return "normal";
    case "routine":
    default:
      return "low";
  }
}

function urgencySecondaryIndicator(urgency: MaintenanceUrgency): string | null {
  if (urgency === "emergency") return "Emergency";
  if (urgency === "urgent") return "Urgent";
  return null;
}

/**
 * Adapt an open maintenance queue row into an Operations draft.
 * Returns null for terminal manager statuses (should already be filtered by loader).
 */
export function adaptMaintenanceToWorkItemDraft(
  row: MaintenanceOpsQueueRow,
): OperationalWorkItemDraft | null {
  const next = deriveMaintenanceNextAction(row.managerStatus);
  if (!next.eligible) {
    return null;
  }

  const secondaryIndicators: string[] = [];
  const urgencyChip = urgencySecondaryIndicator(row.urgency);
  if (urgencyChip) {
    secondaryIndicators.push(urgencyChip);
  }

  const hasAssignee = Boolean(row.assignedVendorName);
  // Dispatched without assignee: staff still owns follow-up; surface Unassigned.
  if (row.managerStatus === "dispatched" && !hasAssignee) {
    secondaryIndicators.push("Unassigned");
  }

  return {
    key: `maintenance:${row.id}`,
    recordType: "maintenance",
    recordId: row.id,
    title: row.title,
    subtitle: null,
    propertyLabel: row.propertyLabel,
    unitLabel: row.unitLabel,
    statusLabel: labelForManagerWorkflowStatus(row.managerStatus),
    nextActionLabel: next.label,
    href: `/maintenance/${row.id}`,
    viewAllHref: "/maintenance",
    workflowBadge: "Maintenance",
    dueAt: null,
    waitingOn: hasAssignee ? "vendor" : "staff",
    assignedToLabel: row.assignedVendorName,
    urgency: mapMaintenanceUrgencyToWorkItemUrgency(row.urgency),
    secondaryIndicators,
    signals: {
      requiresStaffAction: true,
      isOverdue: false,
      isWaitingOnOther: false,
      isComingUp: false,
    },
  };
}
