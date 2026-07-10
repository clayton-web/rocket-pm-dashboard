import prisma from "@/lib/db/prisma";
import { getApplicationConversionPolicy } from "@/lib/leasing/application-conversion-policy";
import type { ApplicationQueueRow } from "@/lib/leasing/application-staff-queue";
import { formatPropertyAddress, formatUnitLabelOrDash } from "@/lib/property/display";
import { isPropertyServiceRelationship } from "@/lib/property/service-relationship";
import { ForbiddenError } from "@/lib/services/errors";
import { listApplicationsForProperty, listPropertiesForUser } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";

export type ApplicationConversionQueueRow = ApplicationQueueRow & {
  decisionAt: string | null;
  serviceRelationship: string;
  conversionStateLabel: string;
  canConvertToManagedTenancy: boolean;
  canCompletePlacement: boolean;
};

/**
 * Approved applications awaiting managed conversion or placement completion.
 * Excludes applications that already have a tenancy or completed placement.
 */
export async function listApprovedApplicationsReadyToConvertForStaff(
  ctx: StaffContext,
): Promise<ApplicationConversionQueueRow[]> {
  const properties = await listPropertiesForUser(prisma, ctx);
  const rows: ApplicationConversionQueueRow[] = [];

  for (const property of properties) {
    let applications;
    try {
      applications = await listApplicationsForProperty(prisma, ctx, property.id, {
        status: "approved",
      });
    } catch (e) {
      if (e instanceof ForbiddenError) continue;
      throw e;
    }

    const approved = applications.filter((a) => a.status === "approved");
    if (approved.length === 0) continue;

    const appIds = approved.map((a) => a.id);
    const [converted, placements] = await Promise.all([
      prisma.tenancy.findMany({
        where: { applicationId: { in: appIds } },
        select: { applicationId: true },
      }),
      prisma.tenantPlacement.findMany({
        where: { applicationId: { in: appIds } },
        select: { applicationId: true },
      }),
    ]);
    const convertedIds = new Set(converted.map((t) => t.applicationId));
    const placedIds = new Set(placements.map((p) => p.applicationId));
    const ready = approved.filter((a) => !convertedIds.has(a.id) && !placedIds.has(a.id));
    if (ready.length === 0) continue;

    const unitIds = [...new Set(ready.map((a) => a.unitId))];
    const units = await prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, unitNumber: true },
    });
    const unitById = new Map(units.map((u) => [u.id, u.unitNumber]));

    const serviceRelationship = isPropertyServiceRelationship(property.serviceRelationship)
      ? property.serviceRelationship
      : "MANAGED";

    for (const app of ready) {
      const policy = getApplicationConversionPolicy({
        applicationStatus: app.status,
        hasTenancy: false,
        serviceRelationship,
      });
      const unitNumber = unitById.get(app.unitId);
      rows.push({
        id: app.id,
        status: app.status,
        submittedAt: app.submittedAt?.toISOString() ?? null,
        decisionAt: app.decisionAt?.toISOString() ?? null,
        propertyId: property.id,
        propertyName: formatPropertyAddress(property),
        unitLabel: formatUnitLabelOrDash(unitNumber),
        firstName: app.firstName,
        lastName: app.lastName,
        email: app.email,
        phone: app.phone,
        desiredMoveInDate: app.desiredMoveInDate?.toISOString().slice(0, 10) ?? null,
        serviceRelationship,
        conversionStateLabel: policy.staffStateLabel,
        canConvertToManagedTenancy: policy.allowed,
        canCompletePlacement: policy.recommendedAction === "await_placement_completion",
      });
    }
  }

  rows.sort((a, b) => {
    const aTime = a.decisionAt ?? a.submittedAt ?? "";
    const bTime = b.decisionAt ?? b.submittedAt ?? "";
    return bTime.localeCompare(aTime);
  });
  return rows;
}
