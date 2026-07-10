import type { OnboardingAttentionRow } from "@/lib/leasing/onboarding-attention-queue";
import {
  getOnboardingNextStep,
  onboardingSnapshotFromLeaseSigningProgress,
  type OnboardingNextStep,
} from "@/lib/leasing/onboarding-progress";
import { assessLeaseSetupReadiness } from "@/lib/leasing/lease-setup-readiness";
import { parseLeaseSetupJson } from "@/lib/leasing/lease-setup";
import { deriveLeaseSigningProgress } from "@/lib/leasing/lease-signing-progress";
import {
  LEASE_SIGNING_PROVIDER,
  RTB1_DOCUMENT_TYPE,
  RTB1_EXECUTED_DOCUMENT_TYPE,
} from "@/lib/leasing/rtb1/constants";
import { loadTenancyActivationReadiness } from "@/lib/leasing/tenancy-activation-gate";
import { getOrganizationLandlordProfileForStaff } from "@/lib/org/organization-landlord-profile";
import prisma from "@/lib/db/prisma";
import type { StaffContext } from "@/lib/services/staff-context";

/**
 * Batch-load getOnboardingNextStep results for attention rows.
 * Scoped to the staff org via tenancy → property.organizationId.
 */
export async function loadOnboardingNextStepsForAttentionRows(
  ctx: StaffContext,
  rows: ReadonlyArray<OnboardingAttentionRow>,
): Promise<Map<string, OnboardingNextStep>> {
  const result = new Map<string, OnboardingNextStep>();
  if (rows.length === 0) return result;

  const tenancyIds = [...new Set(rows.map((r) => r.tenancy.id))];
  const orgProfile = await getOrganizationLandlordProfileForStaff(ctx);

  const tenancies = await prisma.tenancy.findMany({
    where: {
      id: { in: tenancyIds },
      property: { organizationId: ctx.organizationId },
    },
    select: {
      id: true,
      leaseSetupJson: true,
      leaseStartDate: true,
      leaseEndDate: true,
      rentDueDay: true,
      monthlyRent: true,
      securityDeposit: true,
      petDeposit: true,
      moveInDate: true,
    },
  });

  const tenancyById = new Map(tenancies.map((t) => [t.id, t]));

  const [drafts, executedDocs, signatureRequests] = await Promise.all([
    prisma.document.findMany({
      where: {
        tenancyId: { in: tenancyIds },
        documentType: RTB1_DOCUMENT_TYPE,
        isLocked: false,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenancyId: true,
        createdAt: true,
        isLocked: true,
        documentType: true,
      },
    }),
    prisma.document.findMany({
      where: {
        tenancyId: { in: tenancyIds },
        documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, tenancyId: true, createdAt: true },
    }),
    prisma.signatureRequest.findMany({
      where: {
        tenancyId: { in: tenancyIds },
        provider: LEASE_SIGNING_PROVIDER,
      },
      include: { signatures: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const latestDraftByTenancy = new Map<string, (typeof drafts)[number]>();
  for (const doc of drafts) {
    if (!doc.tenancyId) continue;
    if (!latestDraftByTenancy.has(doc.tenancyId)) {
      latestDraftByTenancy.set(doc.tenancyId, doc);
    }
  }

  const latestExecutedByTenancy = new Map<string, (typeof executedDocs)[number]>();
  for (const doc of executedDocs) {
    if (!doc.tenancyId) continue;
    if (!latestExecutedByTenancy.has(doc.tenancyId)) {
      latestExecutedByTenancy.set(doc.tenancyId, doc);
    }
  }

  const latestSignatureByTenancy = new Map<string, (typeof signatureRequests)[number]>();
  for (const req of signatureRequests) {
    if (!req.tenancyId) continue;
    if (!latestSignatureByTenancy.has(req.tenancyId)) {
      latestSignatureByTenancy.set(req.tenancyId, req);
    }
  }

  for (const row of rows) {
    const tenancy = tenancyById.get(row.tenancy.id);
    if (!tenancy) continue;

    const leaseSetup = parseLeaseSetupJson(tenancy.leaseSetupJson);
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

    const leaseSigningBase = deriveLeaseSigningProgress({
      latestDraft: latestDraftByTenancy.get(tenancy.id) ?? null,
      signatureRequest: latestSignatureByTenancy.get(tenancy.id) ?? null,
      executedDocument: latestExecutedByTenancy.get(tenancy.id) ?? null,
      readinessComplete: leaseReadiness.status === "ready_for_rtb1",
    });
    const leaseExecution = onboardingSnapshotFromLeaseSigningProgress(leaseSigningBase.steps);
    const activationReadiness = await loadTenancyActivationReadiness(prisma, tenancy.id);

    result.set(
      tenancy.id,
      getOnboardingNextStep({
        portalAccessEnabled: row.portalAccessEnabled,
        moveInDate: tenancy.moveInDate.toISOString().slice(0, 10),
        leaseSetupStatus: leaseReadiness.status,
        leaseExecution,
        activationReady: activationReadiness.ready,
      }),
    );
  }

  return result;
}
