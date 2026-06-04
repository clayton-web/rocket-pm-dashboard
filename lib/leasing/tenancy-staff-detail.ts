import type { TenancyStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { getTenancyById, listTenancyContacts } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";
import {
  getOffboardingNextStep,
  getOffboardingSteps,
  showsOffboardingSummary,
} from "@/lib/leasing/offboarding-progress";
import {
  assessLeaseSetupReadiness,
  formatLeaseSetupReadinessStatus,
} from "@/lib/leasing/lease-setup-readiness";
import { parseLeaseSetupJson } from "@/lib/leasing/lease-setup";
import { getOrganizationLandlordProfileForStaff } from "@/lib/org/organization-landlord-profile";
import { deriveLeaseSigningProgress } from "@/lib/leasing/lease-signing-progress";
import {
  LEASE_SIGNING_PROVIDER,
  RTB1_DOCUMENT_TYPE,
  RTB1_EXECUTED_DOCUMENT_TYPE,
} from "@/lib/leasing/rtb1/constants";
import type { TenancyStaffDetail } from "@/lib/leasing/tenancy-staff-detail-types";
import {
  getOnboardingNextStep,
  getOnboardingSteps,
  onboardingSnapshotFromLeaseSigningProgress,
  showsOnboardingSummary,
} from "@/lib/leasing/onboarding-progress";
import {
  getAdvanceTenancyStatusLabel,
  getNextTenancyStatus,
  STAFF_BLOCKED_ADVANCE_TARGETS,
} from "@/lib/leasing/tenancy-lifecycle";
import { loadTenancyActivationReadiness } from "@/lib/leasing/tenancy-activation-gate";
import { formatTenancyStatus } from "@/lib/leasing/application-staff-detail";
import {
  formatMoveOutDateLabel,
  getAcceptedTenantEndNoticeForTenancy,
} from "@/lib/leasing/tenant-notice";

export type {
  LeaseSignatureAuditRow,
  Rtb1DraftDocumentRow,
  TenancyContactRow,
  TenancyStaffDetail,
} from "@/lib/leasing/tenancy-staff-detail-types";

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
  const showOnboardingSummary = showsOnboardingSummary(status);

  const mappedContacts = contacts.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    contactType: c.contactType,
    portalAccessEnabled: c.portalAccessEnabled,
  }));

  const primaryContact =
    mappedContacts.find((c) => c.contactType === "tenant") ?? mappedContacts[0] ?? null;
  const primaryPortalAccessEnabled = primaryContact?.portalAccessEnabled ?? null;
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

  const leaseSetup = parseLeaseSetupJson(tenancy.leaseSetupJson);
  const orgProfile = await getOrganizationLandlordProfileForStaff(ctx);
  const leaseReadiness = assessLeaseSetupReadiness({
    org: orgProfile,
    setup: leaseSetup,
    tenancy: {
      leaseStartDate: tenancy.leaseStartDate,
      leaseEndDate: tenancy.leaseEndDate,
      rentDueDay: tenancy.rentDueDay,
      monthlyRent: Number(tenancy.monthlyRent),
      securityDeposit: Number(tenancy.securityDeposit),
      petDeposit: tenancy.petDeposit != null ? Number(tenancy.petDeposit) : null,
    },
  });

  const rtb1Drafts = await prisma.document.findMany({
    where: {
      tenancyId: tenancy.id,
      documentType: RTB1_DOCUMENT_TYPE,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      createdAt: true,
    },
  });

  const leaseSigningBase = deriveLeaseSigningProgress({
    latestDraft: await prisma.document.findFirst({
      where: {
        tenancyId: tenancy.id,
        documentType: RTB1_DOCUMENT_TYPE,
        isLocked: false,
      },
      orderBy: { createdAt: "desc" },
    }),
    signatureRequest: await prisma.signatureRequest.findFirst({
      where: { tenancyId: tenancy.id, provider: LEASE_SIGNING_PROVIDER },
      include: { signatures: true },
      orderBy: { createdAt: "desc" },
    }),
    executedDocument: await prisma.document.findFirst({
      where: { tenancyId: tenancy.id, documentType: RTB1_EXECUTED_DOCUMENT_TYPE },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
    readinessComplete: leaseReadiness.status === "ready_for_rtb1",
  });
  const signatureRequestId = leaseSigningBase.signatureRequestId;
  const signatureRows = signatureRequestId
    ? await prisma.leaseSignature.findMany({
        where: { signatureRequestId },
        orderBy: { signedAt: "asc" },
        select: { signerRole: true, signerName: true, signedAt: true },
      })
    : [];

  const leaseSigning = {
    ...leaseSigningBase,
    signatures: signatureRows.map((row) => ({
      signerRole: row.signerRole,
      signerName: row.signerName,
      signedAt: row.signedAt.toISOString(),
    })),
  };

  const leaseExecution = onboardingSnapshotFromLeaseSigningProgress(leaseSigningBase.steps);
  const activationReadiness = await loadTenancyActivationReadiness(prisma, tenancy.id);

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
    showOnboardingSummary,
    onboardingSteps: showOnboardingSummary
      ? getOnboardingSteps({
          leaseSetupStatus: leaseReadiness.status,
          leaseExecution,
          portalAccessEnabled: primaryPortalAccessEnabled,
          activationReady: activationReadiness.ready,
        })
      : [],
    onboardingNextStep: showOnboardingSummary
      ? getOnboardingNextStep({
          portalAccessEnabled: primaryPortalAccessEnabled,
          moveInDate: tenancy.moveInDate.toISOString().slice(0, 10),
          leaseSetupStatus: leaseReadiness.status,
          leaseExecution,
          activationReady: activationReadiness.ready,
        })
      : { kind: "none", title: "", description: "" },
    primaryPortalAccessEnabled,
    contacts: mappedContacts,
    leaseSetup,
    leaseSetupStatus: leaseReadiness.status,
    leaseSetupStatusLabel: formatLeaseSetupReadinessStatus(leaseReadiness.status),
    rentDueDay: tenancy.rentDueDay,
    rtb1DraftDocuments: rtb1Drafts.map((doc) => ({
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      createdAt: doc.createdAt.toISOString(),
      downloadHref: `/api/leasing/documents/${doc.id}/download`,
    })),
    leaseSigning,
    activationReadiness,
  };
}
