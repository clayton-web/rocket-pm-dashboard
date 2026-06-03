import prisma from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/services/errors";
import { listApplicationsForProperty, listPropertiesForUser } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";

const QUEUE_STATUSES = new Set(["submitted", "under_review"]);

export type ApplicationQueueRow = {
  id: string;
  status: string;
  submittedAt: string | null;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  desiredMoveInDate: string | null;
};

function formatStatus(status: string): string {
  if (status === "under_review") return "Under review";
  if (status === "submitted") return "Submitted";
  return status;
}

export { formatStatus as formatApplicationQueueStatus };

export async function listApplicationQueueForStaff(
  ctx: StaffContext,
): Promise<ApplicationQueueRow[]> {
  const properties = await listPropertiesForUser(prisma, ctx);
  const rows: ApplicationQueueRow[] = [];

  for (const property of properties) {
    let applications;
    try {
      applications = await listApplicationsForProperty(prisma, ctx, property.id);
    } catch (e) {
      if (e instanceof ForbiddenError) continue;
      throw e;
    }

    const queued = applications.filter((a) => QUEUE_STATUSES.has(a.status));
    if (queued.length === 0) continue;

    const unitIds = [...new Set(queued.map((a) => a.unitId))];
    const units = await prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, unitNumber: true },
    });
    const unitById = new Map(units.map((u) => [u.id, u.unitNumber]));

    for (const app of queued) {
      const unitNumber = unitById.get(app.unitId);
      rows.push({
        id: app.id,
        status: app.status,
        submittedAt: app.submittedAt?.toISOString() ?? null,
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
    const aTime = a.submittedAt ?? "";
    const bTime = b.submittedAt ?? "";
    return bTime.localeCompare(aTime);
  });
  return rows;
}
