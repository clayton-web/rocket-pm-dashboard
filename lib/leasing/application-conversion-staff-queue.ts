import prisma from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/services/errors";
import { listApplicationsForProperty, listPropertiesForUser } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";
import type { ApplicationQueueRow } from "@/lib/leasing/application-staff-queue";

export type ApplicationConversionQueueRow = ApplicationQueueRow & {
  decisionAt: string | null;
};

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

    const converted = await prisma.tenancy.findMany({
      where: { applicationId: { in: approved.map((a) => a.id) } },
      select: { applicationId: true },
    });
    const convertedIds = new Set(converted.map((t) => t.applicationId));
    const ready = approved.filter((a) => !convertedIds.has(a.id));
    if (ready.length === 0) continue;

    const unitIds = [...new Set(ready.map((a) => a.unitId))];
    const units = await prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, unitNumber: true },
    });
    const unitById = new Map(units.map((u) => [u.id, u.unitNumber]));

    for (const app of ready) {
      const unitNumber = unitById.get(app.unitId);
      rows.push({
        id: app.id,
        status: app.status,
        submittedAt: app.submittedAt?.toISOString() ?? null,
        decisionAt: app.decisionAt?.toISOString() ?? null,
        propertyId: property.id,
        propertyName: property.name,
        unitLabel: unitNumber ? `Unit ${unitNumber}` : "Unit",
        firstName: app.firstName,
        lastName: app.lastName,
        email: app.email,
        phone: app.phone,
        desiredMoveInDate: app.desiredMoveInDate?.toISOString().slice(0, 10) ?? null,
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
