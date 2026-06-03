import prisma from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/services/errors";
import { listPropertiesForUser, listProspectsForProperty } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";

export type ProspectQueueRow = {
  id: string;
  createdAt: string;
  propertyId: string;
  propertyName: string;
  unitLabel: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  messagePreview: string | null;
};

export async function listNewProspectQueueForStaff(ctx: StaffContext): Promise<ProspectQueueRow[]> {
  const properties = await listPropertiesForUser(prisma, ctx);
  const rows: ProspectQueueRow[] = [];

  for (const property of properties) {
    let prospects;
    try {
      prospects = await listProspectsForProperty(prisma, ctx, property.id, { status: "new" });
    } catch (e) {
      if (e instanceof ForbiddenError) continue;
      throw e;
    }

    const unitIds = [...new Set(prospects.map((p) => p.unitId).filter(Boolean))] as string[];
    const units =
      unitIds.length > 0
        ? await prisma.unit.findMany({
            where: { id: { in: unitIds } },
            select: { id: true, unitNumber: true },
          })
        : [];
    const unitById = new Map(units.map((u) => [u.id, u.unitNumber]));

    for (const p of prospects) {
      const unitNumber = p.unitId ? unitById.get(p.unitId) : null;
      rows.push({
        id: p.id,
        createdAt: p.createdAt.toISOString(),
        propertyId: property.id,
        propertyName: property.name,
        unitLabel: unitNumber ? `Unit ${unitNumber}` : null,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        messagePreview: p.message,
      });
    }
  }

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows;
}
