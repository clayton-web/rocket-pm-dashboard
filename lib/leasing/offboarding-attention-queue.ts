import {
  listNoticeQueueForStaff,
  listNoticesAwaitingScheduleForStaff,
  type NoticeQueueRow,
} from "@/lib/leasing/notice-staff-queue";
import {
  listTenanciesAwaitingInspectionCompleteForStaff,
  listTenanciesAwaitingInspectionScheduleForStaff,
  type OffboardingTenancyQueueRow,
} from "@/lib/leasing/offboarding-queue";
import type { StaffContext } from "@/lib/services/staff-context";

export type OffboardingAttentionKind =
  | "pending_notice"
  | "awaiting_schedule"
  | "awaiting_inspection_schedule"
  | "awaiting_inspection_complete";

export type OffboardingAttentionRow =
  | {
      kind: "pending_notice" | "awaiting_schedule";
      badgeLabel: string;
      href: string;
      sortAt: string;
      tenantLabel: string | null;
      propertyName: string;
      unitLabel: string;
      dateLabel: string;
      datePrefix: string;
      notice: NoticeQueueRow;
    }
  | {
      kind: "awaiting_inspection_schedule" | "awaiting_inspection_complete";
      badgeLabel: string;
      href: string;
      sortAt: string;
      tenantLabel: string | null;
      propertyName: string;
      unitLabel: string;
      dateLabel: string;
      datePrefix: string;
      tenancy: OffboardingTenancyQueueRow;
    };

function noticeRow(
  kind: "pending_notice" | "awaiting_schedule",
  badgeLabel: string,
  datePrefix: string,
  notice: NoticeQueueRow,
): OffboardingAttentionRow {
  return {
    kind,
    badgeLabel,
    href: `/leasing/notices/${notice.id}`,
    sortAt: notice.submittedAt,
    tenantLabel: notice.tenantLabel,
    propertyName: notice.propertyName,
    unitLabel: notice.unitLabel,
    dateLabel: notice.tenantRequestedMoveOutDate,
    datePrefix,
    notice,
  };
}

function tenancyRow(
  kind: "awaiting_inspection_schedule" | "awaiting_inspection_complete",
  badgeLabel: string,
  datePrefix: string,
  tenancy: OffboardingTenancyQueueRow,
): OffboardingAttentionRow {
  const dateLabel =
    kind === "awaiting_inspection_complete"
      ? tenancy.inspectionDate ?? "—"
      : tenancy.moveOutDate ?? "—";

  return {
    kind,
    badgeLabel,
    href: `/leasing/tenancies/${tenancy.id}`,
    sortAt: tenancy.updatedAt,
    tenantLabel: tenancy.tenantLabel,
    propertyName: tenancy.propertyName,
    unitLabel: tenancy.unitLabel,
    dateLabel,
    datePrefix,
    tenancy,
  };
}

export async function listOffboardingAttentionForStaff(
  ctx: StaffContext,
): Promise<OffboardingAttentionRow[]> {
  const [pendingNotices, awaitingSchedule, awaitingInspectionSchedule, awaitingInspectionComplete] =
    await Promise.all([
      listNoticeQueueForStaff(ctx),
      listNoticesAwaitingScheduleForStaff(ctx),
      listTenanciesAwaitingInspectionScheduleForStaff(ctx),
      listTenanciesAwaitingInspectionCompleteForStaff(ctx),
    ]);

  const tier1 = pendingNotices.map((notice) =>
    noticeRow("pending_notice", "Pending review", "Requested move-out · ", notice),
  );
  const tier2 = awaitingSchedule.map((notice) =>
    noticeRow("awaiting_schedule", "Awaiting schedule", "Requested move-out · ", notice),
  );
  const tier3 = awaitingInspectionSchedule.map((tenancy) =>
    tenancyRow(
      "awaiting_inspection_schedule",
      "Schedule inspection",
      "Move-out · ",
      tenancy,
    ),
  );
  const tier4 = awaitingInspectionComplete.map((tenancy) =>
    tenancyRow(
      "awaiting_inspection_complete",
      "Complete inspection",
      "Inspection · ",
      tenancy,
    ),
  );

  return [...tier1, ...tier2, ...tier3, ...tier4];
}
