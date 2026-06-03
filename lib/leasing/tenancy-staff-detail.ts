import type { TenancyStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { getTenancyById, listTenancyContacts } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";
import {
  getOffboardingNextStep,
  getOffboardingSteps,
  showsOffboardingSummary,
  type OffboardingNextStep,
  type OffboardingStep,
} from "@/lib/leasing/offboarding-progress";
import {
  getAdvanceTenancyStatusLabel,
  getNextTenancyStatus,
  STAFF_BLOCKED_ADVANCE_TARGETS,
} from "@/lib/leasing/tenancy-lifecycle";
import { formatTenancyStatus } from "@/lib/leasing/application-staff-detail";
import {
  formatMoveOutDateLabel,
  getAcceptedTenantEndNoticeForTenancy,
} from "@/lib/leasing/tenant-notice";

export type TenancyContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  contactType: string;
  portalAccessEnabled: boolean;
};

export type TenancyStaffDetail = {
  id: string;
  status: string;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  applicationId: string;
  leaseStartDate: string;
  leaseEndDate: string | null;
  moveInDate: string;
  moveOutDate: string | null;
  monthlyRent: string;
  securityDeposit: string;
  petDeposit: string | null;
  archivedAt: string | null;
  nextStatus: TenancyStatus | null;
  advanceStatusLabel: string | null;
  acceptedNoticeId: string | null;
  requestedMoveOutDate: string | null;
  inspectionDate: string | null;
  inspectionReportUrl: string | null;
  inspectionNotes: string | null;
  canScheduleInspection: boolean;
  canCompleteInspection: boolean;
  defaultInspectionDate: string | null;
  showOffboardingSummary: boolean;
  offboardingSteps: OffboardingStep[];
  offboardingNextStep: OffboardingNextStep;
  missingAcceptedNotice: boolean;
  contacts: TenancyContactRow[];
};

export { formatTenancyStatus };

export async function getTenancyDetailForStaff(
  ctx: StaffContext,
  tenancyId: string,
): Promise<TenancyStaffDetail> {
  const tenancy = await getTenancyById(prisma, ctx, tenancyId);

  const [property, unit, contacts] = await Promise.all([
    prisma.property.findUnique({
      where: { id: tenancy.propertyId },
      select: { name: true },
    }),
    prisma.unit.findUnique({
      where: { id: tenancy.unitId },
      select: { unitNumber: true },
    }),
    listTenancyContacts(prisma, ctx, tenancy.id),
  ]);

  const status = tenancy.status as TenancyStatus;
  const nextStatus = getNextTenancyStatus(status);
  const acceptedNotice = await getAcceptedTenantEndNoticeForTenancy(tenancy.id);

  const hideGenericAdvance =
    nextStatus != null && STAFF_BLOCKED_ADVANCE_TARGETS.has(nextStatus);

  const advanceStatusLabel =
    hideGenericAdvance || !nextStatus ? null : getAdvanceTenancyStatusLabel(status);

  const showOffboardingSummary = showsOffboardingSummary(status);
  const awaitingScheduleNoticeId =
    status === "notice_received" && tenancy.moveOutDate == null && acceptedNotice
      ? acceptedNotice.id
      : null;
  const missingAcceptedNotice =
    status === "notice_received" && acceptedNotice == null;

  const canScheduleInspection = status === "move_out_scheduled";
  const canCompleteInspection = status === "inspection_scheduled";
  const defaultInspectionDate =
    tenancy.moveOutDate?.toISOString().slice(0, 10) ??
    tenancy.inspectionDate?.toISOString().slice(0, 10) ??
    null;

  return {
    id: tenancy.id,
    status: tenancy.status,
    propertyId: tenancy.propertyId,
    propertyName: property?.name ?? "Property",
    unitLabel: unit?.unitNumber ? `Unit ${unit.unitNumber}` : "Unit",
    applicationId: tenancy.applicationId,
    leaseStartDate: tenancy.leaseStartDate.toISOString().slice(0, 10),
    leaseEndDate: tenancy.leaseEndDate?.toISOString().slice(0, 10) ?? null,
    moveInDate: tenancy.moveInDate.toISOString().slice(0, 10),
    moveOutDate: tenancy.moveOutDate?.toISOString().slice(0, 10) ?? null,
    monthlyRent: tenancy.monthlyRent.toString(),
    securityDeposit: tenancy.securityDeposit.toString(),
    petDeposit: tenancy.petDeposit?.toString() ?? null,
    archivedAt: tenancy.archivedAt?.toISOString() ?? null,
    nextStatus,
    advanceStatusLabel,
    acceptedNoticeId: acceptedNotice?.id ?? null,
    requestedMoveOutDate: acceptedNotice?.tenantRequestedMoveOutDate
      ? formatMoveOutDateLabel(acceptedNotice.tenantRequestedMoveOutDate)
      : null,
    inspectionDate: tenancy.inspectionDate?.toISOString().slice(0, 10) ?? null,
    inspectionReportUrl: tenancy.inspectionReportUrl,
    inspectionNotes: tenancy.inspectionNotes,
    canScheduleInspection,
    canCompleteInspection,
    defaultInspectionDate,
    showOffboardingSummary,
    offboardingSteps: showOffboardingSummary ? getOffboardingSteps(status) : [],
    offboardingNextStep: showOffboardingSummary
      ? getOffboardingNextStep(status, {
          acceptedNoticeId: acceptedNotice?.id ?? null,
          awaitingScheduleNoticeId,
        })
      : { kind: "none", title: "", description: "" },
    missingAcceptedNotice,
    contacts: contacts.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      contactType: c.contactType,
      portalAccessEnabled: c.portalAccessEnabled,
    })),
  };
}
