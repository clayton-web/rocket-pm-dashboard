import type { OffboardingAttentionRow } from "@/lib/leasing/offboarding-attention-queue";
import {
  getOffboardingNextStep,
  type OffboardingNextStep,
} from "@/lib/leasing/offboarding-progress";
import type { TenancyStatus } from "@prisma/client";
import { isDateOverdue, isDateWithinUpcomingWindow } from "@/lib/operations/date-windows";
import type { OperationalWorkItemDraft } from "@/lib/operations/work-item";

/**
 * Resolve offboarding next step from existing getOffboardingNextStep where the
 * attention row maps to a tenancy status; pending notices use accept-notice copy
 * consistent with the offboarding queue (notice not yet accepted).
 */
export function resolveOffboardingNextStep(row: OffboardingAttentionRow): OffboardingNextStep {
  if (row.kind === "pending_notice") {
    return {
      kind: "accept_notice",
      title: "Accept notice",
      description: "Review and accept the tenant notice to end tenancy.",
      href: row.href,
    };
  }

  if (row.kind === "awaiting_schedule") {
    return getOffboardingNextStep("notice_received", {
      acceptedNoticeId: row.notice.id,
      awaitingScheduleNoticeId: row.notice.id,
    });
  }

  if (
    row.kind === "awaiting_inspection_schedule" ||
    row.kind === "awaiting_inspection_complete"
  ) {
    return getOffboardingNextStep(row.tenancy.status as TenancyStatus, {
      acceptedNoticeId: null,
      awaitingScheduleNoticeId: null,
    });
  }

  // Exhaustiveness guard — should be unreachable.
  return {
    kind: "none",
    title: "No action required",
    description: "Offboarding item has no mapped next step.",
  };
}

export function adaptOffboardingToWorkItemDraft(
  row: OffboardingAttentionRow,
  nextStep: OffboardingNextStep = resolveOffboardingNextStep(row),
): OperationalWorkItemDraft {
  const dueAt = row.dateLabel !== "—" ? row.dateLabel : null;
  const dateOverdue = isDateOverdue(dueAt);
  const dateComingUp = isDateWithinUpcomingWindow(dueAt);

  let recordType: OperationalWorkItemDraft["recordType"];
  let recordId: string;
  if ("tenancy" in row) {
    recordType = "tenancy";
    recordId = row.tenancy.id;
  } else {
    recordType = "notice";
    recordId = row.notice.id;
  }

  const href =
    nextStep.href ??
    (nextStep.anchorId ? `${row.href}#${nextStep.anchorId}` : row.href);

  return {
    key: `offboarding:${row.kind}:${recordId}`,
    recordType,
    recordId,
    title: row.tenantLabel ?? "Tenant",
    subtitle: null,
    propertyLabel: row.propertyName,
    unitLabel: row.unitLabel,
    statusLabel: row.badgeLabel,
    nextActionLabel: nextStep.title,
    href,
    viewAllHref: "/leasing/offboarding",
    workflowBadge: "Offboarding",
    dueAt,
    waitingOn: "staff",
    assignedToLabel: null,
    urgency: dateOverdue ? "high" : "normal",
    secondaryIndicators: dateComingUp && !dateOverdue ? ["Date coming up"] : [],
    signals: {
      requiresStaffAction: true,
      isOverdue: dateOverdue,
      isWaitingOnOther: false,
      isComingUp: false,
    },
  };
}
