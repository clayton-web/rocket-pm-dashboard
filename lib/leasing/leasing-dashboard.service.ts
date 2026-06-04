import { listApprovedApplicationsReadyToConvertForStaff } from "@/lib/leasing/application-conversion-staff-queue";
import { listApplicationQueueForStaff } from "@/lib/leasing/application-staff-queue";
import { listOffboardingAttentionForStaff } from "@/lib/leasing/offboarding-attention-queue";
import { listNewProspectQueueForStaff } from "@/lib/leasing/staff-queue";
import {
  listPendingMoveInQueueForStaff,
  type TenancyQueueRow,
} from "@/lib/leasing/tenancy-staff-queue";
import type { ApplicationConversionQueueRow } from "@/lib/leasing/application-conversion-staff-queue";
import type { ApplicationQueueRow } from "@/lib/leasing/application-staff-queue";
import type { OffboardingAttentionRow } from "@/lib/leasing/offboarding-attention-queue";
import type { ProspectQueueRow } from "@/lib/leasing/staff-queue";
import type { StaffContext } from "@/lib/services/staff-context";

export const LEASING_DASHBOARD_PREVIEW_LIMIT = 5;

export type LeasingDashboardSummary = {
  total: number;
  viewingRequests: number;
  applicationsToReview: number;
  approvedReadyToConvert: number;
  pendingMoveIns: number;
  offboarding: number;
};

export type LeasingDashboardSection<T> = {
  total: number;
  preview: T[];
};

export type LeasingDashboardData = {
  summary: LeasingDashboardSummary;
  viewingRequests: LeasingDashboardSection<ProspectQueueRow>;
  applicationsToReview: LeasingDashboardSection<ApplicationQueueRow>;
  approvedReadyToConvert: LeasingDashboardSection<ApplicationConversionQueueRow>;
  pendingMoveIns: LeasingDashboardSection<TenancyQueueRow>;
  offboarding: LeasingDashboardSection<OffboardingAttentionRow>;
};

function previewSection<T>(rows: T[]): LeasingDashboardSection<T> {
  return {
    total: rows.length,
    preview: rows.slice(0, LEASING_DASHBOARD_PREVIEW_LIMIT),
  };
}

export async function getLeasingDashboardForStaff(
  ctx: StaffContext,
): Promise<LeasingDashboardData> {
  const [
    viewingRequests,
    applicationsToReview,
    approvedReadyToConvert,
    pendingMoveIns,
    offboarding,
  ] = await Promise.all([
    listNewProspectQueueForStaff(ctx),
    listApplicationQueueForStaff(ctx),
    listApprovedApplicationsReadyToConvertForStaff(ctx),
    listPendingMoveInQueueForStaff(ctx),
    listOffboardingAttentionForStaff(ctx),
  ]);

  const summary: LeasingDashboardSummary = {
    viewingRequests: viewingRequests.length,
    applicationsToReview: applicationsToReview.length,
    approvedReadyToConvert: approvedReadyToConvert.length,
    pendingMoveIns: pendingMoveIns.length,
    offboarding: offboarding.length,
    total: 0,
  };
  summary.total =
    summary.viewingRequests +
    summary.applicationsToReview +
    summary.approvedReadyToConvert +
    summary.pendingMoveIns +
    summary.offboarding;

  return {
    summary,
    viewingRequests: previewSection(viewingRequests),
    applicationsToReview: previewSection(applicationsToReview),
    approvedReadyToConvert: previewSection(approvedReadyToConvert),
    pendingMoveIns: previewSection(pendingMoveIns),
    offboarding: previewSection(offboarding),
  };
}
