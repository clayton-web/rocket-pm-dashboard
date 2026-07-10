import { getApplicationConversionPolicy } from "@/lib/leasing/application-conversion-policy";
import type { ApplicationConversionQueueRow } from "@/lib/leasing/application-conversion-staff-queue";
import {
  formatApplicationQueueStatus,
  type ApplicationQueueRow,
} from "@/lib/leasing/application-staff-queue";
import {
  labelForApplicationConversionPolicy,
  labelForApplicationReview,
} from "@/lib/operations/next-action-labels";
import { isDateWithinUpcomingWindow } from "@/lib/operations/date-windows";
import type { OperationalWorkItemDraft } from "@/lib/operations/work-item";

function formatName(firstName: string | null, lastName: string | null, email: string): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || email;
}

/**
 * Submitted / under_review applications — staff must review.
 */
export function adaptApplicationReviewToWorkItemDraft(
  row: ApplicationQueueRow,
): OperationalWorkItemDraft {
  return {
    key: `application-review:${row.id}`,
    recordType: "application",
    recordId: row.id,
    title: formatName(row.firstName, row.lastName, row.email),
    subtitle: row.email,
    propertyLabel: row.propertyName,
    unitLabel: row.unitLabel,
    statusLabel: formatApplicationQueueStatus(row.status),
    nextActionLabel: labelForApplicationReview(),
    href: `/leasing/applications/${row.id}`,
    viewAllHref: "/leasing/applications",
    workflowBadge: "Application",
    dueAt: row.desiredMoveInDate,
    waitingOn: "staff",
    assignedToLabel: null,
    urgency: "normal",
    secondaryIndicators: isDateWithinUpcomingWindow(row.desiredMoveInDate)
      ? ["Upcoming move-in"]
      : [],
    signals: {
      requiresStaffAction: true,
      isOverdue: false,
      isWaitingOnOther: false,
      isComingUp: false,
    },
  };
}

/**
 * Approved applications ready to convert or complete placement.
 * Next-action label comes from getApplicationConversionPolicy.
 */
export function adaptApplicationConversionToWorkItemDraft(
  row: ApplicationConversionQueueRow,
): OperationalWorkItemDraft | null {
  const policy = getApplicationConversionPolicy({
    applicationStatus: row.status,
    hasTenancy: false,
    serviceRelationship: row.serviceRelationship,
  });

  if (policy.recommendedAction === "none") {
    return null;
  }

  return {
    key: `application-conversion:${row.id}`,
    recordType: "application",
    recordId: row.id,
    title: formatName(row.firstName, row.lastName, row.email),
    subtitle: row.email,
    propertyLabel: row.propertyName,
    unitLabel: row.unitLabel,
    statusLabel: row.conversionStateLabel || policy.staffStateLabel,
    nextActionLabel: labelForApplicationConversionPolicy(policy),
    href: `/leasing/applications/${row.id}`,
    viewAllHref: "/leasing/applications?queue=conversion",
    workflowBadge: "Finish leasing",
    dueAt: row.desiredMoveInDate,
    waitingOn: "staff",
    assignedToLabel: null,
    urgency: "normal",
    secondaryIndicators: [],
    signals: {
      requiresStaffAction: true,
      isOverdue: false,
      isWaitingOnOther: false,
      isComingUp: false,
    },
  };
}
